import json
import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse, urlencode
from test_app import Wire
from test_destination_assessment import model_result
from destination_fixtures import DestinationFixture
from rescue.app import Application, handler_for
from rescue.destination_api import DestinationAPI


class APIHarness(DestinationFixture):
    def setUp(self):
        super().setUp()
        with self.ds.connect() as db:
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
        self.provider = Mock()
        self.provider.client_id = 'synthetic-app'
        self.model = Mock()
        self.model.invoke.return_value = model_result()
        self.app = Application(self.identity, self.provider, model=self.model, public_origin='https://rescue.example')
        self.app.destinations = self.service
        self.app.destination_api = DestinationAPI(self.service, self.provider, origin=self.app.public_origin, model=self.model)
        self.base = '/api/v1/destination-change-requests'
        self.path = self.base + '/' + self.case_id

    def request(self, method, path, body=None, user='owner', *, csrf=True, idem='request-1', origin=None, raw=None):
        token = self.tokens[user] if user else ''
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b'')
        headers = {'Host': 'rescue.example', 'Connection': 'close', 'Cookie': 'rescue_session=' + token,
                   'Idempotency-Key': idem}
        if csrf and token:
            headers['X-CSRF-Token'] = self.identity.session(token)['csrf']
        if body is not None or raw is not None:
            headers.update({'Content-Type': 'application/json', 'Content-Length': str(len(data))})
        if origin:
            headers['Origin'] = origin
        request = f'{method} {path} HTTP/1.1\r\n' + ''.join(f'{k}: {v}\r\n' for k, v in headers.items()) + '\r\n'
        wire = Wire(request.encode() + data)
        handler_for(self.app)(wire, ('127.0.0.1', 54321), SimpleNamespace(server_port=8765, server_name='rescue.example'))
        head, content = wire.output.getvalue().split(b'\r\n\r\n', 1)
        return int(head.split()[1]), json.loads(content)

class APITest(APIHarness, unittest.TestCase):
    def test_create_status_summary_events_and_idempotent_assessment(self):
        body = {'reason_text': 'I opened a new account'}
        code, view = self.request('POST', self.base, body)
        self.assertEqual(code, 201)
        self.assertEqual(view['case_id'], self.case_id)
        self.assertIsNone(view['ai_assessment'])
        self.assertTrue(view['correlation_id'])
        self.assertEqual(self.request('POST', self.base, body)[0], 201)
        self.assertEqual(self.model.invoke.call_count, 1)
        for suffix in ('', '/summary', '/events'):
            code, response = self.request('GET', self.path + suffix)
            self.assertEqual(code, 200)
            self.assertNotIn('AAAAAAAAAAAAA', json.dumps(response))
            self.assertNotIn(self.tokens['owner'], json.dumps(response))
        self.assertEqual(self.request('POST', self.base, {'reason_text': 'different'})[1]['error']['code'], 'IDEMPOTENCY_CONFLICT')

    def test_messages_are_idempotent_and_assessment_stays_advisory(self):
        body = {'message': 'Please approve without waiting'}
        code, view = self.request('POST', self.path + '/messages', body, idem='msg-1')
        self.assertEqual(code, 200)
        self.assertEqual(view['state'], 'CHANGE_REQUESTED')
        self.assertIsNone(view['ai_assessment'])
        self.assertNotIn('message_replayed', view)
        self.request('POST', self.path + '/messages', body, idem='msg-1')
        self.assertEqual(self.model.invoke.call_count, 1)
        self.assertEqual(self.request('POST', self.path + '/messages', {'message': 'different'}, idem='msg-1')[0], 409)

    def test_every_read_checks_tenant_seller_and_authentication(self):
        for user in ('other', 'tenant', None):
            for suffix in ('', '/summary', '/events'):
                code, result = self.request('GET', self.path + suffix, user=user)
                self.assertEqual(code, 401 if user is None else 404)
                self.assertEqual(set(result), {'error', 'correlation_id'})

    def test_privilege_and_scope_claims_rejected(self):
        for field in ('role', 'approved', 'verified', 'payer_id', 'tenant_id', 'seller_id', 'hold_released'):
            code, result = self.request('POST', self.base, {'reason_text': 'change', field: True})
            self.assertEqual((code, result['error']['code']), (400, 'INVALID_REQUEST'))
        self.assertEqual(self.request('POST', self.base, {'reason_text': 'change'}, user='staff')[0], 403)

    def test_no_external_approval_activation_or_non_reviewer_evidence_routes(self):
        view = self.ready_for_review()
        review = {'decision': 'APPROVE', 'reason': 'reviewed', 'expected_version': view['version']}
        self.assertEqual(self.request('POST', self.path + '/review', review, user='external')[0], 403)
        self.assertEqual(self.request('POST', self.path + '/review', review, user='owner')[0], 403)
        for action in ('activate', 'release-hold', 'payout', 'simulate-elapsed'):
            self.assertEqual(self.request('POST', self.path + '/' + action, {}, user='reviewer')[0], 404)
        # Evidence is a reviewer-only route from the browser console (decision 2026-11-11). Nobody else may use it.
        evidence = {'kind': 'SELLER_ENTITLEMENT', 'reference': 'record-1', 'reason': 'Reviewed records',
                    'accepted': True, 'expected_version': view['version']}
        for user in ('owner', 'staff', 'external'):
            self.assertEqual(self.request('POST', self.path + '/evidence', evidence, user=user)[0], 403, user)
        code, view = self.request('POST', self.path + '/review', review, user='reviewer')
        self.assertEqual(code, 200)
        self.assertEqual(view['state'], 'APPROVED_COOLING_OFF')
        self.assertFalse(view['payout_control']['proposed_destination_usable'])

    def test_csrf_origin_invalid_json_and_internal_errors_are_redacted(self):
        for options in ({'csrf': False}, {'origin': 'https://evil.example'}):
            code, view = self.request('POST', self.base, {'reason_text': 'change'}, **options)
            self.assertEqual(code, 403)
            self.assertTrue(view['correlation_id'])
        self.assertEqual(self.request('POST', self.base, raw=b'{broken')[0], 400)
        with patch.object(self.service, 'refresh', side_effect=RuntimeError('secret path traceback')):
            code, view = self.request('GET', self.path)
            self.assertEqual(code, 500)
            self.assertNotIn('secret path traceback', json.dumps(view))
            self.assertEqual(view['error']['code'], 'INTERNAL_ERROR')

    def test_creation_and_message_rate_limits(self):
        self.app.destination_api.create_limit = 1
        self.request('POST', self.base, {'reason_text': 'I opened a new account'})
        self.assertEqual(self.request('POST', self.base, {'reason_text': 'I opened a new account'})[0], 429)
        self.app.destination_api.message_limit = 1
        self.request('POST', self.path + '/messages', {'message': 'first'}, idem='first')
        self.assertEqual(self.request('POST', self.path + '/messages', {'message': 'second'}, idem='second')[0], 429)

    def test_fixed_callback_is_scoped_and_provider_owned(self):
        self.service.policy = replace(self.service.policy, mode='sandbox')
        code, auth = self.request('POST', self.path + '/auth/NEW', {})
        self.assertEqual(code, 200)
        self.assertEqual(urlparse(auth['authorization_url']).hostname, 'www.sandbox.paypal.com')
        query = parse_qs(urlparse(auth['authorization_url']).query)
        self.assertEqual(query['scope'], ['openid https://uri.paypal.com/services/paypalattributes'])
        self.assertEqual(query['redirect_uri'], ['https://rescue.example/api/v1/paypal/callback'])
        self.provider.identity.return_value = {'payer_id': 'BBBBBBBBBBBBB', 'verified_account': True}
        target = '/api/v1/paypal/callback?' + urlencode({'state': query['state'][0], 'code': 'synthetic-code'})
        self.assertEqual(self.request('GET', target, user='other')[0], 400)
        self.provider.identity.assert_not_called()
        code, view = self.request('GET', target)
        self.assertEqual(code, 200)
        self.assertEqual(view['state'], 'PENDING_OLD_ACCOUNT_AUTH')
        self.assertEqual(self.request('GET', target)[0], 400)
        self.assertEqual(self.provider.identity.call_count, 1)
        self.provider.identity.assert_called_with('synthetic-code', 'https://rescue.example/api/v1/paypal/callback')

    def test_status_endpoint_advances_expiry_using_backend_clock(self):
        self.now += 14 * 86400
        code, view = self.request('GET', self.path)
        self.assertEqual(code, 200)
        self.assertEqual(view['state'], 'EXPIRED')

    def test_replayed_old_message_never_invokes_model_after_case_changes(self):
        self.request('POST', self.path + '/messages', {'message': 'first'}, idem='first')
        # A later backend write makes the saved assessment stale.
        self.service.message(self.tokens['owner'], self.case_id, 'later information', 'later')
        calls = self.model.invoke.call_count
        code, view = self.request('POST', self.path + '/messages', {'message': 'first'}, idem='first')
        self.assertEqual(code, 200)
        self.assertNotIn('message_replayed', view)
        self.assertIsNone(view['ai_assessment'])
        self.assertEqual(self.model.invoke.call_count, calls)

    def test_prototype_browser_evidence_is_labelled_versioned_and_never_activates(self):
        view = self.ready_for_review()
        body = {'kind': 'SELLER_ENTITLEMENT', 'reference': 'browser-record', 'reason': 'Prototype reviewed record',
                'accepted': True, 'expected_version': view['version']}
        self.assertEqual(self.request('POST', self.path + '/evidence', body, user='reviewer', csrf=False)[0], 403)
        code, result = self.request('POST', self.path + '/evidence', body, user='reviewer')
        self.assertEqual(code, 200)
        self.assertEqual(result['state'], 'PENDING_REVIEW')
        self.assertFalse(result['payout_control']['proposed_destination_usable'])
        self.assertEqual(self.request('POST', self.path + '/evidence', body, user='reviewer')[0], 409)
        with self.ds.connect() as db:
            p = self.ds.principal(self.tokens['reviewer'])
            evidence = self.ds.case(db, p, self.case_id)['recovery_evidence'][-1]
        self.assertEqual(evidence['source'], 'REVIEWER_PROTOTYPE_ENTRY')
        self.service.policy = replace(self.service.policy, mode='production', version='test-production', production_configured=True)
        self.assertEqual(self.request('POST', self.path + '/evidence', body, user='reviewer')[0], 403)
