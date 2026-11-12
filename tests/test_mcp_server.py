import json
import unittest
from unittest.mock import patch
from rescue import mcp_server


class McpServerTest(unittest.TestCase):
    def call(self, name, args, key='pgk_test'):
        with patch.dict('os.environ', {'PAYEEGUARD_API_KEY': key}, clear=False):
            return mcp_server.handle({'jsonrpc': '2.0', 'id': 7, 'method': 'tools/call', 'params': {'name': name, 'arguments': args}})

    def test_handshake_lists_only_safe_tools(self):
        init = mcp_server.handle({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2024-11-05'}})
        self.assertEqual(init['result']['serverInfo']['name'], 'payeeguard')
        names = {t['name'] for t in mcp_server.handle({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})['result']['tools']}
        self.assertEqual(names, {'list_change_requests', 'get_change_request', 'create_change_request', 'cancel_change_request', 'start_paypal_verification'})
        for forbidden in ('approve', 'reject', 'review', 'payout', 'evidence'):
            self.assertFalse(any(forbidden in n for n in names))
        self.assertIsNone(mcp_server.handle({'jsonrpc': '2.0', 'method': 'notifications/initialized'}))
        self.assertEqual(mcp_server.handle({'jsonrpc': '2.0', 'id': 3, 'method': 'nope'})['error']['code'], -32601)

    def test_calls_go_through_the_api_with_the_key_and_validate_input(self):
        with patch.object(mcp_server, 'api', return_value={'ok': True}) as api:
            r = self.call('create_change_request', {'reason_text': 'New PayPal account for my shop'})
            self.assertFalse(r['result']['isError'])
            api.assert_called_once_with('POST', mcp_server.BASE, {'reason_text': 'New PayPal account for my shop'})
        for name, args in (('get_change_request', {'case_id': '../../etc'}), ('cancel_change_request', {}), ('create_change_request', {'reason_text': 'x'}),
                           ('start_paypal_verification', {'case_id': 'chg_' + 'a' * 32, 'purpose': 'MAYBE'}), ('delete_everything', {})):
            self.assertTrue(self.call(name, args)['result']['isError'], name)

    def test_missing_key_is_an_error_and_the_key_is_never_returned(self):
        with patch.dict('os.environ', {'PAYEEGUARD_API_KEY': ''}):
            r = mcp_server.handle({'jsonrpc': '2.0', 'id': 9, 'method': 'tools/call', 'params': {'name': 'list_change_requests', 'arguments': {}}})
        self.assertTrue(r['result']['isError'])
        with patch.object(mcp_server, 'api', return_value={'cases': []}):
            self.assertNotIn('pgk_', json.dumps(self.call('list_change_requests', {}, key='pgk_secret-value')))


if __name__ == '__main__':
    unittest.main()
