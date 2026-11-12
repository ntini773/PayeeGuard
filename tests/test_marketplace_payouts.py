import json
import unittest
from unittest.mock import Mock
from test_destination_api import APIHarness
from destination_fixtures import FakePayoutProvider
from rescue.marketplace_payouts import MarketplacePayouts


class MarketplacePayoutTest(APIHarness, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.payout_provider = FakePayoutProvider()
        self.app.payouts = MarketplacePayouts(self.service, self.payout_provider)
        self.app.destination_api.payouts = self.app.payouts
        self.app.payouts.provision('t1', 's1', 'earning-1', amount='0.01', currency='USD')
        self.execute_path = '/api/v1/marketplace-payouts/earning-1/execute'

    def test_operator_http_execution_uses_gate_and_stored_earning(self):
        self.authenticate_destination()
        code, result = self.request('POST', self.execute_path, {}, user='reviewer')
        self.assertEqual(code, 200)
        self.assertTrue(result['operation']['simulation'])
        self.assertEqual(result['operation']['provider_status'], 'SUCCESS')
        self.assertEqual(self.payout_provider.creates[0]['items'][0]['receiver'], 'AAAAAAAAAAAAA')
        self.request('POST', self.execute_path, {}, user='reviewer', idem='different-header')
        self.assertEqual(len(self.payout_provider.creates), 1)
        self.assertEqual(self.request('GET', '/api/v1/marketplace-payouts')[1]['earnings'][0]['payout']['status'], 'RECONCILED')

    def test_http_cannot_choose_amount_destination_or_grant(self):
        for body in ({'payer_id': 'BBBBBBBBBBBBB'}, {'amount': '1000'}, {'role': 'operator'}):
            self.assertEqual(self.request('POST', self.execute_path, body, user='reviewer')[0], 400)
        for user in ('owner', 'staff', 'external', 'other', 'tenant'):
            self.assertIn(self.request('POST', self.execute_path, {}, user=user)[0], (403, 404))
        self.assertEqual(self.payout_provider.creates, [])

    def test_http_compromise_hold_prevents_provider_call(self):
        view = self.service.status(self.tokens['owner'], self.case_id)
        self.service.set_compromise(self.tokens['reviewer'], self.case_id, compromised=True,
                                   reason='Trusted marketplace risk record', expected_version=view['version'])
        code, result = self.request('POST', self.execute_path, {}, user='reviewer')
        self.assertEqual((code, result['error']['code']), (409, 'PAYOUT_HELD'))
        self.assertEqual(self.payout_provider.creates, [])

    def test_list_is_scoped_and_runs_backend_expiry(self):
        self.service.create(self.tokens['other'], {'reason_text': 'Another seller request'}, 'other-request')
        code, response = self.request('GET', self.base)
        self.assertEqual(code, 200)
        self.assertEqual([c['case_id'] for c in response['cases']], [self.case_id])
        self.now += 14 * 86400
        self.assertEqual(self.request('GET', self.base)[1]['cases'][0]['state'], 'EXPIRED')
        self.assertEqual(self.request('GET', self.base + '?limit=0')[0], 400)
        self.assertEqual(self.request('GET', self.base + '?tenant_id=t2')[0], 400)
        self.assertEqual(self.request('GET', self.base + '?before=' + self.case_id, user='other')[0], 404)

    def test_application_dispatch_has_gate_chokepoint(self):
        from unittest.mock import patch
        from rescue.destination_errors import DestinationError
        with patch.object(self.app.payouts.gate, 'execute', side_effect=DestinationError('PAYOUT_HELD', 409)) as gate:
            self.assertEqual(self.request('POST', self.execute_path, {}, user='reviewer')[0], 409)
            gate.assert_called_once()
        self.assertEqual(self.payout_provider.creates, [])

    def test_operator_queue_roles_tenant_and_pagination(self):
        for user in ('owner', 'staff', 'external'):
            self.assertEqual(self.request('GET', '/api/v1/cases', user=user)[0], 403)
        self.service.create(self.tokens['tenant'], {'reason_text': 'foreign tenant'}, 'foreign')
        code, response = self.request('GET', '/api/v1/cases?limit=1', user='reviewer')
        self.assertEqual(code, 200)
        self.assertEqual(len(response['cases']), 1)
        self.assertEqual(response['cases'][0]['tenant_id'], 't1')
        self.assertNotIn('AAAAAAAAAAAAA', json.dumps(response))
        cursor = response['next_cursor']
        self.assertEqual(self.request('GET', '/api/v1/cases?before=' + cursor, user='reviewer')[1]['cases'], [])

    def test_queue_refreshes_foreign_seller_timers_and_orders_by_time(self):
        self.now += 10
        from unittest.mock import patch
        from types import SimpleNamespace
        with patch('rescue.destination_service.uuid.uuid4', return_value=SimpleNamespace(hex='0' * 32)):
            other = self.service.create(self.tokens['other'], {'reason_text': 'newer request'}, 'newer')
        self.assertLess(other['case_id'], self.case_id)  # ID order opposes creation-time order.
        self.now += 14 * 86400
        code, view = self.request('GET', '/api/v1/cases?limit=1', user='reviewer')
        self.assertEqual(code, 200)
        self.assertEqual(view['cases'][0]['case_id'], other['case_id'])
        self.assertEqual(view['cases'][0]['state'], 'EXPIRED')
        cursor = view['next_cursor']
        second = self.request('GET', '/api/v1/cases?before=' + cursor, user='reviewer')[1]
        self.assertEqual(second['cases'][0]['case_id'], self.case_id)
