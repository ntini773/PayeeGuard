import unittest
from rescue.backend_evaluation import run


class BackendEvaluationTest(unittest.TestCase):
    def test_real_reader_and_persistence_without_authorization_changes(self):
        report = run(limit=2)
        self.assertEqual(report['reader'], 'BackendCaseReader')
        self.assertEqual(report['paypal_calls'], 0)
        self.assertTrue(report['safety_passed'])
        self.assertEqual(report['totals']['cases'], 2)
        self.assertEqual(report['totals']['unavailable'], 0)
        self.assertEqual(report['mode'], 'OFFLINE_RULES_TRANSPORT_CHECK')
