import json
import unittest
from types import SimpleNamespace
from test_app import Wire
from test_destination_api import APIHarness
from rescue.app import handler_for


class ApiKeyTest(APIHarness, unittest.TestCase):
    def bearer(self, method, path, key, body=None, idem='key-request-1'):
        data = json.dumps(body).encode() if body is not None else b''
        headers = {'Host': 'rescue.example', 'Connection': 'close', 'Idempotency-Key': idem}
        if key:
            headers['Authorization'] = 'Bearer ' + key
        if body is not None:
            headers.update({'Content-Type': 'application/json', 'Content-Length': str(len(data))})
        request = f'{method} {path} HTTP/1.1\r\n' + ''.join(f'{k}: {v}\r\n' for k, v in headers.items()) + '\r\n'
        wire = Wire(request.encode() + data)
        handler_for(self.app)(wire, ('127.0.0.1', 54321), SimpleNamespace(server_port=8765, server_name='rescue.example'))
        head, content = wire.output.getvalue().split(b'\r\n\r\n', 1)
        return int(head.split()[1]), json.loads(content)

    def test_marketplace_key_reads_cancels_and_creates_without_csrf(self):
        key = self.identity.create_api_key('external', 'marketplace-backend')
        self.assertEqual(self.bearer('GET', self.base, key)[0], 200)
        self.assertEqual(self.bearer('GET', self.path, key)[0], 200)
        self.assertEqual(self.bearer('POST', self.path + '/cancel', key, {}, idem='key-cancel-1')[0], 200)
        code, created = self.bearer('POST', self.base, key, {'reason_text': 'Seller moved to a new PayPal account'}, idem='key-create-1')
        self.assertEqual(code, 201)
        self.assertNotEqual(created['case_id'], self.case_id)

    def test_missing_wrong_revoked_and_browser_user_keys_are_refused(self):
        self.assertEqual(self.bearer('GET', self.base, None)[0], 401)
        self.assertEqual(self.bearer('GET', self.base, 'pgk_not-a-real-key')[0], 401)
        owner_key = self.identity.create_api_key('owner', 'wrong-channel')          # a browser-channel user
        self.assertEqual(self.bearer('GET', self.base, owner_key)[0], 403)
        key = self.identity.create_api_key('external', 'to-revoke')
        self.assertEqual(self.bearer('GET', self.base, key)[0], 200)
        self.assertEqual(self.identity.revoke_api_key('external', 'to-revoke'), 1)
        self.assertEqual(self.bearer('GET', self.base, key)[0], 401)

    def test_a_key_cannot_review_or_see_another_seller(self):
        key = self.identity.create_api_key('external', 'marketplace-backend')
        code, _ = self.bearer('POST', self.path + '/review', key, {'decision': 'APPROVED', 'reason': 'ok', 'expected_version': 1}, idem='key-review-1')
        self.assertEqual(code, 403)
        other = self.identity.create_api_key('other', 'other-seller')
        self.assertEqual(self.bearer('GET', self.path, other)[0], 403)

    def test_only_a_digest_is_stored(self):
        key = self.identity.create_api_key('external', 'marketplace-backend')
        with self.identity.connect() as db:
            stored = ' '.join(str(v) for row in db.execute('SELECT * FROM api_keys') for v in tuple(row))
        self.assertNotIn(key, stored)
        self.assertTrue(key.startswith('pgk_'))
        with self.assertRaises(ValueError):
            self.identity.create_api_key('external', 'bad label!')
        with self.assertRaises(ValueError):
            self.identity.create_api_key('nobody', 'x')


if __name__ == '__main__':
    unittest.main()
