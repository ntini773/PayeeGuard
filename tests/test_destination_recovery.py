import unittest
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError


class RecoveryTest(DestinationFixture, unittest.TestCase):
    def test_lost_old_requires_trusted_recovery_and_longer_cooling(self):
        self.authenticate_destination()
        view = self.service.recovery(self.tokens['owner'], self.case_id, 'I lost the old login')
        with self.assertRaises(DestinationError):
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'claim alone', view['version'])
        view = self.service.record_evidence(self.tokens['reviewer'], self.case_id, kind='ACCOUNT_RECOVERY',
            reference='trusted-record', reason='Marketplace record reviewed', accepted=True, expected_version=view['version'])
        view = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'recovery reviewed', view['version'])
        self.assertEqual(view['cooling_off']['ends_at'] - self.now, 7 * 86400)
        with self.ds.connect() as db:
            case = self.ds.case(db, self.ds.principal(self.tokens['owner']), self.case_id)
            self.assertEqual(case['old_contact_notice'], 'REQUIRED_NOT_SENT')

    def test_risk_signal_reopens_and_pauses_active_payout(self):
        view = self.approve()
        view = self.service.set_compromise(self.tokens['reviewer'], self.case_id, compromised=True,
                                           reason='Marketplace investigation', expected_version=view['version'])
        self.assertEqual(view['state'], 'PENDING_REVIEW')
        self.assertTrue(view['payout_control']['active_destination_paused'])
        with self.assertRaises(DestinationError):
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'still risky', view['version'])

    def test_rejected_evidence_revision_supersedes_previous_acceptance(self):
        view = self.ready_for_review()
        view = self.service.record_evidence(self.tokens['reviewer'], self.case_id,
            kind='SELLER_ENTITLEMENT', reference='marketplace-record-1', reason='Record was invalidated',
            accepted=False, expected_version=view['version'])
        with self.assertRaises(DestinationError) as error:
            self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'old evidence is insufficient', view['version'])
        self.assertEqual(error.exception.code, 'POLICY_REVIEW_REQUIRED')
        view = self.service.record_evidence(self.tokens['reviewer'], self.case_id,
            kind='SELLER_ENTITLEMENT', reference='marketplace-record-1', reason='Corrected record independently verified',
            accepted=True, expected_version=view['version'])
        approved = self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'corrected evidence reviewed', view['version'])
        self.assertEqual(approved['state'], 'APPROVED_COOLING_OFF')
