"""Marketplace earnings integration: every dispatch goes through PayoutGate."""
import json
import time
from .destination_errors import DestinationError
from .destination_store import encode, name
from .payout_gate import PayoutGate


class MarketplacePayouts:
    def __init__(self, service, provider):
        self.service, self.store = service, service.store
        self.gate = PayoutGate(service, provider)

    def provision(self, tenant, seller, earning_id, *, amount, currency, received_at=None):
        """Trusted marketplace ledger import; no HTTP or model route to this method."""
        for value in (tenant, seller, earning_id):
            name(value)
        amount = PayoutGate._amount(amount, currency)
        data = {'earning_id': earning_id, 'amount': amount, 'currency': currency,
                'operation_key': 'earning:' + earning_id,
                # When the marketplace recorded the sale. The operator view shows sales that arrived after a request started.
                'received_at': float(received_at if received_at is not None else time.time())}
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT 1 FROM pg_payees WHERE tenant=? AND seller=?', (tenant, seller)).fetchone():
                raise DestinationError('SELLER_SCOPE_DENIED', 403)
            previous = db.execute('SELECT data FROM pg_earnings WHERE tenant=? AND seller=? AND id=?',
                                  (tenant, seller, earning_id)).fetchone()
            if previous:
                stored = json.loads(previous[0])
                if {k: v for k, v in stored.items() if k != 'received_at'} != {k: v for k, v in data.items() if k != 'received_at'}:
                    raise DestinationError('IDEMPOTENCY_CONFLICT', 409)
                return
            db.execute('INSERT INTO pg_earnings VALUES (?,?,?,?)', (tenant, seller, earning_id, encode(data)))
            self.store.event(db, tenant, seller, None, 'marketplace-ledger', 'EARNING_RECORDED', {'earning_id': earning_id})

    def _earning(self, token, earning_id, permission=None):
        p = self.store.principal(token, permission)
        with self.store.connect() as db:
            self.store.authorize(db, p)
            row = db.execute('SELECT data FROM pg_earnings WHERE tenant=? AND seller=? AND id=?',
                             (p.tenant, p.seller, name(earning_id))).fetchone()
        if not row:
            self.store.denied(p, 'EARNING_SCOPE_DENIED')
            raise DestinationError('CASE_NOT_FOUND', 404)
        return json.loads(row[0])

    def list(self, token):
        p = self.store.principal(token)
        with self.store.connect() as db:
            self.store.authorize(db, p)
            rows = db.execute('SELECT e.data AS earning,p.data AS payout FROM pg_earnings e LEFT JOIN pg_payouts p '
                "ON e.tenant=p.tenant AND e.seller=p.seller AND p.operation_key=json_extract(e.data,'$.operation_key') "
                'WHERE e.tenant=? AND e.seller=? ORDER BY e.id LIMIT 100', (p.tenant, p.seller)).fetchall()
        return [dict(json.loads(row['earning']), payout=PayoutGate._public(json.loads(row['payout'])) if row['payout'] else None)
                for row in rows]

    def execute(self, token, earning_id):
        earning = self._earning(token, earning_id, 'review')
        # There is no request-supplied amount, currency or destination here.
        return self.gate.execute(token, earning['operation_key'], amount=earning['amount'], currency=earning['currency'])

    def reconcile(self, token, earning_id):
        earning = self._earning(token, earning_id, 'review')
        return self.gate.reconcile(token, earning['operation_key'])
