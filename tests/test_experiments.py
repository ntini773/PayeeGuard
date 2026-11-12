import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from rescue.experiments import Experiments
from rescue.paypal import ProbeError, PayPal, identifier


class ExperimentsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'db'
        self.api = Mock()
        self.api.create.return_value = {'batch_header': {'payout_batch_id': 'B1'}}
        self.store = Experiments(self.path, self.api)

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_retry_after_timeout_reuses_payload_across_restart(self):
        self.api.create.side_effect = [ProbeError('timeout'), {'batch_header': {'payout_batch_id': 'B1'}}]
        with self.assertRaises(ProbeError):
            self.store.create('experiment', 'payer', 'PAYPAL_ID')
        self.store.db.close()
        self.store = Experiments(self.path, self.api)
        self.store.create('experiment', 'payer', 'PAYPAL_ID')
        self.assertEqual(self.api.create.call_args_list[0], self.api.create.call_args_list[1])
        self.assertEqual(self.api.create.call_args.args[0]['items'][0]['amount'], {'value': '0.01', 'currency': 'USD'})

    def test_completed_experiment_not_sent_twice(self):
        first = self.store.create('experiment', 'payer', 'PAYPAL_ID')
        self.assertEqual(first, self.store.create('experiment', 'payer', 'PAYPAL_ID'))
        self.api.create.assert_called_once()

    def test_changed_destination_rejected(self):
        self.store.create('experiment', 'payer', 'PAYPAL_ID')
        with self.assertRaises(ProbeError):
            self.store.create('experiment', 'different', 'PAYPAL_ID')
        self.api.create.assert_called_once()

    def test_old_uncertain_request_is_not_retried(self):
        self.api.create.side_effect = ProbeError('timeout')
        with self.assertRaises(ProbeError):
            self.store.create('experiment', 'payer', 'PAYPAL_ID')
        self.store.db.execute('UPDATE operations SET created=0')
        self.store.db.commit()
        with self.assertRaisesRegex(ProbeError, 'too old'):
            self.store.create('experiment', 'payer', 'PAYPAL_ID')
        self.api.create.assert_called_once()

    def test_cancel_rechecks_even_after_timeout(self):
        self.api.item.side_effect = [{'transaction_status': 'UNCLAIMED'}, {'transaction_status': 'RETURNED'}]
        self.api.cancel.side_effect = ProbeError('timeout')
        result = self.store.cancel('I1')
        self.assertTrue(result['gate_passed'])
        self.assertEqual(result['cancellation_error'], 'timeout')
        self.assertEqual(self.api.item.call_count, 2)
        self.api.create.assert_not_called()

    def test_cancel_response_alone_never_passes(self):
        self.api.item.return_value = {'transaction_status': 'UNCLAIMED'}
        self.api.cancel.return_value = {'transaction_status': 'RETURNED'}
        result = self.store.cancel('I1')
        self.assertFalse(result['gate_passed'])
        self.assertIsNone(result['cancellation_error'])
        self.api.create.assert_not_called()

    def test_cancel_blocks_every_other_status(self):
        for status in ['SUCCESS', 'PENDING', 'FAILED', 'RETURNED', 'BLOCKED', None]:
            with self.subTest(status=status):
                self.api.item.return_value = {'transaction_status': status}
                with self.assertRaises(ProbeError):
                    self.store.cancel('I1')
        self.api.cancel.assert_not_called()

    def test_failed_recheck_is_not_success(self):
        self.api.item.side_effect = [{'transaction_status': 'UNCLAIMED'}, ProbeError('offline')]
        self.api.cancel.return_value = {'transaction_status': 'RETURNED'}
        with self.assertRaises(ProbeError):
            self.store.cancel('I1')
        self.api.create.assert_not_called()

    def test_identity_requires_scope_attributes_and_discards_tokens(self):
        api = PayPal({})
        api.call = Mock(side_effect=[{'access_token': 'secret'}, {'payer_id': 'P1', 'verified_account': True, 'email': 'private'}])
        result = api.identity('code', 'callback')
        self.assertEqual((result['payer_id'], result['verified_account']), ('P1', True))
        self.assertNotIn('private', str(result))  # the email is never returned, and neither is any token
        self.assertNotIn('secret', str(result))
        self.assertEqual(set(result['attributes']), {'account_type', 'account_creation_date', 'name', 'address'})
        self.assertEqual(api.call.call_args.kwargs['token'], 'secret')
        api.call.side_effect = [{'access_token': 'secret'}, {'user_id': 'not-a-payer-id'}]
        with self.assertRaises(ProbeError):
            api.identity('code', 'callback')

    def test_identifier_cannot_inject_path(self):
        for value in ['../other', 'abc?query=1', '', 'https://evil.test']:
            with self.assertRaises(ProbeError):
                identifier(value)

    def test_missing_credentials_fail_without_request(self):
        with self.assertRaisesRegex(ProbeError, 'Missing'):
            PayPal({}).access_token()
