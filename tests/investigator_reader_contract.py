"""Reusable contract for any real CaseReader (TASK-050). Codex: subclass and implement the
factory methods, e.g. `class RealReaderContract(CaseReaderContract, unittest.TestCase)`.

The reader must be bound to ONE tenant/seller/case at construction and expose only
`snapshot()` and `seller_messages()`. The investigator never passes a scope."""
import json
import re
from unittest.mock import Mock
from rescue.investigator import investigate

REQUIRED_SNAPSHOT_KEYS = {'state', 'policy_decision', 'authentication', 'marketplace_review'}
_SECRET = re.compile(r'access_token|oauth_state|client_secret|session_cookie|password', re.I)
_RAW_PAYER = re.compile(r'\b[A-Z0-9]{13}\b')


class CaseReaderContract:
    def make_reader(self):
        """Reader bound to a valid, existing case. Its snapshot may use masked IDs only."""
        raise NotImplementedError

    def make_reader_for_missing_case(self):
        """Reader bound to a case that does not exist or belongs to another seller/tenant."""
        raise NotImplementedError

    def test_public_surface_is_read_only_and_scope_free(self):
        public = {n for n in dir(self.make_reader()) if not n.startswith('_') and callable(getattr(self.make_reader(), n))}
        self.assertEqual(public, {'snapshot', 'seller_messages'})
        import inspect
        for name in public:
            self.assertEqual(list(inspect.signature(getattr(self.make_reader(), name)).parameters), [])

    def test_snapshot_shape_and_masking(self):
        snapshot = self.make_reader().snapshot()
        self.assertTrue(REQUIRED_SNAPSHOT_KEYS <= set(snapshot))
        text = json.dumps(snapshot)
        self.assertIsNone(_SECRET.search(text))
        self.assertIsNone(_RAW_PAYER.search(text), 'raw payer ID in snapshot; mask it')

    def test_seller_messages_are_plain_strings(self):
        messages = self.make_reader().seller_messages()
        self.assertIsInstance(messages, list)
        self.assertTrue(all(isinstance(m, str) for m in messages))

    def test_missing_or_foreign_case_fails_safe(self):
        reader = self.make_reader_for_missing_case()
        model = Mock()
        result = investigate(reader, 'help me', model)
        self.assertEqual(result['assessment']['status'], 'UNAVAILABLE')
        self.assertEqual(result['effective_recommendation'], 'ESCALATE_FOR_REVIEW')
        model.invoke.assert_not_called()
