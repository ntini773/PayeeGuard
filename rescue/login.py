"""Local, single-use OAuth callback for a human sandbox account login."""
import secrets
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode, urlparse, parse_qs
from .paypal import ProbeError

REDIRECT = 'http://127.0.0.1:8765/callback'


def callback_code(path, state):
    url = urlparse(path)
    query = parse_qs(url.query, keep_blank_values=True)
    states = query.get('state', [])
    codes = query.get('code', [])
    if (url.path != '/callback' or len(states) != 1 or len(codes) != 1
            or not codes[0] or 'error' in query):
        return None
    if not secrets.compare_digest(states[0].encode(), state.encode()):
        return None
    return codes[0]


def login(paypal):
    state = secrets.token_urlsafe(32)
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            code = callback_code(self.path, state)
            valid = code is not None
            if valid:
                result['code'] = code
            self.send_response(200 if valid else 400)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Callback received. Return to terminal.' if valid else b'Invalid callback.')

    with HTTPServer(('127.0.0.1', 8765), Handler) as server:
        server.timeout = 1
        print('Open in a browser and log in with the intended sandbox recipient:')
        print('https://www.sandbox.paypal.com/connect?flowEntry=static&' + urlencode({
            'client_id': paypal.client_id, 'response_type': 'code', 'redirect_uri': REDIRECT,
            'scope': 'openid https://uri.paypal.com/services/paypalattributes', 'state': state}))
        deadline = time.monotonic() + 180
        while not result and time.monotonic() < deadline:
            server.handle_request()
    if not result:
        raise ProbeError('Login timed out; no identity recorded')
    return paypal.identity(result['code'], REDIRECT)
