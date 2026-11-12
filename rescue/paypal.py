"""Small sandbox-only client. Never follows remote links or logs tokens."""
import base64
import json
import re
import time
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


DEFAULT_SCOPES = 'openid https://uri.paypal.com/services/paypalattributes'
# Only these may be requested. A typo or a hostile value in configuration must not widen what we ask PayPal for.
ALLOWED_SCOPES = frozenset({'openid', 'profile', 'address', 'https://uri.paypal.com/services/paypalattributes'})


class PayPal:
    def __init__(self, cfg):
        self.client_id = cfg.get('PAYPAL_CLIENT_ID', '')
        self.secret = cfg.get('PAYPAL_CLIENT_SECRET', '')
        self.token = None
        self.token_expires = 0.0
        # RESCUE_PAYPAL_SCOPES adds name and country (profile, address) once the app has them enabled in the Dashboard.
        requested = (cfg.get('RESCUE_PAYPAL_SCOPES') or DEFAULT_SCOPES).split()
        self.scopes = ' '.join(requested) if requested and set(requested) <= ALLOWED_SCOPES and 'openid' in requested else DEFAULT_SCOPES

    def call(self, method, path, body=None, token=None, form=False, basic=False, _retried=False, request_id=None):
        headers = {'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'}
        if request_id:
            headers['PayPal-Request-Id'] = request_id
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
            # An app token can expire or be revoked while we hold it. Fetch a new one and retry once.
            # Only for calls that use the cached app token; a caller-supplied token is never replaced.
            if exc.code == 401 and not basic and token is None and not _retried:
                self.token = None
                return self.call(method, path, body, form=form, _retried=True, request_id=request_id)
            raise ProbeError(http_diagnostic(exc)) from None
        except (error.URLError, TimeoutError, OSError):
            raise ProbeError('PayPal transport failure; outcome may be unknown') from None

    def access_token(self):
        # PayPal app tokens last about nine hours (expires_in). Refresh a minute early instead of caching forever.
        if not self.token or time.time() >= self.token_expires:
            data = self.call('POST', '/v1/oauth2/token', {'grant_type': 'client_credentials'}, form=True, basic=True)
            self.token = data['access_token']
            lifetime = data.get('expires_in')
            self.token_expires = time.time() + max(float(lifetime) - 60, 0) if isinstance(lifetime, (int, float)) else float('inf')
        return self.token

    def item(self, item_id):
        return self.call('GET', '/v1/payments/payouts-item/' + identifier(item_id))

    def batch(self, batch_id):
        return self.call('GET', '/v1/payments/payouts/' + identifier(batch_id) + '?page_size=1000')

    def create(self, payload):
        # PayPal stores PayPal-Request-Id for 30 days, so a repeated send of the same batch is not paid twice.
        # It matches the sender_batch_id we already use as the idempotency key.
        batch_id = payload.get('sender_batch_header', {}).get('sender_batch_id')
        return self.call('POST', '/v1/payments/payouts', payload, request_id=batch_id if isinstance(batch_id, str) and 1 <= len(batch_id) <= 100 else None)

    def cancel(self, item_id):
        return self.call('POST', '/v1/payments/payouts-item/' + identifier(item_id) + '/cancel')

    def identity(self, code, redirect_uri):
        token = self.call('POST', '/v1/oauth2/token', {'grant_type': 'authorization_code',
            'code': code, 'redirect_uri': redirect_uri}, form=True, basic=True)['access_token']
        data = self.call('GET', '/v1/identity/openidconnect/userinfo?schema=openid', token=token)
        if not data.get('payer_id') or 'verified_account' not in data:
            raise ProbeError('Account-information scope did not return required attributes')
        # PayPal's userinfo returns verified_account as the string "true" or "false" (observed on the
        # sandbox, 2026-11-11). Convert only those exact values at this boundary. Anything else is not verified.
        verified = data['verified_account']
        address = data.get('address') if isinstance(data.get('address'), dict) else {}
        name = data.get('name') or ' '.join(str(data.get(k) or '') for k in ('given_name', 'family_name')).strip()
        # Raw attributes stay in memory for the caller to turn into derived facts. Only what the risk checks need is kept.
        attributes = {'account_type': data.get('account_type'), 'account_creation_date': data.get('account_creation_date'),
                      'name': name or None, 'address': {'country': address.get('country')} if address.get('country') else {}}
        return {'payer_id': data['payer_id'], 'verified_account': verified is True or verified == 'true', 'attributes': attributes}
