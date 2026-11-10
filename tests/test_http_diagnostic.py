import io
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from rescue.paypal import PayPal, ProbeError, http_diagnostic


def failure(body):
    return HTTPError('https://api-m.sandbox.paypal.com/test', 403, 'Forbidden', {}, io.BytesIO(body))


class DiagnosticTest(unittest.TestCase):
    def test_only_error_identifiers_are_exposed(self):
        body = json.dumps({'name': 'AUTHORIZATION_ERROR', 'debug_id': 'abc123',
            'message': 'private recipient', 'access_token': 'private-token',
            'details': [{'value': 'private@example.com'}]}).encode()
        opener = Mock()
        opener.open.side_effect = failure(body)
        with patch('rescue.paypal.request.build_opener', return_value=opener):
            with self.assertRaises(ProbeError) as caught:
                PayPal({}).call('POST', '/v1/payments/payouts', {}, token='private-token')
        text = str(caught.exception)
        self.assertIn('name=AUTHORIZATION_ERROR', text)
        self.assertIn('debug_id=abc123', text)
        self.assertNotIn('private', text)

    def test_non_json_and_unexpected_json_are_safe(self):
        for body in (b'<html>private</html>', b'[]', b'null', b'{'):
            with self.subTest(body=body):
                self.assertEqual(http_diagnostic(failure(body)),
                    'PayPal HTTP 403; other response fields suppressed')

    def test_invalid_identifiers_are_not_printed(self):
        body = json.dumps({'name': 'private@example.com', 'debug_id': 'token\nsecret'}).encode()
        self.assertEqual(http_diagnostic(failure(body)),
            'PayPal HTTP 403; other response fields suppressed')
