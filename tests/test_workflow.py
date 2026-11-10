import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from rescue.store import Store, Denied
from rescue.workflow import Workflow, DemoPayPal
from rescue.paypal import ProbeError


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'app.sqlite3')
        self.credentials = self.store.initialize('demo', 'DEMO-ALICE', 'unused')
        self.creator = self.store.session(self.store.login('creator', self.credentials['creator']))
        self.operator = self.store.session(self.store.login('operator', self.credentials['operator']))
        self.api = DemoPayPal()
        self.flow = Workflow(self.store, self.api)
        self.case_id = 'case-001'

    def tearDown(self):
        self.tmp.cleanup()

    def prepared(self):
        self.flow.identity(self.case_id, self.creator, {'payer_id': 'DEMO-ALICE', 'verified_account': 'true'})
        self.flow.refresh(self.case_id, self.creator)
        return self.flow.propose(self.case_id, self.creator, 'change_destination', 'Old address inaccessible')

    def approved(self):
        case = self.prepared()
        return self.flow.approve(self.case_id, self.operator, case['version'], True)

    def test_marketplace_identity_is_separate_from_paypal_identity(self):
        self.store.add_user('intruder', 'recipient', 'intruder-password')
        actor = self.store.session(self.store.login('intruder', 'intruder-password'))
        with self.assertRaises(Denied):
            self.flow.identity(self.case_id, actor, {'payer_id': 'DEMO-ALICE', 'verified_account': True})
        self.assertEqual(self.store.cases(actor), [])

    def test_wrong_payer_and_false_verification_escalate(self):
        for payer, verified in [('OTHER', True), ('DEMO-ALICE', 'false')]:
            case = self.flow.identity(self.case_id, self.creator, {'payer_id': payer, 'verified_account': verified})
            self.assertEqual(case['state'], 'ESCALATED')
            with self.assertRaises(Denied):
                self.flow.propose(self.case_id, self.creator, 'change_destination', 'Please pay')

    def test_login_invalid_password_and_expiry(self):
        with self.assertRaises(Denied):
            self.store.login('creator', 'wrong')
        token = self.store.login('creator', self.credentials['creator'])
        with self.store.connect() as db:
            db.execute('UPDATE sessions SET expires=0')
        with self.assertRaises(Denied):
            self.store.session(token)

    def test_oauth_is_session_bound_expiring_and_single_use(self):
        state = self.store.begin_oauth(self.case_id, self.creator)
        with self.assertRaises(Denied):
            self.store.consume_oauth(state, self.operator)
        self.assertEqual(self.store.consume_oauth(state, self.creator), self.case_id)
        with self.assertRaises(Denied):
            self.store.consume_oauth(state, self.creator)
        state = self.store.begin_oauth(self.case_id, self.creator)
        with self.store.connect() as db:
            db.execute('UPDATE oauth SET expires=0')
        with self.assertRaises(Denied):
            self.store.consume_oauth(state, self.creator)

    def test_recipient_cannot_approve_or_cancel(self):
        case = self.prepared()
        with self.assertRaises(Denied):
            self.flow.approve(self.case_id, self.creator, case['version'], True)
        with self.assertRaises(Denied):
            self.flow.cancel(self.case_id, self.creator)

    def test_stale_review_rejected_and_message_revokes_approval(self):
        case = self.prepared()
        self.flow.message(self.case_id, self.creator, 'Actually send it to my friend')
        with self.assertRaises(Denied):
            self.flow.approve(self.case_id, self.operator, case['version'], True)
        self.approved()
        self.flow.message(self.case_id, self.creator, 'Changed my request')
        with self.assertRaises(Denied):
            self.flow.cancel(self.case_id, self.operator)

    def test_new_identity_invalidates_approved_destination(self):
        self.approved()
        self.flow.identity(self.case_id, self.creator, {'payer_id': 'OTHER', 'verified_account': True})
        with self.assertRaises(Denied):
            self.flow.cancel(self.case_id, self.operator)

    def test_approval_binds_trusted_record(self):
        self.approved()
        payee = self.store.payee('creator')
        payee['amount'] = '99.00'
        with self.store.connect() as db:
            db.execute('UPDATE payees SET data=? WHERE id=?', (json.dumps(payee), 'creator'))
        with self.assertRaises(Denied):
            self.flow.cancel(self.case_id, self.operator)

    def test_claimed_original_never_cancelled(self):
        self.approved()
        self.api.item = Mock(return_value={'payout_item_id': 'SIM-case-001', 'transaction_status': 'SUCCESS',
                                          'payout_item': {'amount': {'value': '0.01', 'currency': 'USD'}}})
        self.api.cancel = Mock()
        with self.assertRaises(Denied):
            self.flow.cancel(self.case_id, self.operator)
        self.api.cancel.assert_not_called()

    def test_cancellation_failure_is_persistent_no_repeat_no_replacement(self):
        self.approved()
        self.api.cancel = Mock(side_effect=ProbeError('HTTP 500'))
        case = self.flow.cancel(self.case_id, self.operator)
        self.assertEqual(case['state'], 'CANCELLATION_PENDING')
        self.assertEqual(case['paypal_status'], 'UNCLAIMED')
        self.assertIsNone(case['replacement'])
        self.assertEqual(case['cancellation_error'], 'HTTP 500')
        restarted = Workflow(self.store, self.api)
        restarted.cancel(self.case_id, self.operator)
        self.api.cancel.assert_called_once()

    def test_returned_retrieval_never_creates_real_replacement(self):
        self.approved()
        self.api.cancel = Mock(return_value={'transaction_status': 'RETURNED'})
        original = self.api.item('SIM-case-001')
        self.api.item = Mock(side_effect=[original, original | {'transaction_status': 'RETURNED'}])
        case = self.flow.cancel(self.case_id, self.operator)
        self.assertEqual(case['state'], 'RETURNED_NO_REPLACEMENT')
        self.assertIsNone(case['replacement'])

    def test_network_failure_revokes_approval_and_unknown_status(self):
        self.approved()
        self.api.item = Mock(side_effect=ProbeError('Network unavailable'))
        with self.assertRaises(ProbeError):
            self.flow.cancel(self.case_id, self.operator)
        case = self.store.case(self.case_id, self.operator)
        self.assertIsNone(case['approval'])
        self.assertEqual(case['paypal_status'], 'UNKNOWN')

    def test_wrong_amount_or_item_rejected(self):
        for item, amount in [('DIFFERENT', '0.01'), ('SIM-case-001', '0.02')]:
            self.api.item = Mock(return_value={'payout_item_id': item, 'transaction_status': 'UNCLAIMED',
                'payout_item': {'amount': {'value': amount, 'currency': 'USD'}}})
            with self.assertRaises(ProbeError):
                self.flow.refresh(self.case_id, self.creator)

    def test_demo_recovery_is_explicit_and_idempotent(self):
        self.approved()
        self.flow.cancel(self.case_id, self.operator)
        case = self.flow.simulate_recovery(self.case_id, self.operator)
        self.assertTrue(case['replacement']['simulated'])
        self.assertEqual(case['replacement']['amount'], '0.01')
        self.assertEqual(case['state'], 'CLOSED_SIMULATED')
        self.assertEqual(self.flow.simulate_recovery(self.case_id, self.operator)['replacement'], case['replacement'])
        events = [a['event'] for a in self.store.audit(self.case_id, self.operator)]
        self.assertEqual(events.count('SIMULATED_REPLACEMENT'), 1)

    def test_sandbox_simulation_and_provider_mix_rejected(self):
        with self.assertRaises(Denied):
            Workflow(self.store, Mock())
        with self.store.connect() as db:
            db.execute("UPDATE metadata SET value='sandbox' WHERE key='mode'")
        flow = Workflow(self.store, Mock())
        with self.assertRaises(Denied):
            flow.simulate_recovery(self.case_id, self.operator)

    def test_audit_cannot_be_updated_or_deleted(self):
        self.flow.message(self.case_id, self.creator, 'Help')
        with self.store.connect() as db:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute('DELETE FROM audit')
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE audit SET event='changed'")

    def test_claim_assistance_and_adversarial_escalation_do_not_cancel(self):
        self.api.cancel = Mock()
        for action, state in [('claim_original', 'CLAIM_ASSISTANCE'), ('escalate', 'ESCALATED')]:
            case = self.flow.propose(self.case_id, self.creator, action, 'Support response')
            self.assertEqual(case['state'], state)
            with self.assertRaises(Denied):
                self.flow.cancel(self.case_id, self.operator)
        self.api.cancel.assert_not_called()

    def test_explicit_recipient_review_creates_proposal_without_approval_or_payment(self):
        self.flow.identity(self.case_id, self.creator, {'payer_id': 'DEMO-ALICE', 'verified_account': True})
        self.api.cancel = Mock()
        case = self.flow.request_change(self.case_id, self.creator, 'My old email is inaccessible.', True)
        self.assertEqual(case['state'], 'AWAITING_APPROVAL')
        self.assertEqual(case['proposal']['action'], 'change_destination')
        self.assertIsNone(case['approval'])
        self.assertIsNone(case['replacement'])
        self.api.cancel.assert_not_called()

    def test_explicit_review_preserves_ownership_evidence_and_consent_checks(self):
        with self.assertRaises(Denied):
            self.flow.request_change(self.case_id, self.creator, 'Old email inaccessible', True)
        self.flow.identity(self.case_id, self.creator, {'payer_id': 'DEMO-ALICE', 'verified_account': True})
        for actor, reason, confirmed in [(self.operator, 'Old email inaccessible', True),
                                         (self.creator, '', True), (self.creator, 'Old email inaccessible', 'true'),
                                         (self.creator, 'Old email inaccessible', False)]:
            with self.assertRaises(Denied):
                self.flow.request_change(self.case_id, actor, reason, confirmed)
        self.assertIsNone(self.store.case(self.case_id, self.creator)['proposal'])

    def test_explicit_review_requires_fresh_unclaimed_state(self):
        self.flow.identity(self.case_id, self.creator, {'payer_id': 'DEMO-ALICE', 'verified_account': True})
        original = self.api.item('SIM-case-001')
        self.api.item = Mock(return_value=original | {'transaction_status': 'SUCCESS'})
        with self.assertRaises(Denied):
            self.flow.request_change(self.case_id, self.creator, 'Old address inaccessible', True)
        self.assertIsNone(self.store.case(self.case_id, self.creator)['proposal'])

    def test_clear_conversation_preserves_verification_approval_and_audit(self):
        self.flow.message(self.case_id, self.creator, 'My old email is inaccessible')
        before = self.approved()
        after = self.flow.clear_conversation(self.case_id, self.creator)
        self.assertEqual(after['messages'], [])
        for key in before:
            if key not in ('messages', 'version'):
                self.assertEqual(after[key], before[key], key)
        audit = self.store.audit(self.case_id, self.creator)
        self.assertTrue(any(a['event'] == 'recipient_message' for a in audit))
        self.assertEqual(audit[-1]['event'], 'conversation_cleared')
        self.assertEqual(audit[-1]['data']['archived_message_count'], 1)

    def test_clear_conversation_cannot_reset_pending_cancellation(self):
        self.approved()
        before = self.flow.cancel(self.case_id, self.operator)
        after = self.flow.clear_conversation(self.case_id, self.creator)
        self.assertEqual(after['state'], 'CANCELLATION_PENDING')
        self.assertEqual(after['cancellation_error'], before['cancellation_error'])
        self.assertIsNone(after['replacement'])
