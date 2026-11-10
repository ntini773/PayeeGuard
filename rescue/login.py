"""Local, single-use OAuth callback for a human sandbox account login."""
import secrets
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode, urlparse, parse_qs
from .paypal import ProbeError

REDIRECT = 'http://127.0.0.1:8765/callback'


def login(paypal):
    state = secrets.token_urlsafe(32)
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            url = urlparse(self.path)
            query = parse_qs(url.query)
            valid = (url.path == '/callback' and
                secrets.compare_digest(query.get('state', [''])[0], state) and
                len(query.get('code', [])) == 1)
            if valid:
                result['code'] = query['code'][0]
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
