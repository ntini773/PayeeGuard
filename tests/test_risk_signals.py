import json
import unittest
from unittest.mock import Mock
from langchain_core.messages import AIMessage
from destination_fixtures import DestinationFixture, FakePayoutProvider
from rescue.ai_review import AiReviewRunner, PayPalAwareReader
from rescue.destination_errors import DestinationError
from rescue.destination_policy import Policy
from rescue.destination_risk import (derive_paypal_facts, is_blocked, name_match, risk_findings, signal_ages)
from rescue.paypal import PayPal

NOW = 1800000000.0
HOUR, DAY = 3600, 86400
POLICY = Policy()


class FactsTest(unittest.TestCase):
    def test_name_match_levels(self):
        self.assertEqual(name_match('Jane Marie Doe', 'jane doe'), 'PARTIAL')
        self.assertEqual(name_match('Jane Q. Doe', 'jane doe'), 'MATCH')  # a single initial is ignored
        self.assertEqual(name_match('Jane Doe', 'DOE, Jane'), 'MATCH')
        self.assertEqual(name_match('Ravi Kumar', 'Jane Doe'), 'MISMATCH')
        self.assertEqual(name_match(None, 'Jane Doe'), 'UNKNOWN')
        self.assertEqual(name_match('Jane Doe', ''), 'UNKNOWN')

    def test_derived_facts_hold_no_raw_personal_data(self):
        attrs = {'name': 'Jane Doe', 'account_type': 'personal', 'account_creation_date': '2026-11-09T00:00:00Z',
                 'address': {'country': 'us'}}
        facts = derive_paypal_facts(attrs, {'legal_name': 'Jane Doe', 'country': 'US'}, NOW)
        self.assertEqual(facts['name_match'], 'MATCH')
        self.assertEqual(facts['country_match'], 'MATCH')
        self.assertEqual(facts['account_type'], 'PERSONAL')
        self.assertIsInstance(facts['account_age_days'], int)
        self.assertNotIn('Jane', json.dumps(facts))

    def test_missing_or_bad_paypal_data_is_unknown_never_a_flag(self):
        for attrs in (None, {}, {'account_creation_date': 'not a date'}, {'account_creation_date': 'x', 'name': 5}):
            facts = derive_paypal_facts(attrs, {'legal_name': 'Jane Doe'}, NOW)
            self.assertIsNone(facts['account_age_days'])
            self.assertEqual(risk_findings({'paypal_facts': {'new': facts}}, None, POLICY, NOW), [])

    def test_provider_scopes_are_allowlisted(self):
        self.assertEqual(PayPal({'RESCUE_PAYPAL_SCOPES': 'openid profile address https://uri.paypal.com/services/paypalattributes'}).scopes,
                         'openid profile address https://uri.paypal.com/services/paypalattributes')
        for bad in ('openid email', 'profile', 'openid payments', 'openid https://evil.example/x', ''):
            self.assertEqual(PayPal({'RESCUE_PAYPAL_SCOPES': bad}).scopes, 'openid https://uri.paypal.com/services/paypalattributes', bad)


class FlagTest(unittest.TestCase):
    def codes(self, signals=None, facts=None, policy=POLICY):
        case = {'paypal_facts': {'new': facts}} if facts else {}
        return [f['code'] for f in risk_findings(case, signals, policy, NOW)]

    def test_windows_are_exact_and_clear_by_themselves(self):
        self.assertEqual(self.codes({'new_device_at': NOW - 23 * HOUR}), ['NEW_DEVICE_RECENT'])
        self.assertEqual(self.codes({'new_device_at': NOW - 25 * HOUR}), [])  # a new device a day ago is fine
        self.assertEqual(self.codes({'password_reset_at': NOW - 6 * DAY}), ['PASSWORD_RESET_RECENT'])
        self.assertEqual(self.codes({'password_reset_at': NOW - 8 * DAY}), [])
        self.assertEqual(self.codes({'country_change_at': NOW - 1 * DAY}), ['COUNTRY_CHANGE_RECENT'])
        self.assertEqual(self.codes({'last_destination_change_at': NOW - 29 * DAY}), ['DESTINATION_CHANGE_RECENT'])
        self.assertEqual(self.codes({'last_destination_change_at': None, 'new_device_at': None}), [])

    def test_future_or_junk_timestamps_never_flag(self):
        for bad in (NOW + 100, 'now', True, -5, None):
            self.assertEqual(self.codes({'new_device_at': bad, 'password_reset_at': bad}), [], repr(bad))

    def test_paypal_facts_flags(self):
        self.assertEqual(self.codes(facts={'account_age_days': 3}), ['PAYPAL_ACCOUNT_YOUNG'])
        self.assertEqual(self.codes(facts={'account_age_days': 400, 'name_match': 'MISMATCH'}), ['PAYPAL_NAME_MISMATCH'])
        self.assertEqual(self.codes(facts={'account_age_days': 400, 'name_match': 'PARTIAL'}), [])
        self.assertEqual(self.codes(facts={'country_match': 'MISMATCH'}), ['PAYPAL_COUNTRY_MISMATCH'])
        self.assertEqual(self.codes(facts={'country_match': 'UNKNOWN', 'name_match': 'UNKNOWN', 'account_age_days': None}), [])
        # name and country together are two flags, so they block approval
        self.assertTrue(is_blocked(risk_findings({'paypal_facts': {'new': {'name_match': 'MISMATCH', 'country_match': 'MISMATCH'}}}, None, POLICY, NOW)))

    def test_two_flags_block_one_does_not(self):
        one = risk_findings({}, {'new_device_at': NOW - HOUR}, POLICY, NOW)
        two = risk_findings({}, {'new_device_at': NOW - HOUR, 'password_reset_at': NOW - DAY}, POLICY, NOW)
        self.assertFalse(is_blocked(one))
        self.assertTrue(is_blocked(two))

    def test_windows_are_configurable_and_validated(self):
        wide = Policy(new_device_hours=72)
        self.assertEqual(self.codes({'new_device_at': NOW - 48 * HOUR}, policy=wide), ['NEW_DEVICE_RECENT'])
        with self.assertRaises(DestinationError):
            Policy(new_device_hours=0)
        self.assertEqual(Policy.configured({'RESCUE_SIGNAL_X': '1'}, 'demo').new_device_hours, 24)

    def test_signal_ages(self):
        ages = signal_ages({'new_device_at': NOW - 3 * HOUR, 'password_reset_at': None}, NOW)
        self.assertEqual(ages['new_device_hours_ago'], 3.0)
        self.assertIsNone(ages['password_reset_hours_ago'])


class RiskFlowTest(DestinationFixture, unittest.TestCase):
    def import_signals(self, **hours_ago):
        mapping = {'device': 'new_device_at', 'reset': 'password_reset_at', 'country': 'country_change_at', 'change': 'last_destination_change_at'}
        self.ds.provision_signals('t1', 's1', **{mapping[k]: self.now - v * HOUR for k, v in hours_ago.items()})

    def to_review(self):
        self.authenticate_destination()
        self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        return self.service.status(self.tokens['owner'], self.case_id)

    def evidence(self, version):
        return self.service.record_evidence(self.tokens['reviewer'], self.case_id, kind='SELLER_ENTITLEMENT', reference='rec-1',
                                            reason='Records confirm the seller', accepted=True, expected_version=version)

    def test_clear_signals_change_nothing(self):
        self.import_signals(device=500)
        view = self.evidence(self.to_review()['version'])
        approved = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'ok', view['version'])
        self.assertEqual(approved['state'], 'APPROVED_COOLING_OFF')
        self.assertAlmostEqual(approved['cooling_off']['ends_at'] - self.now, self.service.policy.cooling_seconds, delta=2)

    def test_one_flag_lengthens_the_wait(self):
        self.import_signals(device=2)
        view = self.evidence(self.to_review()['version'])
        approved = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'ok', view['version'])
        self.assertAlmostEqual(approved['cooling_off']['ends_at'] - self.now, self.service.policy.recovery_seconds, delta=2)

    def test_two_flags_block_approval_but_reject_still_works(self):
        self.import_signals(device=2, reset=20)
        view = self.evidence(self.to_review()['version'])
        with self.assertRaises(DestinationError) as ctx:
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'ok', view['version'])
        self.assertEqual((ctx.exception.code, ctx.exception.status), ('POLICY_BLOCKED', 409))
        seen = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertTrue(seen['risk_blocks_approval'])
        self.assertEqual(seen['risk_signals_source'], 'SIMULATED_FEED')
        self.assertEqual({f['code'] for f in seen['risk_findings']}, {'NEW_DEVICE_RECENT', 'PASSWORD_RESET_RECENT'})
        rejected = self.service.review(self.tokens['reviewer'], self.case_id, 'REJECT', 'Looks like a takeover', view['version'])
        self.assertEqual(rejected['state'], 'REJECTED')

    def test_blocked_case_unblocks_when_a_window_passes(self):
        self.import_signals(device=2, reset=20)
        view = self.evidence(self.to_review()['version'])
        self.assertTrue(self.service.status(self.tokens['reviewer'], self.case_id)['risk_blocks_approval'])
        self.now += 2 * DAY  # the 24 hour device window has passed. The 7 day password-reset window has not.
        seen = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertEqual([f['code'] for f in seen['risk_findings']], ['PASSWORD_RESET_RECENT'])
        self.assertFalse(seen['risk_blocks_approval'])
        approved = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'ok', seen['version'])
        self.assertEqual(approved['state'], 'APPROVED_COOLING_OFF')

    def test_flags_that_appear_during_the_wait_send_the_case_back_to_review(self):
        view = self.evidence(self.to_review()['version'])
        approved = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'ok', view['version'])
        self.assertEqual(approved['state'], 'APPROVED_COOLING_OFF')
        self.import_signals(device=1, reset=1)  # new events during the cooling-off
        self.now = approved['cooling_off']['ends_at'] + 1  # the wait is over: this is the activation check
        after = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(after['state'], 'PENDING_REVIEW')
        self.assertFalse(after['payout_control']['proposed_destination_usable'])

    def test_sellers_and_agents_never_see_flags_or_facts(self):
        self.import_signals(device=2, reset=20)
        self.to_review()
        for user in ('owner', 'staff', 'external'):
            view = self.service.status(self.tokens[user], self.case_id)
            for field in ('risk_findings', 'risk_blocks_approval', 'paypal_facts', 'risk_signals_source'):
                self.assertNotIn(field, view, user + field)
            with self.assertRaises(DestinationError):
                self.service.risk_audit(self.tokens[user], self.case_id)

    def test_callback_stores_only_derived_paypal_facts(self):
        with self.ds.connect() as db:
            payee = json.loads(db.execute("SELECT data FROM pg_payees WHERE tenant='t1' AND seller='s1'").fetchone()[0])
            payee.update(legal_name='Jane Doe', country='US')
            db.execute("UPDATE pg_payees SET data=? WHERE tenant='t1' AND seller='s1'", (json.dumps(payee),))
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        provider = Mock()
        provider.identity.return_value = {'payer_id': 'BBBBBBBBBBBBB', 'verified_account': True, 'attributes': {
            'name': 'Ravi Kumar', 'account_type': 'PERSONAL', 'account_creation_date': '2026-11-10T00:00:00Z', 'address': {'country': 'IN'}}}
        self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'https://example.test/cb')
        audit = self.service.risk_audit(self.tokens['reviewer'], self.case_id)
        facts = audit['paypal_facts']['new']
        self.assertEqual((facts['name_match'], facts['country_match']), ('MISMATCH', 'MISMATCH'))
        self.assertEqual({f['code'] for f in audit['findings']}, {'PAYPAL_NAME_MISMATCH', 'PAYPAL_COUNTRY_MISMATCH'})
        self.assertTrue(audit['blocks_approval'])
        with self.ds.connect() as db:
            stored = db.execute('SELECT data FROM pg_cases WHERE id=?', (self.case_id,)).fetchone()[0]
        self.assertNotIn('Ravi', stored)

    def test_signals_import_is_trusted_only(self):
        with self.assertRaises(DestinationError):
            self.ds.provision_signals('t1', 'missing-seller', new_device_at=1.0)
        with self.assertRaises(DestinationError):
            self.ds.provision_signals('t1', 's1', new_device_at='yesterday')
        with self.assertRaises(DestinationError):
            self.ds.provision_signals('t1', 's1', surprise=1.0)


class AiAuditToolTest(DestinationFixture, unittest.TestCase):
    def test_ai_review_reads_the_audit_and_cannot_change_the_case(self):
        self.ds.provision_signals('t1', 's1', new_device_at=self.now - HOUR, password_reset_at=self.now - 2 * HOUR)
        self.authenticate_destination()
        self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        before = self.service.status(self.tokens['reviewer'], self.case_id)
        model = Mock()
        model.invoke.side_effect = [AIMessage(content=json.dumps({
            'schema_version': '1', 'reason_category': 'NEW_ACCOUNT', 'claims': ['x'], 'risk_signals': [],
            'missing_information': [], 'follow_up_questions': [], 'recommendation': 'ESCALATE_FOR_REVIEW',
            'summary': 'Two flags fired.', 'advisory_only': True}))]
        runner = AiReviewRunner(self.service, FakePayoutProvider())
        run = runner.start(self.tokens['reviewer'], self.case_id, model)
        import time
        for _ in range(100):
            status = runner.status(self.tokens['reviewer'], self.case_id, run)
            if status['status'] != 'running':
                break
            time.sleep(0.05)
        done = [e for e in status['events'] if e['kind'] == 'tool_result' and e['label'] == 'get_account_audit'][0]
        self.assertIn('2 risk flag(s)', done['detail'])
        self.assertIn('approval is blocked', done['detail'])
        sent = ' '.join(str(m.content) for m in model.invoke.call_args.args[0])
        self.assertIn('NEW_DEVICE_RECENT', sent)
        self.assertIn('BACKEND_AND_PAYPAL_FACTS', sent)
        after = self.service.status(self.tokens['reviewer'], self.case_id)
        for field in ('state', 'version', 'destinations', 'payout_control'):
            self.assertEqual(before[field], after[field])
        # The model's summary did not mention the flags. The backend states them, labelled, in front of the AI text.
        saved = after['ai_assessment']['assessment']['summary']
        self.assertTrue(saved.startswith('Backend flags: '))
        self.assertIn('device', saved.lower())
        self.assertIn('password', saved.lower())
        self.assertIn('Two flags fired.', saved)
        self.assertLessEqual(len(saved), 1000)

    def test_clear_audit_adds_no_backend_flags_text(self):
        self.authenticate_destination()
        model = Mock()
        model.invoke.side_effect = [AIMessage(content=json.dumps({
            'schema_version': '1', 'reason_category': 'NEW_ACCOUNT', 'claims': ['x'], 'risk_signals': [],
            'missing_information': [], 'follow_up_questions': [], 'recommendation': 'CONTINUE_REQUIRED_VERIFICATION',
            'summary': 'Looks routine.', 'advisory_only': True}))]
        runner = AiReviewRunner(self.service, FakePayoutProvider())
        run = runner.start(self.tokens['reviewer'], self.case_id, model)
        import time
        for _ in range(100):
            if runner.status(self.tokens['reviewer'], self.case_id, run)['status'] != 'running':
                break
            time.sleep(0.05)
        summary = self.service.status(self.tokens['reviewer'], self.case_id)['ai_assessment']['assessment']['summary']
        self.assertEqual(summary, 'Looks routine.')


class SignalsCliTest(DestinationFixture, unittest.TestCase):
    def run_cli(self, *args):
        import contextlib, io
        from unittest.mock import patch
        from rescue.destination_admin import main
        with self.ds.connect() as db:
            if not db.execute("SELECT 1 FROM metadata WHERE key='mode'").fetchone():
                db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
        out = io.StringIO()
        with patch('sys.argv', ['admin', '--database', self.identity.path, '--mode', 'sandbox', *args]), \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            main()
        return out.getvalue()

    def test_signals_command_imports_simulated_feed_and_flags_follow(self):
        import time
        self.service.clock = time.time  # the command stamps real time, so read it back on the real clock
        output = self.run_cli('signals', '--tenant', 't1', '--seller', 's1', '--new-device-hours-ago', '3', '--password-reset-hours-ago', '20')
        self.assertIn('SIMULATED_FEED', output)
        audit = self.service.risk_audit(self.tokens['reviewer'], self.case_id)
        self.assertEqual(audit['marketplace_signals_source'], 'SIMULATED_FEED')
        self.assertAlmostEqual(audit['marketplace_signals']['new_device_hours_ago'], 3.0, delta=0.1)
        self.assertIsNone(audit['marketplace_signals']['country_change_hours_ago'])

    def test_unknown_seller_is_refused(self):
        with self.assertRaises(DestinationError):
            self.run_cli('signals', '--tenant', 't1', '--seller', 'nobody', '--new-device-hours-ago', '1')


if __name__ == '__main__':
    unittest.main()
