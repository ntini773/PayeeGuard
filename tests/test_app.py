import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import urlencode
import test_workflow as fixture
from rescue.app import Application, handler_for
from rescue.store import Denied


class Wire:
    def __init__(self, data):
        self.input = io.BytesIO(data)
        self.output = io.BytesIO()
    def makefile(self, *args):
        return self.input
    def sendall(self, data):
        self.output.write(data)


class AppTest(unittest.TestCase):
    setUp = fixture.WorkflowTest.setUp
    tearDown = fixture.WorkflowTest.tearDown

    def request(self, method, path, body=None, cookie='', csrf='', origin=None, host='127.0.0.1:8765'):
        if not hasattr(self, 'app'):
            self.app = Application(self.store, self.api, fixture=True)
        raw = json.dumps(body).encode() if body is not None else b''
        headers = {'Host': host, 'Connection': 'close', 'Cookie': cookie, 'X-CSRF-Token': csrf}
        if body is not None:
            headers.update({'Content-Type': 'application/json', 'Content-Length': str(len(raw))})
        if origin:
            headers['Origin'] = origin
        request = f'{method} {path} HTTP/1.1\r\n' + ''.join(f'{k}: {v}\r\n' for k,v in headers.items()) + '\r\n'
        wire = Wire(request.encode() + raw)
        handler_for(self.app)(wire, ('127.0.0.1', 12345), SimpleNamespace(server_port=8765, server_name='127.0.0.1'))
        head, content = wire.output.getvalue().split(b'\r\n\r\n', 1)
        lines = head.decode().split('\r\n')
        response_headers = dict(line.split(': ', 1) for line in lines[1:])
        payload = json.loads(content) if response_headers['Content-Type'] == 'application/json' else content
        return int(lines[0].split()[1]), response_headers, payload

    def auth(self, user):
        status, headers, _ = self.request('POST', '/api/login', {'username': user, 'password': self.credentials[user]})
        self.assertEqual(status, 200)
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        cookie = headers['Set-Cookie'].split(';')[0]
        status, _, data = self.request('GET', '/api/session', cookie=cookie)
        self.assertEqual(status, 200)
        return {'cookie': cookie, 'csrf': data['csrf']}

    def test_assets_security_headers_and_anonymous_case_denial(self):
        for path in ['/', '/app.js', '/style.css']:
            status, headers, body = self.request('GET', path)
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertEqual(self.request('GET', '/api/cases')[0], 403)
        self.assertEqual(self.request('GET', '/', host='evil.example')[0], 403)

    def test_http_rejects_csrf_and_cross_origin(self):
        auth = self.auth('creator')
        self.assertEqual(self.request('POST', '/api/cases/case-001/refresh', {}, cookie=auth['cookie'])[0], 403)
        self.assertEqual(self.request('POST', '/api/cases/case-001/refresh', {}, origin='https://evil.example', **auth)[0], 403)
        self.assertEqual(self.request('POST', '/api/cases/case-001/refresh', {}, **auth)[0], 200)

    def test_complete_demo_journey_through_http(self):
        recipient = self.auth('creator')
        operator = self.auth('operator')
        base = '/api/cases/case-001/'
        status, _, data = self.request('POST', base+'message', {'message': 'My old email is inaccessible'}, **recipient)
        self.assertEqual(status, 200)
        self.assertEqual(data['case']['state'], 'AWAITING_AUTH')
        self.assertEqual(self.request('POST', base+'simulate-auth', {'account': 'match'}, **recipient)[0], 200)
        status, _, data = self.request('POST', base+'message', {'message': 'I authenticated; verify my destination'}, **recipient)
        self.assertEqual(data['case']['state'], 'AWAITING_APPROVAL')
        version = data['case']['version']
        self.assertEqual(self.request('POST', base+'approve', {'version':version}, **recipient)[0], 403)
        self.assertEqual(self.request('POST', base+'approve', {'version':version}, **operator)[0], 200)
        status, _, data = self.request('POST', base+'cancel', {}, **operator)
        self.assertEqual(status, 200)
        self.assertEqual(data['case']['state'], 'CANCELLATION_PENDING')
        self.assertIsNone(data['case']['replacement'])
        status, _, data = self.request('POST', base+'simulate-recovery', {}, **operator)
        self.assertEqual(status, 200)
        self.assertTrue(data['case']['replacement']['simulated'])
        first = data['case']['replacement']['id']
        data = self.request('POST', base+'simulate-recovery', {}, **operator)[2]
        self.assertEqual(first, data['case']['replacement']['id'])

    def test_operator_cannot_impersonate_recipient(self):
        auth = self.auth('operator')
        for action, body in [('simulate-auth', {'account':'match'}), ('message', {'message':'Pay me'})]:
            self.assertEqual(self.request('POST', '/api/cases/case-001/'+action, body, **auth)[0], 403)

    def test_login_throttle_and_logout(self):
        auth = self.auth('creator')
        self.assertEqual(self.request('POST', '/api/logout', {}, **auth)[0], 200)
        self.assertEqual(self.request('GET', '/api/cases', **auth)[0], 403)
        for _ in range(10):
            self.request('POST', '/api/login', {'username':'creator', 'password':'wrong'})
        self.assertIn('Too many', self.request('POST', '/api/login', {'username':'creator','password':self.credentials['creator']})[2]['error'])

    def sandbox_app(self):
        with self.store.connect() as db:
            db.execute("UPDATE metadata SET value='sandbox' WHERE key='mode'")
            for row in db.execute('SELECT id,data FROM cases').fetchall():
                case = json.loads(row['data']); case['mode'] = 'sandbox'
                db.execute('UPDATE cases SET data=? WHERE id=?', (json.dumps(case), row['id']))
        paypal = Mock()
        paypal.client_id = 'public-client'
        paypal.identity.return_value = {'payer_id':'DEMO-ALICE', 'verified_account':'true'}
        self.app = Application(self.store, paypal, model=Mock())
        return paypal

    def test_callback_uses_provider_evidence_and_session_bound_state(self):
        paypal = self.sandbox_app()
        auth = self.auth('creator')
        status, _, data = self.request('POST', '/api/cases/case-001/authenticate', {}, **auth)
        self.assertEqual(status, 200)
        from urllib.parse import urlparse, parse_qs
        state = parse_qs(urlparse(data['url']).query)['state'][0]
        callback = '/callback?' + urlencode({'state': state, 'code': 'private-code'})
        operator = self.auth('operator')
        self.assertEqual(self.request('GET', callback, **operator)[0], 403)
        status, headers, _ = self.request('GET', callback, **auth)
        self.assertEqual(status, 303)
        self.assertEqual(headers['Location'], '/#case-001')
        paypal.identity.assert_called_once_with('private-code', 'http://127.0.0.1:8765/callback')
        self.assertEqual(self.request('GET', callback, **auth)[0], 403)
        case = self.store.case('case-001', self.creator)
        self.assertTrue(case['identity']['verified_account'])
        self.assertNotIn('private-code', str(self.store.audit('case-001', self.creator)))

    def test_simulation_and_raw_identity_injection_blocked_in_sandbox(self):
        paypal = self.sandbox_app()
        auth = self.auth('creator')
        self.assertEqual(self.request('POST', '/api/cases/case-001/simulate-auth', {'account':'match'}, **auth)[0], 403)
        self.assertEqual(self.request('POST', '/api/cases/case-001/identity', {'payer_id':'OTHER'}, **auth)[0], 403)
        self.assertIsNone(self.store.case('case-001', self.creator)['identity'])
        paypal.identity.assert_not_called()

    def test_explicit_review_available_after_model_clarification(self):
        auth = self.auth('creator')
        self.request('POST', '/api/cases/case-001/simulate-auth', {'account':'match'}, **auth)
        self.flow.propose('case-001', self.creator, 'clarify', 'Why do you need a change?')
        status, _, result = self.request('POST', '/api/cases/case-001/request-review',
            {'reason':'The original email is inaccessible.', 'confirmed':True}, **auth)
        self.assertEqual(status, 200)
        self.assertEqual(result['case']['state'], 'AWAITING_APPROVAL')
        self.assertIsNone(result['case']['approval'])
        operator = self.auth('operator')
        status, _, result = self.request('POST', '/api/cases/case-001/approve',
            {'version':result['case']['version']}, **operator)
        self.assertEqual(status, 200)
        self.assertEqual(result['case']['state'], 'APPROVED')

    def test_recipient_can_clear_chat_but_operator_cannot(self):
        auth = self.auth('creator')
        self.request('POST', '/api/cases/case-001/message', {'message': 'My old email is inaccessible'}, **auth)
        operator = self.auth('operator')
        self.assertEqual(self.request('POST', '/api/cases/case-001/clear-conversation', {}, **operator)[0], 403)
        status, _, result = self.request('POST', '/api/cases/case-001/clear-conversation', {}, **auth)
        self.assertEqual(status, 200)
        self.assertEqual(result['case']['messages'], [])
        self.assertTrue(any(a['event'] == 'recipient_message' for a in result['audit']))

    def test_clear_chat_rejected_while_agent_turn_in_flight(self):
        import threading
        auth = self.auth('creator')
        lock = threading.Lock()
        self.app.chat_locks['case-001'] = lock
        with lock:
            status, _, result = self.request('POST', '/api/cases/case-001/clear-conversation', {}, **auth)
        self.assertEqual(status, 403)
        self.assertIn('investigation is already running', result['error'])
