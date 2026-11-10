"""Small sandbox-only client. Never follows remote links or logs tokens."""
import base64
import json
import re
from urllib import request, parse, error

BASE = 'https://api-m.sandbox.paypal.com'


class ProbeError(Exception):
    pass


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ProbeError('Unexpected PayPal redirect; request not forwarded')


def http_diagnostic(exc):
    """Expose only bounded machine error identifiers, never response messages."""
    parts = [f'PayPal HTTP {exc.code}']
    try:
        data = json.loads(exc.read(65536))
    except (ValueError, OSError):
        data = {}
    if isinstance(data, dict):
        for key, pattern in (('name', r'[A-Z][A-Z0-9_]{0,79}'),
                             ('debug_id', r'[a-fA-F0-9]{1,64}')):
            value = data.get(key)
            if isinstance(value, str) and re.fullmatch(pattern, value):
                parts.append(f'{key}={value}')
    return '; '.join(parts) + '; other response fields suppressed'


def identifier(value):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', value):
        raise ProbeError('Invalid identifier')
    return value


class PayPal:
    def __init__(self, cfg):
        self.client_id = cfg.get('PAYPAL_CLIENT_ID', '')
        self.secret = cfg.get('PAYPAL_CLIENT_SECRET', '')
        self.token = None

    def call(self, method, path, body=None, token=None, form=False, basic=False):
        headers = {'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'}
        if basic:
            if not self.client_id or not self.secret:
                raise ProbeError('Missing sandbox client credentials')
            auth = base64.b64encode(f'{self.client_id}:{self.secret}'.encode()).decode()
            headers['Authorization'] = 'Basic ' + auth
        else:
            headers['Authorization'] = 'Bearer ' + (token or self.access_token())
        data = None if body is None else (parse.urlencode(body).encode() if form else json.dumps(body).encode())
        req = request.Request(BASE + path, data=data, headers=headers, method=method)
        try:
            with request.build_opener(NoRedirect()).open(req, timeout=25) as response:
                return json.load(response)
        except error.HTTPError as exc:
            raise ProbeError(http_diagnostic(exc)) from None
        except (error.URLError, TimeoutError, OSError):
            raise ProbeError('PayPal transport failure; outcome may be unknown') from None

    def access_token(self):
        if not self.token:
            self.token = self.call('POST', '/v1/oauth2/token',
                {'grant_type': 'client_credentials'}, form=True, basic=True)['access_token']
        return self.token

    def item(self, item_id):
        return self.call('GET', '/v1/payments/payouts-item/' + identifier(item_id))

    def batch(self, batch_id):
        return self.call('GET', '/v1/payments/payouts/' + identifier(batch_id) + '?page_size=1000')

    def create(self, payload):
        return self.call('POST', '/v1/payments/payouts', payload)

    def cancel(self, item_id):
        return self.call('POST', '/v1/payments/payouts-item/' + identifier(item_id) + '/cancel')

    def identity(self, code, redirect_uri):
        token = self.call('POST', '/v1/oauth2/token', {'grant_type': 'authorization_code',
            'code': code, 'redirect_uri': redirect_uri}, form=True, basic=True)['access_token']
        data = self.call('GET', '/v1/identity/openidconnect/userinfo?schema=openid', token=token)
        if not data.get('payer_id') or 'verified_account' not in data:
            raise ProbeError('Account-information scope did not return required attributes')
        return {key: data[key] for key in ('payer_id', 'verified_account')}
