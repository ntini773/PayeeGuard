import json
import unittest
from unittest.mock import Mock
from langchain_core.messages import AIMessage
from destination_fixtures import DestinationFixture
from rescue.destination_errors import DestinationError


def model_result(**changes):
    data = {'schema_version': '1', 'reason_category': 'NEW_ACCOUNT', 'claims': ['opened account'],
            'risk_signals': [], 'missing_information': ['NEW_ACCOUNT_AUTH'], 'follow_up_questions': [],
            'recommendation': 'CONTINUE_REQUIRED_VERIFICATION', 'summary': 'Complete the required checks.',
            'advisory_only': True}
    data.update(changes)
    return AIMessage(content=json.dumps(data))


class AssessmentTest(DestinationFixture, unittest.TestCase):
    def test_real_investigator_result_is_persisted_without_authority(self):
        model = Mock()
        model.invoke.return_value = model_result()
        view = self.service.assess(self.tokens['owner'], self.case_id, model)
        view = self.service.status(self.tokens['reviewer'], self.case_id)
        ai = view['ai_assessment']
        self.assertEqual(ai['assessment']['status'], 'AVAILABLE')
        self.assertEqual(ai['case_version'], self.case['version'])
        self.assertEqual(ai['prompt_version'], '5')
        self.assertEqual(ai['model'], 'injected-test-model')
        self.assertEqual(ai['assessed_at'], self.now)
        self.assertFalse(ai['can_change_state'])
        self.assertFalse(ai['stale'])
        self.assertEqual(view['version'], self.case['version'])
        self.assertEqual(view['state'], 'CHANGE_REQUESTED')
        self.assertEqual(view['destinations'], self.case['destinations'])
        self.assertFalse(view['payout_control']['proposed_destination_usable'])
        with self.ds.connect() as db:
            row = db.execute('SELECT tenant,seller,case_id FROM pg_assessments').fetchone()
        self.assertEqual(tuple(row), ('t1', 's1', self.case_id))

    def test_unavailable_and_hostile_output_are_advisory_only(self):
        model = Mock()
        model.invoke.return_value = model_result(recommendation='APPROVE')
        view = self.service.assess(self.tokens['owner'], self.case_id, model)
        view = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertEqual(view['ai_assessment']['assessment']['status'], 'UNAVAILABLE')
        self.assertEqual(view['state'], 'CHANGE_REQUESTED')
        model.invoke.side_effect = RuntimeError('secret provider error')
        view = self.service.assess(self.tokens['owner'], self.case_id, model)
        view = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertNotIn('secret provider error', json.dumps(view))
        self.assertEqual(view['ai_assessment']['effective_recommendation'], 'ESCALATE_FOR_REVIEW')

    def test_cross_scope_cannot_assess_or_call_model(self):
        model = Mock()
        for user in ('other', 'tenant'):
            with self.assertRaises(DestinationError):
                self.service.assess(self.tokens[user], self.case_id, model)
        model.invoke.assert_not_called()

    def test_concurrent_case_update_marks_assessment_stale(self):
        def during_model(_):
            with self.ds.connect() as db:
                p = self.ds.principal(self.tokens['owner'])
                case = self.ds.case(db, p, self.case_id)
                case['messages'].append('additional evidence needed')
                self.ds.save(db, p, case, case['version'])
            return model_result()
        model = Mock()
        model.invoke.side_effect = during_model
        view = self.service.assess(self.tokens['owner'], self.case_id, model)
        view = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertTrue(view['ai_assessment']['stale'])
        self.assertEqual(view['version'], 2)

    def test_assessment_does_not_invalidate_or_accelerate_approved_case(self):
        approved = self.approve()
        model = Mock()
        model.invoke.return_value = model_result()
        view = self.service.assess(self.tokens['owner'], self.case_id, model)
        view = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertEqual(view['version'], approved['version'])
        self.assertEqual(view['state'], 'APPROVED_COOLING_OFF')
        self.assertEqual(view['cooling_off'], approved['cooling_off'])
        self.assertEqual(view['ai_assessment']['effective_recommendation'], 'ESCALATE_FOR_REVIEW')
        with self.ds.connect() as db:
            with self.assertRaises(Exception):
                db.execute("UPDATE pg_assessments SET data='{}'")

    def test_reviewer_reason_hidden_from_seller_and_external_reader(self):
        self.approve()
        for user in ('owner', 'external'):
            review = self.service.status(self.tokens[user], self.case_id)['marketplace_review']
            self.assertNotIn('reason', review)
            self.assertNotIn('actor', review)
        self.assertIn('reason', self.service.status(self.tokens['reviewer'], self.case_id)['marketplace_review'])

    def test_assessment_hidden_from_seller_staff_and_external_in_all_views(self):
        model = Mock()
        model.invoke.return_value = model_result(risk_signals=['PRESSURE_TO_SKIP_CHECKS'])
        self.service.assess(self.tokens['owner'], self.case_id, model)
        for user in ('owner', 'staff', 'external'):
            self.assertIsNone(self.service.status(self.tokens[user], self.case_id)['ai_assessment'])
            self.assertIsNone(self.service.summary(self.tokens[user], self.case_id)['ai_assessment'])
        reviewer = self.service.status(self.tokens['reviewer'], self.case_id)
        self.assertEqual(reviewer['ai_assessment']['assessment']['risk_signals'], ['PRESSURE_TO_SKIP_CHECKS'])
