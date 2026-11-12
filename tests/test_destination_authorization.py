import json
import unittest
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError


class AuthorizationTest(DestinationFixture, unittest.TestCase):
    def test_legacy_operator_role_does_not_grant_destination_management(self):
        self.assertEqual(self.identity.session(self.tokens['staff'])['role'], 'operator')
        with self.assertRaises(DestinationError) as error:
            self.service.create(self.tokens['staff'], {'reason_text': 'change'}, 'staff-1')
        self.assertEqual(error.exception.status, 403)
        with self.ds.connect() as db:
            event = db.execute("SELECT actor,data FROM pg_events WHERE event='AUTHORIZATION_DENIED' ORDER BY seq DESC LIMIT 1").fetchone()
        self.assertEqual(event['actor'], 'staff')
        self.assertNotIn(self.tokens['staff'], event['data'])

    def test_caller_authority_and_scope_fields_rejected_and_audited(self):
        for field in ('role', 'manage', 'approved', 'tenant_id', 'seller_id', 'payer_id', 'verified'):
            with self.assertRaises(DestinationError) as error:
                self.service.create(self.tokens['owner'], {'reason_text': 'change', field: True}, 'fake')
            self.assertEqual(error.exception.code, 'INVALID_REQUEST')
        with self.ds.connect() as db:
            count = db.execute("SELECT count(*) FROM pg_events WHERE event='AUTHORIZATION_DENIED'").fetchone()[0]
        self.assertEqual(count, 7)

    def test_idempotency_payload_conflict_and_scope(self):
        same = self.service.create(self.tokens['owner'], {'reason_text': 'I opened a new account'}, 'request-1')
        self.assertEqual(same['case_id'], self.case_id)
        with self.assertRaises(DestinationError) as error:
            self.service.create(self.tokens['owner'], {'reason_text': 'different'}, 'request-1')
        self.assertEqual(error.exception.code, 'IDEMPOTENCY_CONFLICT')
        other = self.service.create(self.tokens['other'], {'reason_text': 'change'}, 'request-1')
        self.assertNotEqual(other['case_id'], self.case_id)

    def test_revoked_grant_is_checked_on_next_request(self):
        self.ds.provision_grant('owner', 't1', 's1')
        with self.assertRaises(DestinationError):
            self.service.create(self.tokens['owner'], {'reason_text': 'change'}, 'another')

    def test_external_channel_cannot_have_review_permission(self):
        with self.assertRaises(DestinationError):
            self.ds.provision_grant('external', 't1', 's1', manage=True, review=True, channel='external')
        with self.assertRaises(DestinationError):
            self.ds.principal(self.tokens['external'], 'review')

    def test_audit_and_assessments_are_append_only(self):
        with self.ds.connect() as db:
            with self.assertRaises(Exception):
                db.execute('DELETE FROM pg_events')
