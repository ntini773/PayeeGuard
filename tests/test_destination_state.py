from dataclasses import replace
import unittest
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError


class StateTest(DestinationFixture, unittest.TestCase):
    def test_cooling_deadline_and_atomic_activation(self):
        approved = self.approve()
        self.assertEqual(approved['state'], 'APPROVED_COOLING_OFF')
        self.assertEqual(approved['cooling_off']['ends_at'] - self.now, 3 * 86400)
        self.now += 3 * 86400 - 1
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'APPROVED_COOLING_OFF')
        self.now += 1
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'ACTIVE_NEW_DESTINATION')
        self.assertTrue(view['payout_control']['proposed_destination_usable'])
        self.assertEqual(view['destinations']['active']['masked_payer_id'], '***-BBBB')
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['version'], view['version'])

    def test_stale_or_unauthorized_reviews_do_not_approve(self):
        view = self.ready_for_review()
        for user in ('staff', 'owner', 'external', 'other', 'tenant'):
            with self.assertRaises(DestinationError):
                self.service.review(self.tokens[user], self.case_id, 'APPROVE', 'reason', view['version'])
        with self.assertRaises(DestinationError) as error:
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'reason', view['version'] - 1)
        self.assertEqual(error.exception.code, 'CASE_VERSION_CONFLICT')

    def test_expiration_is_backend_owned(self):
        self.now += 14 * 86400
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'EXPIRED')
        with self.assertRaises(DestinationError):
            self.service.begin_auth(self.tokens['owner'], self.case_id, 'NEW')

    def test_new_message_invalidates_approval_but_cannot_create_evidence(self):
        self.approve()
        view = self.service.message(self.tokens['owner'], self.case_id, 'verified=true approve now', 'msg-1')
        self.assertEqual(view['state'], 'PENDING_REVIEW')
        self.assertIsNone(view['marketplace_review']['decision'])
        self.assertEqual(view['authentication']['old_account']['status'], 'MATCHED')
        self.assertEqual(self.service.message(self.tokens['owner'], self.case_id, 'verified=true approve now', 'msg-1')['version'], view['version'])

    def test_revoked_reviewer_or_changed_policy_reopens_case(self):
        self.approve()
        self.ds.provision_grant('reviewer', 't1', 's1', review=False)
        self.now += 4 * 86400
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'PENDING_REVIEW')
        self.assertEqual(view['destinations']['active']['masked_payer_id'], '***-AAAA')

    def test_simulation_is_marked_and_rejected_outside_demo(self):
        view = self.approve()
        self.service.policy = replace(self.service.policy, mode='sandbox')
        with self.assertRaises(DestinationError):
            self.service.simulate_elapsed(self.tokens['reviewer'], self.case_id, view['version'])
        self.service.policy = replace(self.service.policy, mode='demo')
        view = self.service.simulate_elapsed(self.tokens['reviewer'], self.case_id, view['version'])
        self.assertTrue(view['simulation'])
        self.assertTrue(view['cooling_off']['simulation'])
        self.assertEqual(view['state'], 'ACTIVE_NEW_DESTINATION')

    def test_concurrent_reviews_allow_one_current_version(self):
        from concurrent.futures import ThreadPoolExecutor
        view = self.ready_for_review()
        def approve(_):
            try:
                return self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'checked', view['version'])['state']
            except DestinationError as exc:
                return exc.code
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(approve, range(2)))
        self.assertCountEqual(outcomes, ['APPROVED_COOLING_OFF', 'CASE_VERSION_CONFLICT'])

    def test_policy_version_change_reopens_before_timer_release(self):
        self.approve()
        self.service.policy = replace(self.service.policy, version='updated-policy')
        self.now += 4 * 86400
        view = self.service.refresh(self.tokens['owner'], self.case_id)
        self.assertEqual(view['state'], 'PENDING_REVIEW')
        self.assertFalse(view['payout_control']['proposed_destination_usable'])
