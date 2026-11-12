import unittest
from unittest.mock import Mock
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError


class OAuthTest(DestinationFixture, unittest.TestCase):
    def test_new_login_and_old_match_do_not_activate_or_approve(self):
        new = self.authenticate_destination()
        self.assertEqual(new['state'], 'PENDING_OLD_ACCOUNT_AUTH')
        self.assertEqual(new['destinations']['active']['masked_payer_id'], '***-AAAA')
        old = self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        self.assertEqual(old['state'], 'PENDING_REVIEW')
        self.assertIsNone(old['marketplace_review']['decision'])
        self.assertFalse(old['payout_control']['proposed_destination_usable'])

    def test_wrong_old_account_requires_recovery_evidence(self):
        self.authenticate_destination()
        view = self.authenticate_destination('OLD', 'BBBBBBBBBBBBB')
        self.assertEqual(view['authentication']['old_account']['status'], 'NOT_MATCHED')
        with self.assertRaises(DestinationError):
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'attempt', view['version'])

    def test_same_id_completes_without_destination_mutation(self):
        view = self.authenticate_destination(payer='AAAAAAAAAAAAA')
        self.assertEqual(view['state'], 'ACTIVE')
        self.assertEqual(view['policy_decision'], 'ALLOW_NO_CHANGE')
        with self.ds.connect() as db:
            self.assertEqual(self.ds.payee(db, self.ds.principal(self.tokens['owner']))['version'], 1)

    def test_callback_replay_and_scope_mixups_never_exchange_code(self):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        provider = Mock()
        provider.identity.return_value = {'payer_id': 'BBBBBBBBBBBBB', 'verified_account': True}
        for user, case, purpose in [('other', self.case_id, 'NEW'), ('tenant', self.case_id, 'NEW'),
                                    ('owner', 'wrong-case', 'NEW'), ('owner', self.case_id, 'OLD')]:
            with self.assertRaises(DestinationError):
                self.service.callback(self.tokens[user], case, purpose, state, 'code', provider, 'redirect')
        provider.identity.assert_not_called()
        self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'redirect')
        with self.assertRaises(DestinationError):
            self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'redirect')
        self.assertEqual(provider.identity.call_count, 1)

    def test_expiry_wrong_session_and_stale_case(self):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        provider = Mock()
        other_session = self.identity.login('owner', 'fixture-password')
        with self.assertRaises(DestinationError):
            self.service.callback(other_session, self.case_id, 'NEW', state, 'code', provider, 'redirect')
        self.now += 601
        with self.assertRaises(DestinationError):
            self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'redirect')
        provider.identity.assert_not_called()

    def test_provider_failure_consumes_state_and_never_leaks_error(self):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        provider = Mock()
        provider.identity.side_effect = RuntimeError('private-provider-value')
        for _ in range(2):
            with self.assertRaises(DestinationError) as error:
                self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'redirect')
            self.assertNotIn('private-provider-value', str(error.exception))
        self.assertEqual(provider.identity.call_count, 1)
        self.assertFalse(self.service.status(self.tokens['owner'], self.case_id)['payout_control']['proposed_destination_usable'])

    def test_case_changes_during_exchange_reject_stale_evidence(self):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        provider = Mock()
        def exchange(*_):
            self.service.message(self.tokens['owner'], self.case_id, 'new material information', 'during-exchange')
            return {'payer_id': 'BBBBBBBBBBBBB', 'verified_account': True}
        provider.identity.side_effect = exchange
        with self.assertRaises(DestinationError) as error:
            self.service.callback(self.tokens['owner'], self.case_id, 'NEW', state, 'code', provider, 'redirect')
        self.assertEqual(error.exception.code, 'CASE_VERSION_CONFLICT')
        view = self.service.status(self.tokens['owner'], self.case_id)
        self.assertIsNone(view['destinations']['proposed']['masked_payer_id'])
        self.assertEqual(view['destinations']['active']['masked_payer_id'], '***-AAAA')

    def test_foreign_callback_denial_is_audited_in_callers_scope(self):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')
        with self.assertRaises(DestinationError):
            self.service.callback(self.tokens['other'], self.case_id, 'NEW', state, 'code', Mock(), 'redirect')
        with self.ds.connect() as db:
            event = db.execute("SELECT tenant,seller,actor,data FROM pg_events WHERE event='AUTHORIZATION_DENIED' ORDER BY seq DESC LIMIT 1").fetchone()
        self.assertEqual(tuple(event)[:3], ('t1', 's2', 'other'))
        self.assertNotIn(state, event['data'])

    def test_old_mismatch_hint_is_reviewer_only(self):
        self.authenticate_destination()
        seller = self.authenticate_destination('OLD', 'BBBBBBBBBBBBB')
        reviewer = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertEqual(seller['reviewer_findings'], [])
        self.assertIn('OLD_ACCOUNT_MISMATCH', reviewer['reviewer_findings'])
        self.assertEqual(reviewer['state'], 'PENDING_REVIEW')
