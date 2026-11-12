"""Authenticated v1 routing. Browser CSRF/host checks run in the existing handler."""
import re
import threading
import time
import uuid
from urllib.parse import parse_qs, urlencode, urlparse
from .destination_errors import DestinationError


class UnavailableModel:
    def invoke(self, messages):
        raise RuntimeError('No live model in fixture mode')


class DestinationAPI:
    ROOT = '/api/v1/destination-change-requests'

    def __init__(self, service, provider, *, origin=None, model=None, payouts=None):
        self.service, self.provider = service, provider
        self.origin = origin or 'http://127.0.0.1:8765'
        self.model = model
        self.payouts = payouts
        self._rates, self._lock = {}, threading.Lock()
        from .ai_review import AiReviewRunner
        self.ai_review = AiReviewRunner(service, provider)
        self.create_limit, self.message_limit = 10, 20

    def _scopes(self):
        scopes = getattr(self.provider, 'scopes', None)
        return scopes if isinstance(scopes, str) and scopes else 'openid https://uri.paypal.com/services/paypalattributes'

    def _rate(self, principal, action):
        now = time.monotonic()
        bucket = (principal.tenant, principal.seller, action)
        with self._lock:
            self._rates = {k: [t for t in v if now - t < 60] for k, v in self._rates.items() if v and now - v[-1] < 60}
            recent = self._rates.get(bucket, [])
            limit = self.create_limit if action == 'create' else self.message_limit
            if len(recent) >= limit:
                raise DestinationError('RATE_LIMITED', 429)
            self._rates[bucket] = recent + [now]

    @staticmethod
    def _body(body, required, optional=()):
        if not isinstance(body, dict) or not set(required) <= set(body) or set(body) - set(required) - set(optional):
            raise DestinationError('INVALID_REQUEST')

    def handle(self, method, target, token, body=None, headers=None):
        correlation = uuid.uuid4().hex
        try:
            status, result = self.dispatch(method, target, token, body, headers or {}, correlation)
            return status, dict(result, correlation_id=correlation)
        except DestinationError as exc:
            return exc.status, {'error': {'code': exc.code}, 'correlation_id': correlation}
        except Exception:
            return 500, {'error': {'code': 'INTERNAL_ERROR'}, 'correlation_id': correlation}

    def dispatch(self, method, target, token, body, headers, correlation):
        service = self.service
        p = service.store.principal(token, correlation=correlation)
        url = urlparse(target)
        path = url.path
        if path == '/api/v1/cases' and method == 'GET':
            q = parse_qs(url.query, keep_blank_values=True)
            if set(q) - {'limit', 'before'} or any(len(v) != 1 for v in q.values()):
                raise DestinationError('INVALID_REQUEST')
            try:
                limit = int(q.get('limit', ['50'])[0])
            except ValueError:
                raise DestinationError('INVALID_REQUEST') from None
            cases = service.operator_cases(token, limit=limit, before=q.get('before', [None])[0])
            return 200, {'cases': cases, 'next_cursor': cases[-1]['case_id'] if len(cases) == limit else None}
        if path == self.ROOT and method == 'GET':
            query = parse_qs(url.query, keep_blank_values=True)
            if set(query) - {'limit', 'before'} or any(len(v) != 1 for v in query.values()):
                raise DestinationError('INVALID_REQUEST')
            try:
                limit = int(query.get('limit', ['50'])[0])
            except ValueError:
                raise DestinationError('INVALID_REQUEST') from None
            return 200, {'cases': service.list_cases(token, limit=limit, before=query.get('before', [None])[0])}
        if path.startswith('/api/v1/marketplace-payouts'):
            if self.payouts is None:
                raise DestinationError('NOT_FOUND', 404)
            if path == '/api/v1/marketplace-payouts' and method == 'GET':
                return 200, {'earnings': self.payouts.list(token)}
            payout = re.fullmatch(r'/api/v1/marketplace-payouts/([A-Za-z0-9_-]{1,100})/(execute|reconcile)', path)
            if payout and method == 'POST':
                self._body(body, ())
                operation = getattr(self.payouts, payout[2])(token, payout[1])
                return 200, {'operation': operation}
            raise DestinationError('NOT_FOUND', 404)
        if path == '/api/v1/seller-guide/draft' and method == 'POST':
            service.store.principal(token, 'manage', correlation)  # sellers only; the draft is text for the seller to review
            self._rate(p, 'message')
            self._body(body, ('messages',))
            from .seller_guide import draft_request
            try:
                return 200, draft_request(body['messages'], self.model)
            except ValueError:
                raise DestinationError('INVALID_REQUEST') from None
        if path == '/api/v1/seller-guide' and method == 'POST':
            service.store.principal(token, 'manage', correlation)  # sellers only; it never sees a case
            self._rate(p, 'message')
            self._body(body, ('messages',))
            from .seller_guide import guide_reply
            try:
                return 200, guide_reply(body['messages'], self.model)
            except ValueError:
                raise DestinationError('INVALID_REQUEST') from None
        if path == '/api/v1/dashboard-llm' and method == 'POST':
            service.store.principal(token, None, correlation)    # any signed-in seller or care user; no case data is attached here
            self._rate(p, 'message')
            from .dashboard_llm import LlmError, forward
            from .config import settings
            from .dashboard_llm import DEFAULT_STUDIO_MODEL
            cfg = settings()
            key = cfg.get('NVIDIA_API_KEY') or cfg.get('AI_API_KEY')
            if not key:
                raise DestinationError('AI_UNAVAILABLE', 503)
            try:
                return 200, forward(body, key, cfg.get('RESCUE_STUDIO_MODEL') or DEFAULT_STUDIO_MODEL)
            except LlmError:
                raise DestinationError('INVALID_REQUEST') from None
        if path == '/api/v1/dashboard-assist' and method == 'POST':
            principal = service.store.principal(token, None, correlation)   # no case data is involved
            scope = 'care' if principal.review and principal.channel == 'browser' else 'seller' if principal.manage else None
            if scope is None:
                raise DestinationError('AUTHORIZATION_DENIED', 403)
            self._rate(p, 'message')
            self._body(body, ('question',))
            from .dashboard_assist import pick_view
            try:
                return 200, pick_view(body['question'], scope, getattr(self, 'dashboard_router', None), getattr(self, 'dashboard_checker', None))  # never the core model
            except ValueError:
                raise DestinationError('INVALID_REQUEST') from None
        if path == self.ROOT and method == 'POST':
            self._rate(p, 'create')
            view = service.create(token, body, headers.get('Idempotency-Key'), correlation)
            if not service.assessment_current(token, view['case_id']):
                view = service.assess(token, view['case_id'], self.model)
            return 201, view
        if path == '/api/v1/paypal/callback' and method == 'GET':
            query = parse_qs(url.query, keep_blank_values=True)
            if len(query.get('code', [])) != 1 or len(query.get('state', [])) != 1 or 'error' in query:
                raise DestinationError('PAYPAL_CALLBACK_INVALID')
            if service.policy.mode != 'sandbox':
                raise DestinationError('PAYPAL_CALLBACK_INVALID')
            case_id, purpose = service.auth_binding(token, query['state'][0])
            view = service.callback(token, case_id, purpose, query['state'][0], query['code'][0],
                                    self.provider, self.origin + path, correlation)
            return 200, view
        match = re.fullmatch(re.escape(self.ROOT) + r'/(chg_[a-f0-9]{32})(?:/(summary|events|messages|review|recovery|auth/(?:NEW|OLD)|evidence|cancel|ai-review(?:/[a-f0-9]{32})?))?', path)
        if not match:
            raise DestinationError('NOT_FOUND', 404)
        case_id, action = match.groups()
        if action and action.startswith('ai-review'):
            if method == 'POST' and action == 'ai-review':
                self._body(body, ())
                self._rate(p, 'message')
                return 200, {'run_id': self.ai_review.start(token, case_id, self.model)}
            if method == 'GET' and action != 'ai-review':
                return 200, self.ai_review.status(token, case_id, action.split('/')[1])
            raise DestinationError('NOT_FOUND', 404)
        if method == 'GET' and action in (None, 'summary', 'events'):
            view = service.refresh(token, case_id)
            if action == 'summary':
                return 200, service.summary(token, case_id)
            if action == 'events':
                return 200, {'case_id': case_id, 'events': service.events(token, case_id)}
            return 200, view
        if method != 'POST':
            raise DestinationError('NOT_FOUND', 404)
        try:
            if action == 'messages':
                self._body(body, ('message',))
                self._rate(p, 'message')
                view = service.message(token, case_id, body['message'], headers.get('Idempotency-Key'), correlation)
                # Idempotent replay does not trigger a second model call.
                replayed = view.pop('message_replayed')
                if not replayed and not service.assessment_current(token, case_id):
                    view = service.assess(token, case_id, self.model)
                return 200, view
            if action == 'cancel':
                self._body(body, ())
                return 200, service.cancel(token, case_id, correlation)
            if action == 'evidence':
                if service.policy.mode not in ('demo', 'sandbox'):
                    raise DestinationError('REQUEST_DENIED', 403)
                # Marketplace evidence is a reviewer act, from the browser console only. Never sellers or agents.
                self._body(body, ('kind', 'reference', 'reason', 'accepted', 'expected_version'))
                reviewer = service.store.principal(token, 'review', correlation)
                if reviewer.channel != 'browser':
                    raise DestinationError('REQUEST_DENIED', 403)
                return 200, service.record_evidence(token, case_id, kind=body['kind'], reference=body['reference'],
                                                     reason=body['reason'], accepted=body['accepted'],
                                                     expected_version=body['expected_version'], source='REVIEWER_PROTOTYPE_ENTRY')
            if action == 'review':
                self._body(body, ('decision', 'reason', 'expected_version'))
                return 200, service.review(token, case_id, body['decision'], body['reason'], body['expected_version'], correlation)
            if action == 'recovery':
                self._body(body, ('reason_text',))
                return 200, service.recovery(token, case_id, body['reason_text'], correlation)
            if action and action.startswith('auth/'):
                self._body(body, ())
                if service.policy.mode != 'sandbox':
                    raise DestinationError('PAYPAL_AUTH_PENDING', 409)
                purpose = action.split('/')[1]
                redirect = self.origin + '/api/v1/paypal/callback'
                state = service.begin_auth(token, case_id, purpose, correlation)
                return 200, {'authorization_url': 'https://www.sandbox.paypal.com/connect?' + urlencode({
                    'flowEntry': 'static', 'client_id': self.provider.client_id, 'response_type': 'code',
                    'redirect_uri': redirect, 'scope': self._scopes(), 'state': state}),
                    'case_id': case_id, 'purpose': purpose}
        except DestinationError as exc:
            if exc.code == 'INVALID_REQUEST':
                service.store.denied(p, 'INVALID_REQUEST', correlation)
            raise
        raise DestinationError('NOT_FOUND', 404)
