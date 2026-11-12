"""Section 5 fallback: local by default, explicit HTTPS origin for hosted demos."""
import argparse
import fcntl
import json
import mimetypes
import os
import re
import secrets
import threading
import time
from decimal import Decimal, InvalidOperation
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, unquote
from .agent import Agent
from .config import ROOT, settings
from .paypal import PayPal, ProbeError, identifier
from .store import Store, Denied
from .workflow import DemoPayPal, Workflow
from .destination_store import DestinationStore
from .destination_service import DestinationService
from .destination_policy import Policy
from .destination_api import DestinationAPI, UnavailableModel
from .marketplace_payouts import MarketplacePayouts

STATIC = ROOT / 'static'
UI_DIST = ROOT / 'ui' / 'dist'
REDIRECT = 'http://127.0.0.1:8765/callback'


class Application:
    def __init__(self, store, paypal, fixture=False, model=None, public_origin=None):
        if public_origin and not re.fullmatch(r'https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', public_origin):
            raise ValueError('Public origin must be an HTTPS hostname without path or port')
        self.public_origin = public_origin
        self.redirect = public_origin + '/callback' if public_origin else REDIRECT
        self.store, self.paypal = store, paypal
        self.flow = Workflow(store, paypal)
        self.agent = Agent(self.flow, model=model, fixture=fixture)
        self.mode, self.ai_mode = self.flow.mode, 'scripted demo' if fixture else 'NVIDIA'
        self.destinations = DestinationService(DestinationStore(store), policy=Policy.configured(settings(), self.mode))
        from .destination_demo import DemoPayoutProvider
        payout_provider = DemoPayoutProvider(self.destinations.store) if self.mode == 'demo' else paypal
        self.payouts = MarketplacePayouts(self.destinations, payout_provider)
        self.destination_api = DestinationAPI(self.destinations, paypal, origin=public_origin, payouts=self.payouts,
                                              model=UnavailableModel() if fixture else None)
        self.attempts = {}
        self.auth_lock = threading.Lock()
        self.chat_locks = {}
        self.chat_guard = threading.Lock()

    def view(self, case_id, actor):
        case = self.store.case(case_id, actor)
        return {'case': case, 'payee': self.store.payee(case['owner']),
                'match': self.flow.match(case), 'audit': self.store.audit(case_id, actor)}

    def authenticate(self, user, password, ip):
        if not isinstance(user, str) or not isinstance(password, str) or len(user) > 100 or len(password) > 200:
            raise Denied('Invalid username or password')
        with self.auth_lock:
            recent = [t for t in self.attempts.get(ip, []) if time.time() - t < 60]
            if len(recent) >= 10:
                raise Denied('Too many login attempts; wait a minute')
            self.attempts[ip] = recent + [time.time()]
        return self.store.login(user, password)

    def action(self, case_id, action, actor, body):
        self.store.case(case_id, actor)
        if action in ('message', 'clear-conversation'):
            with self.chat_guard:
                lock = self.chat_locks.setdefault(case_id, threading.Lock())
            if not lock.acquire(blocking=False):
                raise Denied('An investigation is already running for this case')
            try:
                if action == 'message':
                    self.agent.reply(case_id, actor, body.get('message'))
                else:
                    self.flow.clear_conversation(case_id, actor)
            finally:
                lock.release()
        elif action == 'refresh':
            self.flow.refresh(case_id, actor)
        elif action == 'request-review':
            self.flow.request_change(case_id, actor, body.get('reason'), body.get('confirmed'))
        elif action == 'authenticate':
            if self.mode != 'sandbox':
                raise Denied('Use the explicitly simulated login in demo mode')
            state = self.store.begin_oauth(case_id, actor)
            self.store.log(case_id, actor, 'paypal_login_started', {})
            return {'url': 'https://www.sandbox.paypal.com/connect?' + urlencode({
                'flowEntry': 'static', 'client_id': self.paypal.client_id,
                'response_type': 'code', 'redirect_uri': self.redirect,
                'scope': 'openid https://uri.paypal.com/services/paypalattributes', 'state': state})}
        elif action == 'simulate-auth':
            if self.mode != 'demo' or body.get('account') not in ('match', 'mismatch'):
                raise Denied('Simulated authentication is only available in demo mode')
            payer = 'DEMO-ALICE' if body['account'] == 'match' else 'DEMO-OTHER'
            self.flow.identity(case_id, actor, {'payer_id': payer, 'verified_account': True})
        elif action in ('approve', 'reject'):
            if type(body.get('version')) is not int:
                raise Denied('Review version required')
            self.flow.approve(case_id, actor, body['version'], action == 'approve')
        elif action == 'cancel':
            self.flow.cancel(case_id, actor)
        elif action == 'simulate-recovery':
            self.flow.simulate_recovery(case_id, actor)
        else:
            raise Denied('Unknown action')
        return self.view(case_id, actor)

    def callback(self, query, actor):
        parsed = parse_qs(query, keep_blank_values=True)
        if len(parsed.get('state', [])) != 1:
            raise Denied('Invalid PayPal login callback')
        case_id = self.store.consume_oauth(parsed['state'][0], actor)
        if 'error' in parsed:
            self.store.log(case_id, actor, 'paypal_login_cancelled', {})
            raise Denied('PayPal login was cancelled; no destination updated')
        if len(parsed.get('code', [])) != 1 or not parsed['code'][0] or self.mode != 'sandbox':
            raise Denied('Invalid PayPal login callback')
        # Do not accept browser-posted payer IDs; only the provider exchange supplies evidence.
        evidence = self.paypal.identity(parsed['code'][0], self.redirect)
        self.flow.identity(case_id, actor, evidence)
        return case_id


def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'PayoutRescue'

        def setup(self):
            super().setup()
            if hasattr(self.connection, 'settimeout'):
                self.connection.settimeout(30)

        def log_message(self, *args):
            pass  # Callback URLs contain single-use credentials.

        def send(self, status, data, content_type='application/json', cookie=None, location=None):
            content = json.dumps(data).encode() if content_type == 'application/json' else data
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            if cookie:
                self.send_header('Set-Cookie', cookie + ('; Secure' if app.public_origin else ''))
            if app.public_origin:
                self.send_header('Strict-Transport-Security', 'max-age=31536000')
            if location:
                self.send_header('Location', location)
            self.end_headers()
            self.wfile.write(content)

        def token(self):
            auth = self.headers.get('Authorization', '')
            if auth.startswith('Bearer ' + app.store.API_KEY_PREFIX):
                return auth[7:].strip()          # a marketplace backend key; the cookie path below is unchanged
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get('Cookie', ''))
                return cookie['rescue_session'].value if 'rescue_session' in cookie else ''
            except Exception:
                return ''

        def boundary(self):
            expected = urlparse(app.public_origin).netloc if app.public_origin else f'127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != expected:
                raise Denied('Use the configured application URL')
            origin = self.headers.get('Origin')
            if origin and origin != (app.public_origin or 'http://' + expected):
                raise Denied('Cross-origin requests are not allowed')

        def v1_error(self, code, status):
            if urlparse(self.path).path.startswith('/api/v1/'):
                if status in (401, 403):
                    try:
                        principal = app.destinations.store.principal(self.token())
                        app.destinations.store.denied(principal, code)
                    except Exception:
                        pass
                self.send(status, {'error': {'code': code}, 'correlation_id': secrets.token_hex(16)})
                return True
            return False

        def do_GET(self):
            try:
                # Render health probes may use an internal Host. No case data or secrets.
                if self.path == '/healthz':
                    return self.send(200 if app.store.metadata('mode') == app.mode else 503,
                                     {'ok': app.store.metadata('mode') == app.mode})
                self.boundary()
                url = urlparse(self.path)
                if url.path.startswith('/api/v1/'):
                    status, data = app.destination_api.handle('GET', self.path, self.token(), headers=self.headers)
                    # A browser returning from PayPal (it asks for HTML) goes back to the seller page.
                    # API clients, which do not ask for HTML, still get the JSON answer.
                    if url.path == '/api/v1/paypal/callback' and 'text/html' in self.headers.get('Accept', ''):
                        if status == 200 and isinstance(data.get('case_id'), str):
                            return self.send(303, b'', 'text/plain', location='/seller?auth=ok&case=' + data['case_id'])
                        code = data.get('error', {}).get('code', 'ERROR') if isinstance(data.get('error'), dict) else 'ERROR'
                        return self.send(303, b'', 'text/plain', location='/seller?auth=failed&code=' + re.sub(r'[^A-Z_]', '', str(code))[:40])
                    return self.send(status, data)
                if (UI_DIST / 'index.html').is_file() and not (url.path == '/callback' or url.path.startswith('/callback/') or url.path == '/api' or url.path.startswith('/api/') or url.path in ('/app.js', '/style.css')):
                    decoded = unquote(url.path)
                    candidate = (UI_DIST / decoded.lstrip('/')).resolve()
                    if '..' in decoded.split('/') or not candidate.is_relative_to(UI_DIST.resolve()):
                        return self.send(404, {'error': 'Not found'})
                    if not candidate.is_file():
                        if Path(decoded).suffix or decoded.startswith('/assets/'):
                            return self.send(404, {'error': 'Not found'})
                        candidate = UI_DIST / 'index.html'
                    mime = mimetypes.guess_type(str(candidate))[0] or 'application/octet-stream'
                    if candidate.suffix == '.js':
                        mime = 'text/javascript'
                    return self.send(200, candidate.read_bytes(), mime)
                if url.path in ('/', '/app.js', '/style.css'):
                    filename, mime = {'/': ('index.html', 'text/html; charset=utf-8'),
                                      '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
                                      '/style.css': ('style.css', 'text/css; charset=utf-8')}[url.path]
                    return self.send(200, (STATIC / filename).read_bytes(), mime)
                if url.path == '/api/session':
                    try:
                        actor = app.store.session(self.token())
                    except Denied:
                        actor = None
                    return self.send(200, {'user': ({'id': actor['user_id'], 'role': actor['role']} if actor else None),
                        'csrf': actor['csrf'] if actor else None, 'mode': app.mode, 'ai_mode': app.ai_mode})
                actor = app.store.session(self.token())
                if url.path == '/callback':
                    case_id = app.callback(url.query, actor)
                    return self.send(303, b'', 'text/plain', location='/#' + case_id)
                if url.path == '/api/cases':
                    return self.send(200, {'cases': app.store.cases(actor)})
                match = re.fullmatch(r'/api/cases/([A-Za-z0-9_-]+)', url.path)
                if match:
                    return self.send(200, app.view(match[1], actor))
                self.send(404, {'error': 'Not found'})
            except (Denied, ProbeError) as exc:
                if self.v1_error('AUTH_REQUIRED' if not self.token() else 'REQUEST_DENIED', 401 if not self.token() else 403):
                    return
                self.send(403 if isinstance(exc, Denied) else 502, {'error': str(exc)})
            except Exception:
                if self.v1_error('INTERNAL_ERROR', 500):
                    return
                self.send(500, {'error': 'Request failed; no automatic payment retry was started'})

        def do_POST(self):
            try:
                self.boundary()
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise Denied('JSON request required')
                length = int(self.headers.get('Content-Length', '0'))
                # Studio's model turns carry its tool list, so that one route may be larger. Everything else stays at 16 KB.
                if not 0 < length <= (262144 if urlparse(self.path).path == '/api/v1/dashboard-llm' else 16384):
                    raise Denied('Invalid request size')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise Denied('JSON object required')
                path = urlparse(self.path).path
                if path == '/api/login':
                    token = app.authenticate(body.get('username'), body.get('password'), self.client_address[0])
                    return self.send(200, {'ok': True}, cookie=f'rescue_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800')
                actor = app.store.session(self.token())
                csrf = self.headers.get('X-CSRF-Token', '')
                if not actor.get('api_key') and not secrets.compare_digest(csrf.encode(), actor['csrf'].encode()):
                    raise Denied('Invalid request token; reload the page')
                if path == '/api/logout':
                    app.store.logout(self.token())
                    return self.send(200, {'ok': True}, cookie='rescue_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
                if path.startswith('/api/v1/'):
                    status, data = app.destination_api.handle('POST', self.path, self.token(), body, self.headers)
                    return self.send(status, data)
                match = re.fullmatch(r'/api/cases/([A-Za-z0-9_-]+)/([a-z-]+)', path)
                if match:
                    return self.send(200, app.action(match[1], match[2], actor, body))
                self.send(404, {'error': 'Not found'})
            except (Denied, ProbeError) as exc:
                if self.v1_error('AUTH_REQUIRED' if not self.token() else 'REQUEST_DENIED', 401 if not self.token() else 403):
                    return
                self.send(403 if isinstance(exc, Denied) else 502, {'error': str(exc)})
            except (ValueError, TypeError):
                if self.v1_error('INVALID_REQUEST', 400):
                    return
                self.send(400, {'error': 'Invalid request'})
            except Exception:
                if self.v1_error('INTERNAL_ERROR', 500):
                    return
                self.send(500, {'error': 'Request failed; no automatic payment retry was started'})
    return Handler


def main():
    parser = argparse.ArgumentParser(description='Local recipient verification and operator console')
    parser.add_argument('command', choices=['init', 'serve'])
    parser.add_argument('--mode', choices=['sandbox', 'demo'], default='sandbox')
    parser.add_argument('--ai', choices=['nvidia', 'fixture'], default='nvidia')
    parser.add_argument('--item-id')
    parser.add_argument('--expected-payer-id')
    parser.add_argument('--amount', default='0.01')
    parser.add_argument('--currency', default='USD')
    parser.add_argument('--runtime-dir', type=Path, default=Path(os.environ.get('RESCUE_RUNTIME_DIR', ROOT / '.runtime')))
    args = parser.parse_args()
    os.umask(0o077)
    runtime = args.runtime_dir
    runtime.mkdir(mode=0o700, exist_ok=True)
    db_path = runtime / ('app-' + args.mode + '.sqlite3')
    store = Store(db_path)
    if args.command == 'init':
        if args.mode == 'sandbox':
            if not args.item_id or not args.expected_payer_id:
                parser.error('Sandbox setup requires --item-id and --expected-payer-id from your established payee record')
            identifier(args.item_id)
            identifier(args.expected_payer_id)
            try:
                amount = Decimal(args.amount)
                if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
                    raise ValueError()
            except (InvalidOperation, ValueError):
                parser.error('Use a positive amount with at most two decimal places')
            if not re.fullmatch('[A-Z]{3}', args.currency):
                parser.error('Use a three-letter uppercase currency')
        credentials = store.initialize(args.mode, args.expected_payer_id or 'DEMO-ALICE',
                                       args.item_id or 'SIM-ORIGINAL', args.amount, args.currency)
        # Local demo credentials are private and ignored, never used as service API keys.
        credential_path = runtime / (args.mode + '-accounts.json')
        credential_path.write_text(json.dumps(credentials, indent=2))
        credential_path.chmod(0o600)
        print('Initialized marketplace FIXTURE. Local account credentials saved privately to:')
        print(credential_path)
        return
    if store.metadata('mode') != args.mode:
        parser.error('Initialize this mode first: configure-demo for demo mode, or, for the judge sandbox, run `python -m rescue.judge_setup --directory <runtime dir>` (an empty database file left by an earlier serve must be deleted first)')
    if args.ai == 'fixture' and args.mode != 'demo':
        parser.error('Fixture AI is only allowed in demo mode')
    # One server per database: prevents separate processes bypassing in-process case locks.
    with (runtime / ('app-' + args.mode + '.lock')).open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.error('An application server already owns this database')
        paypal = DemoPayPal() if args.mode == 'demo' else PayPal(settings())
        public_origin = os.environ.get('RESCUE_PUBLIC_ORIGIN')
        app = Application(store, paypal, fixture=args.ai == 'fixture', public_origin=public_origin)
        port = int(os.environ.get('PORT', '8765')) if public_origin else 8765
        bind = '0.0.0.0' if public_origin else '127.0.0.1'
        try:
            server = ThreadingHTTPServer((bind, port), handler_for(app))
        except OSError:
            raise SystemExit(f'Cannot open {bind}:{port}. Stop any other listener, or run in a terminal that permits sockets.') from None
        with server:
            print(f'Payout Rescue: {public_origin or REDIRECT.removesuffix("/callback")} — {args.mode}; AI: {app.ai_mode}', flush=True)
            accounts_file = runtime / (args.mode + '-accounts.json')
            if accounts_file.exists():
                print('Local account credentials: ' + str(accounts_file), flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == '__main__':
    main()
