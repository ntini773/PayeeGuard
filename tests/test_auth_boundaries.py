import unittest
from urllib.request import Request
from rescue.login import callback_code
from rescue.paypal import NoRedirect, ProbeError


class AuthBoundariesTest(unittest.TestCase):
    def test_matching_callback_accepts_code(self):
        self.assertEqual(callback_code('/callback?state=expected&code=abc', 'expected'), 'abc')

    def test_wrong_and_malformed_callbacks_rejected(self):
        for path in [
            '/callback?state=wrong&code=abc',
            '/callback?state=%E2%98%83&code=abc',
            '/callback?state=expected&state=other&code=abc',
            '/callback?state=expected&code=abc&code=def',
            '/callback?state=expected&code=',
            '/callback?state=expected&code=abc&error=denied',
            '/other?state=expected&code=abc',
            '/callback?code=abc',
        ]:
            with self.subTest(path=path):
                self.assertIsNone(callback_code(path, 'expected'))

    def test_authenticated_request_cannot_follow_redirect(self):
        req = Request('https://api-m.sandbox.paypal.com/test', headers={'Authorization': 'Bearer private'})
        for status in (301, 302, 303, 307, 308):
            with self.subTest(status=status), self.assertRaises(ProbeError):
                NoRedirect().redirect_request(req, None, status, 'redirect', {}, 'https://other.test')
