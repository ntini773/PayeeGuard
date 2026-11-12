"""Live AI review for an operator. It runs the read-only investigator in the background and records each step.

The operator clicks AI Review, then polls for steps. The run can only read: case status, seller messages,
missing evidence, and recent payouts (backend records plus a PayPal read). It writes one advisory assessment
through the same service path as every other assessment and can change no state.
"""
import secrets
import threading
import time
from .destination_errors import DestinationError


class PayPalAwareReader:
    """Wraps the backend reader and adds one read-only tool: recent payouts, checked against PayPal."""

    def __init__(self, inner, service, token, provider):
        self._inner, self._service, self._token, self._provider = inner, service, token, provider
        self._case_id = getattr(inner, '_case_id', None)

    def snapshot(self):
        return self._inner.snapshot()

    def seller_messages(self):
        return self._inner.seller_messages()

    def risk_audit(self):
        return self._service.risk_audit(self._token, self._case_id)

    def payout_history(self, limit=3):
        p = self._service.store.principal(self._token)
        with self._service.store.connect() as db:
            self._service.store.authorize(db, p)
            rows = db.execute('SELECT data FROM pg_payouts WHERE tenant=? AND seller=? ORDER BY rowid DESC LIMIT ?',
                              (p.tenant, p.seller, limit)).fetchall()
        import json
        history = []
        for row in rows:
            op = json.loads(row[0])
            paypal_status = 'NOT_SENT'
            if op.get('provider_batch_id'):
                try:  # a read-only GET to PayPal. No create, cancel or retry exists here.
                    data = self._provider.batch(op['provider_batch_id'])
                    items = data.get('items') or []
                    paypal_status = (items[0].get('transaction_status') if items else None) or \
                        data.get('batch_header', {}).get('batch_status') or 'UNKNOWN'
                except Exception:
                    paypal_status = 'PAYPAL_UNREACHABLE'
            payer = str(op.get('payer_id') or '')
            history.append({'amount': '%s %s' % (op.get('amount'), op.get('currency')),
                            'receiver': '***-' + payer[-4:] if payer else None,
                            'backend_status': op.get('status'), 'paypal_status': paypal_status,
                            'simulated': bool(op.get('simulation'))})
        return history


class AiReviewRunner:
    MAX_RUNS = 50
    READ_FIRST = ('get_case_status', 'get_seller_claims', 'get_missing_evidence', 'get_recent_payouts', 'get_account_audit')

    def __init__(self, service, provider):
        self._service, self._provider = service, provider
        self._runs, self._lock = {}, threading.Lock()

    @staticmethod
    def _reviewer(service, token):
        p = service.store.principal(token, 'review')
        if p.channel != 'browser':
            raise DestinationError('REQUEST_DENIED', 403)
        return p

    def start(self, token, case_id, model=None):
        from .destination_reader import BackendCaseReader
        service = self._service
        p = self._reviewer(service, token)
        reader = PayPalAwareReader(BackendCaseReader(service, token, case_id), service, token, self._provider)
        reader.snapshot()  # a case outside this reviewer's scope fails here, before any model or PayPal call
        with self._lock:
            if any(r['case_id'] == case_id and r['status'] == 'running' for r in self._runs.values()):
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            run_id = secrets.token_hex(16)
            run = {'id': run_id, 'case_id': case_id, 'user': p.user, 'status': 'running', 'events': [], 'started': time.time()}
            self._runs[run_id] = run
            for old in sorted(self._runs, key=lambda k: self._runs[k]['started'])[:-self.MAX_RUNS]:
                del self._runs[old]

        def add(event):
            with self._lock:
                run['events'].append({'seq': len(run['events']) + 1, 'at': time.time(), **event})

        def work():
            add({'kind': 'start', 'label': 'AI review started', 'detail': 'Read-only. It cannot change this case.'})
            try:
                service.assess(token, case_id, model, on_event=add, reader=reader, always_read=self.READ_FIRST)
                add({'kind': 'final', 'label': 'Assessment saved', 'detail': 'Advisory only. The case did not change.'})
                status = 'done'
            except Exception:
                add({'kind': 'error', 'label': 'The review could not finish', 'detail': 'Nothing was changed.'})
                status = 'failed'
            with self._lock:
                run['status'] = status

        threading.Thread(target=work, daemon=True).start()
        return run_id

    def status(self, token, case_id, run_id):
        p = self._reviewer(self._service, token)
        with self._lock:
            run = self._runs.get(run_id)
            if not run or run['case_id'] != case_id or run['user'] != p.user:
                raise DestinationError('CASE_NOT_FOUND', 404)
            return {'run_id': run_id, 'status': run['status'], 'events': list(run['events'])}
