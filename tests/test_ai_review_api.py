import time
import unittest
from unittest.mock import Mock
from test_destination_api import APIHarness
from test_destination_assessment import model_result


class AiReviewAPITest(APIHarness, unittest.TestCase):
    def test_seller_guide_needs_manage_and_a_clean_body(self):
        msgs = {'messages': [{'role': 'user', 'text': 'I opened a new PayPal account'}]}
        self.app.destination_api.model = Mock()
        self.app.destination_api.model.invoke.return_value = Mock(content='What is your main reason?')
        status, body = self.request('POST', '/api/v1/seller-guide', msgs, user='owner')
        self.assertEqual((status, body['source']), (200, 'ai'))
        self.assertEqual(body['reply'], 'What is your main reason?')
        for user in ('reviewer', 'staff'):  # no manage permission
            self.assertEqual(self.request('POST', '/api/v1/seller-guide', msgs, user=user)[0], 403, user)
        for bad in ({'messages': []}, {'messages': 'hi'}, {'messages': msgs['messages'], 'case_id': 'x'}, {}):
            self.assertEqual(self.request('POST', '/api/v1/seller-guide', bad, user='owner')[0], 400, str(bad))
        self.assertEqual(self.request('POST', '/api/v1/seller-guide', msgs, user=None, csrf=False)[0], 401)

    def test_seller_guide_without_a_working_model_still_answers(self):
        self.app.destination_api.model = Mock()
        self.app.destination_api.model.invoke.side_effect = RuntimeError('down')
        status, body = self.request('POST', '/api/v1/seller-guide', {'messages': [{'role': 'user', 'text': 'hello'}]})
        self.assertEqual((status, body['source']), (200, 'scripted'))

    def test_ai_review_is_for_browser_reviewers_only_and_cannot_change_the_case(self):
        before = self.request('GET', self.path, user='reviewer')[1]
        for user in ('owner', 'staff', 'external'):
            self.assertEqual(self.request('POST', self.path + '/ai-review', {}, user=user)[0], 403, user)
        status, started = self.request('POST', self.path + '/ai-review', {}, user='reviewer')
        self.assertEqual(status, 200)
        run = started['run_id']
        for _ in range(100):
            status, state = self.request('GET', self.path + '/ai-review/' + run, user='reviewer')
            if state['status'] != 'running':
                break
            time.sleep(0.05)
        self.assertEqual((status, state['status']), (200, 'done'))
        self.assertEqual(state['events'][-1]['kind'], 'final')
        self.assertEqual(self.request('GET', self.path + '/ai-review/' + run, user='owner')[0], 403)
        after = self.request('GET', self.path, user='reviewer')[1]
        for field in ('state', 'version', 'destinations', 'payout_control'):
            self.assertEqual(before[field], after[field], field)
        self.assertIsNotNone(after['ai_assessment'])
        # sellers still never see the assessment
        self.assertIsNone(self.request('GET', self.path, user='owner')[1]['ai_assessment'])

    def test_unknown_ai_review_routes_are_not_found(self):
        self.assertEqual(self.request('GET', self.path + '/ai-review', user='reviewer')[0], 404)
        self.assertEqual(self.request('POST', self.path + '/ai-review/' + 'a' * 32, {}, user='reviewer')[0], 404)
        self.assertEqual(self.request('POST', self.path + '/ai-review', {'case_id': 'x'}, user='reviewer')[0], 400)


if __name__ == '__main__':
    unittest.main()


class EvidenceRouteTest(APIHarness, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.authenticate_destination()
        self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        self.view = self.request('GET', self.path, user='reviewer')[1]
        self.body = {'kind': 'SELLER_ENTITLEMENT', 'reference': 'order-history-77', 'reason': 'Matches marketplace records',
                     'accepted': True, 'expected_version': self.view['version']}

    def test_only_a_browser_reviewer_can_record_evidence(self):
        for user in ('owner', 'staff', 'external', 'other', 'tenant'):
            self.assertIn(self.request('POST', self.path + '/evidence', self.body, user=user)[0], (403, 404), user)
        status, view = self.request('POST', self.path + '/evidence', self.body, user='reviewer')
        self.assertEqual(status, 200)
        self.assertEqual(view['version'], self.body['expected_version'] + 1)
        self.assertEqual(view['state'], 'PENDING_REVIEW')

    def test_evidence_unlocks_approval_and_a_rejection_blocks_it(self):
        self.assertEqual(self.request('POST', self.path + '/review', {'decision': 'APPROVE', 'reason': 'ok',
                         'expected_version': self.view['version']}, user='reviewer')[0], 409)  # no evidence yet
        status, view = self.request('POST', self.path + '/evidence', dict(self.body, accepted=False), user='reviewer')
        self.assertEqual(status, 200)
        status, body = self.request('POST', self.path + '/review', {'decision': 'APPROVE', 'reason': 'ok',
                                    'expected_version': view['version']}, user='reviewer')
        self.assertEqual((status, body['error']['code']), (409, 'POLICY_REVIEW_REQUIRED'))  # evidence does not confirm

    def test_bad_bodies_and_stale_versions_are_refused(self):
        for bad in (dict(self.body, kind='MADE_UP'), dict(self.body, accepted='yes'), dict(self.body, extra=1),
                    {k: v for k, v in self.body.items() if k != 'reason'}):
            self.assertEqual(self.request('POST', self.path + '/evidence', bad, user='reviewer')[0], 400, str(bad))
        self.assertEqual(self.request('POST', self.path + '/evidence', dict(self.body, expected_version=1), user='reviewer')[0], 409)
