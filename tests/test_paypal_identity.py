import unittest
from rescue.paypal import PayPal


class IdentityBoundaryTest(unittest.TestCase):
    """PayPal sends verified_account as the string "true". The destination flow needs a real boolean."""

    def identity(self, verified):
        paypal = PayPal({'PAYPAL_CLIENT_ID': 'x', 'PAYPAL_CLIENT_SECRET': 'y'})
        calls = iter([{'access_token': 'token'}, {'payer_id': 'ABCDEFGH12345', 'verified_account': verified}])
        paypal.call = lambda *args, **kwargs: next(calls)
        return paypal.identity('code', 'http://127.0.0.1:8765/api/v1/paypal/callback')

    def test_string_true_becomes_boolean_true(self):
        self.assertIs(self.identity('true')['verified_account'], True)

    def test_everything_else_is_not_verified(self):
        for value in ('false', 'True', 'yes', '1', 1, None, False, ''):
            self.assertIs(self.identity(value)['verified_account'], False, repr(value))


class AppTokenLifetimeTest(unittest.TestCase):
    """The app token must be refreshed when it expires, not cached forever."""

    def client(self, responses):
        paypal = PayPal({'PAYPAL_CLIENT_ID': 'x', 'PAYPAL_CLIENT_SECRET': 'y'})
        paypal.sent = []
        queue = iter(responses)

        def call(method, path, body=None, token=None, form=False, basic=False, _retried=False):
            paypal.sent.append(path)
            return next(queue)
        paypal.call = call
        return paypal

    def test_token_is_reused_until_it_expires(self):
        paypal = self.client([{'access_token': 'one', 'expires_in': 3600}])
        self.assertEqual(paypal.access_token(), 'one')
        self.assertEqual(paypal.access_token(), 'one')
        self.assertEqual(paypal.sent, ['/v1/oauth2/token'])

    def test_expired_token_is_fetched_again(self):
        paypal = self.client([{'access_token': 'one', 'expires_in': 3600}, {'access_token': 'two', 'expires_in': 3600}])
        paypal.access_token()
        paypal.token_expires = 0
        self.assertEqual(paypal.access_token(), 'two')


    def test_401_on_app_token_call_refreshes_once(self):
        import io
        import json as _json
        from unittest import mock
        from urllib import error
        paypal = PayPal({'PAYPAL_CLIENT_ID': 'x', 'PAYPAL_CLIENT_SECRET': 'y'})
        paypal.token, paypal.token_expires = 'stale', float('inf')
        seen = []

        class Opener:
            def open(self, req, timeout=0):
                seen.append(req.get_header('Authorization'))
                if req.full_url.endswith('/v1/oauth2/token'):
                    return io.BytesIO(_json.dumps({'access_token': 'fresh', 'expires_in': 3600}).encode())
                if seen.count('Bearer stale'):
                    if len([h for h in seen if h == 'Bearer stale']) == 1 and 'Bearer fresh' not in seen:
                        raise error.HTTPError(req.full_url, 401, 'no', {}, io.BytesIO(b'{}'))
                return io.BytesIO(b'{"ok": true}')
        with mock.patch('rescue.paypal.request.build_opener', return_value=Opener()):
            self.assertEqual(paypal.item('ITEM1'), {'ok': True})
        self.assertIn('Bearer fresh', seen)


    def test_create_sends_request_id_from_sender_batch_id(self):
        paypal = self.client([{'batch_header': {}}])
        seen = {}
        paypal.call = lambda method, path, body=None, **kw: seen.update(kw) or {'batch_header': {}}
        paypal.create({'sender_batch_header': {'sender_batch_id': 'rescue-abc'}, 'items': []})
        self.assertEqual(seen.get('request_id'), 'rescue-abc')


if __name__ == '__main__':
    unittest.main()
