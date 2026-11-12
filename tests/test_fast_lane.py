import json
import unittest
from unittest.mock import Mock
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError
from rescue.destination_policy import Policy
from rescue.destination_risk import fast_lane_status, sampled_for_review
from rescue.destination_service import AUTO_ACTOR, DestinationService

HOUR, DAY = 3600, 86400


class FastLaneBase(DestinationFixture):
    percent = 0
    fast = True

    def setUp(self):
        super().setUp()
        self.service = DestinationService(self.ds, clock=lambda: self.now,
                                          policy=Policy(fast_lane=self.fast, fast_lane_sample_percent=self.percent))
        # a fresh case on the new service, so every call uses the same policy version
        with self.ds.connect() as db:
            db.execute("DELETE FROM pg_cases")
            db.execute("DELETE FROM pg_requests")
            payee = json.loads(db.execute("SELECT data FROM pg_payees WHERE tenant='t1' AND seller='s1'").fetchone()[0])
            payee.update(legal_name='Jane Doe', country='US')
            db.execute("UPDATE pg_payees SET data=? WHERE tenant='t1' AND seller='s1'", (json.dumps(payee),))
        self.case_id = self.service.create(self.tokens['owner'], {'reason_text': 'I opened a new account'}, 'request-fast')['case_id']

    def login(self, purpose, payer, attributes=None):
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, purpose)
        provider = Mock()
        provider.identity.return_value = {'payer_id': payer, 'verified_account': True, 'attributes': attributes or {}}
        return self.service.callback(self.tokens['owner'], self.case_id, purpose, state, 'code', provider, 'https://example.test/cb')

    def both_logins(self, name='Jane Doe', country='US'):
        self.login('NEW', 'BBBBBBBBBBBBB', {'name': name, 'address': {'country': country}})
        return self.login('OLD', 'AAAAAAAAAAAAA')

    def feed(self, confirmed=True, **hours_ago):
        mapping = {'device': 'new_device_at', 'reset': 'password_reset_at'}
        self.ds.provision_signals('t1', 's1', entitlement_confirmed=confirmed, **{mapping[k]: self.now - v * HOUR for k, v in hours_ago.items()})

    def reviewer(self):
        return self.service.status(self.tokens['reviewer'], self.case_id)


class FastLaneOnTest(FastLaneBase, unittest.TestCase):
    def test_a_clean_case_is_approved_by_rules_and_the_wait_still_runs(self):
        self.feed()
        self.both_logins()
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'APPROVED_COOLING_OFF')
        self.assertFalse(view['payout_control']['proposed_destination_usable'])  # not paid to the new account yet
        review = self.service.status(self.tokens['reviewer'], self.case_id)['marketplace_review']
        self.assertEqual((review['decision'], review['actor']), ('APPROVED', AUTO_ACTOR))
        self.assertAlmostEqual(view['cooling_off']['ends_at'] - self.now, self.service.policy.cooling_seconds, delta=2)
        events = {e['event']: e for e in self.service.events(self.tokens['reviewer'], self.case_id)}
        self.assertIn('DESTINATION_CHANGE_AUTO_APPROVED', events)
        self.assertEqual(events['DESTINATION_CHANGE_AUTO_APPROVED']['actor'], AUTO_ACTOR)
        self.now += self.service.policy.cooling_seconds + 1
        done = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(done['state'], 'ACTIVE_NEW_DESTINATION')
        self.assertTrue(done['payout_control']['proposed_destination_usable'])

    def test_every_missing_condition_falls_back_to_manual_review(self):
        cases = {
            'NAME_NOT_CONFIRMED': lambda: (self.feed(), self.both_logins(name='Ravi Kumar')),
            'COUNTRY_NOT_CONFIRMED': lambda: (self.feed(), self.both_logins(country='IN')),
            'ENTITLEMENT_NOT_CONFIRMED': lambda: (self.feed(confirmed=False), self.both_logins()),
            'RISK_FLAGS_PRESENT': lambda: (self.feed(device=2), self.both_logins()),
        }
        for expected, arrange in cases.items():
            with self.subTest(expected):
                self.setUp()
                arrange()
                view = self.service.refresh(self.tokens['owner'], self.case_id)
                self.assertEqual(view['state'], 'PENDING_REVIEW', expected)
                self.assertIn(expected, self.reviewer()['fast_lane']['missing'])
                self.assertFalse(self.reviewer()['fast_lane']['eligible'])

    def test_no_feed_row_means_no_fast_lane(self):
        self.both_logins()
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'PENDING_REVIEW')
        self.assertIn('ENTITLEMENT_NOT_CONFIRMED', self.reviewer()['fast_lane']['missing'])

    def test_unverified_old_account_never_qualifies(self):
        self.feed()
        self.login('NEW', 'BBBBBBBBBBBBB', {'name': 'Jane Doe', 'address': {'country': 'US'}})
        self.service.recovery(self.tokens['owner'], self.case_id, 'Lost the old login')
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'PENDING_REVIEW')
        self.assertIn('BOTH_ACCOUNTS_NOT_VERIFIED', self.reviewer()['fast_lane']['missing'])

    def test_a_rejected_evidence_record_blocks_the_fast_lane(self):
        self.feed(confirmed=False)
        self.both_logins()
        version = self.reviewer()['version']
        self.service.record_evidence(self.tokens['reviewer'], self.case_id, kind='SELLER_ENTITLEMENT', reference='r1',
                                     reason='Records do not support it', accepted=False, expected_version=version, source='HOST_CONSOLE')
        self.feed()  # even if the feed later says confirmed, a recorded rejection stands
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'PENDING_REVIEW')
        self.assertIn('EVIDENCE_REJECTED', self.reviewer()['fast_lane']['missing'])

    def test_a_flag_that_appears_during_the_wait_sends_the_case_back_to_a_person(self):
        self.feed()
        self.both_logins()
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'APPROVED_COOLING_OFF')
        self.feed(device=1, reset=1)
        self.now = view['cooling_off']['ends_at'] + 1
        after = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(after['state'], 'PENDING_REVIEW')
        self.assertFalse(after['payout_control']['proposed_destination_usable'])

    def test_sellers_and_agents_never_see_fast_lane_status(self):
        self.feed()
        self.both_logins()
        for user in ('owner', 'staff', 'external'):
            self.assertNotIn('fast_lane', self.service.status(self.tokens[user], self.case_id), user)

    def test_the_ai_audit_reports_the_fast_lane_status(self):
        self.feed(device=2)
        self.both_logins()
        audit = self.service.risk_audit(self.tokens['reviewer'], self.case_id)
        self.assertEqual(audit['fast_lane']['missing'], ['RISK_FLAGS_PRESENT'])


class SeedAndSampleTest(FastLaneBase, unittest.TestCase):
    percent = 100

    def test_sampling_sends_a_clean_case_to_a_person_and_says_so(self):
        self.feed()
        self.both_logins()
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'PENDING_REVIEW')
        status = self.reviewer()['fast_lane']
        self.assertEqual(status['missing'], ['SAMPLED_FOR_REVIEW'])
        self.assertTrue(status['sampled'])

    def test_sampling_is_deterministic_and_roughly_proportional(self):
        self.assertEqual(sampled_for_review('chg_x', 10), sampled_for_review('chg_x', 10))
        hits = sum(sampled_for_review('chg_%d' % i, 10) for i in range(2000))
        self.assertTrue(120 < hits < 280, hits)
        self.assertFalse(any(sampled_for_review('chg_%d' % i, 0) for i in range(200)))
        self.assertTrue(all(sampled_for_review('chg_%d' % i, 100) for i in range(200)))


class FastLaneOffTest(FastLaneBase, unittest.TestCase):
    fast = False

    def test_off_by_default_every_case_waits_for_a_person(self):
        self.feed()
        self.both_logins()
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'PENDING_REVIEW')
        self.assertEqual(self.reviewer()['fast_lane']['missing'], ['FAST_LANE_OFF'])


class PolicyAndCancelTest(FastLaneBase, unittest.TestCase):
    def test_configuration_is_validated_and_never_on_in_production(self):
        self.assertTrue(Policy.configured({'RESCUE_FAST_LANE': 'on'}, 'sandbox').fast_lane)
        self.assertFalse(Policy.configured({}, 'sandbox').fast_lane)
        self.assertEqual(Policy.configured({'RESCUE_FAST_LANE_SAMPLE_PERCENT': '25'}, 'demo').fast_lane_sample_percent, 25)
        for bad in ('-1', '101', 'ten'):
            with self.assertRaises(DestinationError):
                Policy.configured({'RESCUE_FAST_LANE_SAMPLE_PERCENT': bad}, 'demo')
        with self.assertRaises(DestinationError):
            Policy(mode='production', fast_lane=True, production_configured=True, version='prod-1')

    def test_the_seller_can_cancel_a_waiting_request_and_payouts_stay_on_the_old_account(self):
        self.feed()
        self.both_logins()
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'APPROVED_COOLING_OFF')
        cancelled = self.service.cancel(self.tokens['owner'], self.case_id)
        self.assertEqual(cancelled['state'], 'REJECTED')
        self.assertFalse(cancelled['payout_control']['proposed_destination_usable'])
        self.now += 10 * DAY
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'REJECTED')
        names = [e['event'] for e in self.service.events(self.tokens['reviewer'], self.case_id)]
        self.assertIn('DESTINATION_CHANGE_CANCELLED_BY_SELLER', names)

    def test_cancel_needs_manage_and_a_live_request(self):
        for user in ('staff', 'reviewer'):
            with self.assertRaises(DestinationError, msg=user):
                self.service.cancel(self.tokens[user], self.case_id)
        self.service.cancel(self.tokens['owner'], self.case_id)
        with self.assertRaises(DestinationError) as ctx:
            self.service.cancel(self.tokens['owner'], self.case_id)
        self.assertEqual(ctx.exception.status, 409)


if __name__ == '__main__':
    unittest.main()
