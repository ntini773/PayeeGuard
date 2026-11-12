from dataclasses import replace
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from destination_fixtures import DestinationFixture, FakePayoutProvider
from rescue.destination_errors import DestinationError
from rescue.payout_gate import PayoutGate


class GateTest(DestinationFixture, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.provider = FakePayoutProvider()
        self.gate = PayoutGate(self.service, self.provider)

    def pay(self, op='earnings-1'):
        return self.gate.execute(self.tokens['reviewer'], op, amount='0.01', currency='USD')

    def test_pending_rejected_and_cooling_pay_only_stored_a(self):
        self.authenticate_destination()
        self.pay('pending')
        self.assertEqual(self.provider.creates[-1]['items'][0]['receiver'], 'AAAAAAAAAAAAA')
        self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        view = self.service.status(self.tokens['owner'], self.case_id)
        self.service.review(self.tokens['reviewer'], self.case_id, 'REJECT', 'not authorized', view['version'])
        self.pay('rejected')
        self.assertEqual(self.provider.creates[-1]['items'][0]['receiver'], 'AAAAAAAAAAAAA')

    def test_cooling_blocks_b_then_backend_deadline_selects_b(self):
        self.approve()
        self.pay('cooling')
        self.assertEqual(self.provider.creates[-1]['items'][0]['receiver'], 'AAAAAAAAAAAAA')
        self.now += 3 * 86400
        self.pay('after')
        self.assertEqual(self.provider.creates[-1]['items'][0]['receiver'], 'BBBBBBBBBBBBB')

    def test_duplicate_and_concurrent_requests_create_once(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.pay(), range(2)))
        self.assertEqual(len(self.provider.creates), 1)
        self.assertEqual(results[0]['sender_batch_id'], results[1]['sender_batch_id'])
        self.assertEqual(self.pay()['status'], 'RECONCILED')
        with self.assertRaises(DestinationError):
            self.gate.execute(self.tokens['reviewer'], 'earnings-1', amount='0.02', currency='USD')

    def test_timeout_persists_intent_never_creates_again_and_reconciles_binding(self):
        self.provider.fail_create = True
        first = self.pay()
        self.assertEqual(first['status'], 'UNKNOWN')
        self.assertEqual(self.pay()['sender_batch_id'], first['sender_batch_id'])
        self.assertEqual(len(self.provider.creates), 1)
        # A provider ID recovered by the backend must match the durable request.
        self.assertEqual(self.gate.reconcile(self.tokens['reviewer'], 'earnings-1', recovered_batch_id='TEST-BATCH')['status'], 'RECONCILED')
        self.provider.fail_read = True
        self.assertEqual(self.gate.reconcile(self.tokens['reviewer'], 'earnings-1')['status'], 'RECONCILED')
        self.pay()
        self.assertEqual(len(self.provider.creates), 1)

    def test_gate_rejects_external_seller_destination_injection_and_limits(self):
        for user in ('owner', 'staff', 'external'):
            with self.assertRaises(DestinationError):
                self.gate.execute(self.tokens[user], 'nope', amount='0.01', currency='USD')
        with self.assertRaises(TypeError):
            self.gate.execute(self.tokens['reviewer'], 'nope', amount='0.01', currency='USD', payer_id='BBBBBBBBBBBBB')
        for amount, currency in [('0.02', 'USD'), ('0.01', 'EUR'), ('NaN', 'USD'), ('-1', 'USD')]:
            with self.assertRaises(DestinationError):
                self.gate.execute(self.tokens['reviewer'], 'nope', amount=amount, currency=currency)
        self.assertEqual(self.provider.creates, [])

    def test_compromise_pause_and_explicit_exposure_cap(self):
        view = self.service.status(self.tokens['owner'], self.case_id)
        self.service.set_compromise(self.tokens['reviewer'], self.case_id, compromised=True, reason='risk', expected_version=view['version'])
        with self.assertRaises(DestinationError):
            self.pay()
        self.service.policy = replace(self.service.policy, compromise_policy='cap')
        view = self.service.status(self.tokens['owner'], self.case_id)
        self.service.set_compromise(self.tokens['reviewer'], self.case_id, compromised=True, reason='risk', expected_version=view['version'])
        self.pay()
        with self.assertRaises(DestinationError):
            self.pay('second')

    def test_simulated_destination_cannot_be_used_outside_demo(self):
        view = self.approve()
        self.service.simulate_elapsed(self.tokens['reviewer'], self.case_id, view['version'])
        self.service.policy = replace(self.service.policy, mode='sandbox')
        self.provider.simulated = False
        with self.assertRaises(DestinationError):
            self.pay()
        self.assertEqual(self.provider.creates, [])

    def test_expired_case_cannot_redirect_payment(self):
        self.authenticate_destination()
        self.now += 14 * 86400
        self.pay()
        self.assertEqual(self.provider.creates[0]['items'][0]['receiver'], 'AAAAAAAAAAAAA')
        self.assertEqual(self.service.status(self.tokens['owner'], self.case_id)['state'], 'EXPIRED')

    def test_foreign_reconciliation_data_retains_uncertainty(self):
        from unittest.mock import patch
        self.pay()
        wrong = self.provider.batch('TEST-BATCH')
        wrong['items'][0]['payout_item'] = dict(wrong['items'][0]['payout_item'], receiver='CCCCCCCCCCCCC')
        with patch.object(self.provider, 'batch', return_value=wrong):
            result = self.gate.reconcile(self.tokens['reviewer'], 'earnings-1')
        self.assertEqual(result['status'], 'RECONCILED')
        self.assertEqual(result['provider_status'], 'SUCCESS')
        self.assertEqual(len(self.provider.creates), 1)

    def test_confirmed_success_survives_failed_read_with_audit(self):
        first = self.pay()
        self.provider.fail_read = True
        result = self.gate.reconcile(self.tokens['reviewer'], 'earnings-1')
        self.assertEqual(result, first)
        with self.ds.connect() as db:
            event = db.execute("SELECT data FROM pg_events WHERE event='PAYOUT_RECONCILE_FAILED' ORDER BY seq DESC LIMIT 1").fetchone()
        self.assertIsNotNone(event)
        self.assertNotIn('provider secret', event[0])
        self.assertEqual(len(self.provider.creates), 1)

    def test_terminal_provider_failures_need_attention_without_retry(self):
        for status in ('FAILED', 'RETURNED', 'BLOCKED', 'DENIED'):
            self.provider.result_status = status
            result = self.pay('attention-' + status)
            self.assertTrue(result['needs_attention'])
            self.assertEqual(result['status'], 'RECONCILED')
        self.assertEqual(len(self.provider.creates), 4)
