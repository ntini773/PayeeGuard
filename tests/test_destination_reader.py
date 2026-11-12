import json
import unittest
from unittest.mock import Mock
from destination_fixtures import DestinationFixture
from investigator_reader_contract import CaseReaderContract
from rescue.destination_errors import DestinationError
from rescue.destination_reader import BackendCaseReader
from rescue.investigator import investigate


class RealReaderContract(DestinationFixture, CaseReaderContract, unittest.TestCase):
    def make_reader(self):
        return BackendCaseReader(self.service, self.tokens['owner'], self.case_id)

    def make_reader_for_missing_case(self):
        return BackendCaseReader(self.service, self.tokens['owner'], 'missing')

    def test_foreign_seller_and_tenant_fail_before_model(self):
        for user in ('other', 'tenant'):
            reader = BackendCaseReader(self.service, self.tokens[user], self.case_id)
            with self.assertRaises(DestinationError):
                reader.snapshot()
            with self.assertRaises(DestinationError):
                reader.seller_messages()
            model = Mock()
            self.assertEqual(investigate(reader, 'help', model)['assessment']['status'], 'UNAVAILABLE')
            model.invoke.assert_not_called()

    def test_scope_rebinding_and_logout_invalidate_reader(self):
        reader = self.make_reader()
        self.ds.provision_grant('owner', 't2', 's1', manage=True)
        with self.assertRaises(DestinationError):
            reader.snapshot()
        self.identity.logout(self.tokens['owner'])
        with self.assertRaises(DestinationError):
            reader.seller_messages()

    def test_missing_payee_is_not_fabricated(self):
        with self.ds.connect() as db:
            db.execute('DELETE FROM pg_payees WHERE tenant=? AND seller=?', ('t1', 's1'))
        model = Mock()
        result = investigate(self.make_reader(), 'help', model)
        self.assertEqual(result['assessment']['status'], 'UNAVAILABLE')
        model.invoke.assert_not_called()

    def test_reader_masks_messages_and_contains_no_previous_ai_output(self):
        with self.ds.connect() as db:
            p = self.ds.principal(self.tokens['owner'])
            case = self.ds.case(db, p, self.case_id)
            case['messages'] = ['account AAAAAAAAAAAAA; client_secret=synthetic-secret']
            self.ds.save(db, p, case, case['version'])
        messages = json.dumps(self.make_reader().seller_messages())
        self.assertNotIn('AAAAAAAAAAAAA', messages)
        self.assertNotIn('synthetic-secret', messages)
        self.assertNotIn('ai_assessment', self.make_reader().snapshot())
