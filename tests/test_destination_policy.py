from dataclasses import replace
import unittest
from destination_fixtures import DestinationFixture
from rescue.destination_policy import Policy, evaluate
from rescue.destination_errors import DestinationError


class PolicyTest(DestinationFixture, unittest.TestCase):
    def test_invalid_configuration_and_production_defaults_rejected(self):
        for values in ({'cooling_seconds': 0}, {'recovery_seconds': 1}, {'mode': 'production'}, {'compromise_policy': 'allow'}):
            with self.assertRaises(DestinationError):
                Policy(**values)

    def test_policy_change_and_extended_cooling_fail_closed(self):
        self.approve()
        self.now += 4 * 86400
        self.service.policy = replace(self.service.policy, cooling_seconds=5 * 86400)
        self.assertEqual(self.service.refresh(self.tokens['owner'], self.case_id)['state'], 'PENDING_REVIEW')

    def test_ai_authority_fields_do_not_affect_policy(self):
        with self.ds.connect() as db:
            p = self.ds.principal(self.tokens['owner'])
            case, payee = self.ds.case(db, p, self.case_id), self.ds.payee(db, p)
        before = evaluate(case, payee, self.service.policy, self.now)
        case['ai_assessment'] = {'approved': True, 'recommendation': 'ACTIVATE', 'hold_released': True}
        self.assertEqual(evaluate(case, payee, self.service.policy, self.now), before)
        self.assertFalse(before['may_activate_proposed_destination'])

    def test_deployment_configuration_changes_invalidate_approval_version(self):
        defaults = Policy.configured({}, 'sandbox')
        changed = Policy.configured({'RESCUE_COOLING_SECONDS': '172800'}, 'sandbox')
        self.assertEqual(defaults.cooling_seconds, 259200)
        self.assertEqual(changed.cooling_seconds, 172800)
        self.assertNotEqual(defaults.version, changed.version)
