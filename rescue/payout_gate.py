"""Only this backend path pays approved destinations. No HTTP/AI payout tool exists."""
import json
import re
import uuid
from decimal import Decimal, InvalidOperation
from .destination_errors import DestinationError
from .destination_service import key
from .destination_store import encode, name


class PayoutGate:
    def __init__(self, service, provider):
        self.service, self.store, self.provider = service, service.store, provider

    @staticmethod
    def _amount(value, currency):
        try:
            amount = Decimal(value)
            if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
                raise ValueError()
        except (ValueError, TypeError, InvalidOperation):
            raise DestinationError('INVALID_REQUEST') from None
        if not isinstance(currency, str) or not re.fullmatch('[A-Z]{3}', currency):
            raise DestinationError('INVALID_REQUEST')
        return format(amount, '.2f')

    @staticmethod
    def _public(operation):
        return {'needs_attention': operation['status'] in ('UNKNOWN', 'BLOCKED') or operation['provider_status'] not in ('SUCCESS', 'PENDING'), **{k: operation[k] for k in ('operation_key', 'sender_batch_id', 'status', 'amount', 'currency',
                'simulation', 'provider_batch_id', 'provider_status')}}

    def _controls(self, db, p, amount, currency):
        payee = self.store.payee(db, p)
        if payee['paused'] or currency != payee['currency'] or Decimal(amount) > Decimal(payee['cap']):
            raise DestinationError('PAYOUT_HELD', 409)
        if payee['compromised']:
            if self.service.policy.compromise_policy == 'pause':
                raise DestinationError('PAYOUT_HELD', 409)
            # A conservative aggregate exposure cap, including uncertain operations.
            rows = db.execute('SELECT data FROM pg_payouts WHERE tenant=? AND seller=?', (p.tenant, p.seller)).fetchall()
            exposure = sum((Decimal(json.loads(r[0])['amount']) for r in rows
                            if json.loads(r[0])['status'] != 'BLOCKED'), Decimal('0'))
            if exposure + Decimal(amount) > Decimal(payee['cap']):
                raise DestinationError('PAYOUT_HELD', 409)
        if payee['simulation'] and self.service.policy.mode != 'demo':
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        if self.service.policy.mode == 'demo' and not getattr(self.provider, 'simulated', False):
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        if self.service.policy.mode != 'demo' and getattr(self.provider, 'simulated', False):
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        return payee

    def execute(self, token, operation_key, *, amount, currency):
        # Backend marketplace reviewer only, never seller or external-agent grant.
        p = self.store.principal(token, 'review')
        operation_key, amount = key(operation_key), self._amount(amount, currency)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute('SELECT data FROM pg_payouts WHERE tenant=? AND seller=? AND operation_key=?',
                               (p.tenant, p.seller, operation_key)).fetchone()
            if prior:
                operation = json.loads(prior[0])
                if (operation['amount'], operation['currency']) != (amount, currency):
                    raise DestinationError('IDEMPOTENCY_CONFLICT', 409)
                return self._public(operation)  # Never create again, even after timeout/crash.
            # Timers are backend-evaluated before selecting the current stored payee.
            rows = db.execute('SELECT data FROM pg_cases WHERE tenant=? AND seller=?', (p.tenant, p.seller)).fetchall()
            for row in rows:
                self.service._refresh(db, p, json.loads(row[0]))
            payee = self._controls(db, p, amount, currency)
            batch_id = 'pg-' + uuid.uuid4().hex
            operation = {'operation_key': operation_key, 'sender_batch_id': batch_id, 'status': 'SUBMITTING',
                         'amount': amount, 'currency': currency, 'simulation': self.service.policy.mode == 'demo',
                         'payer_id': payee['active_payer_id'], 'payee_version': payee['version'],
                         'provider_batch_id': None, 'provider_status': 'UNKNOWN'}
            db.execute('INSERT INTO pg_payouts VALUES (?,?,?,?)', (p.tenant, p.seller, operation_key, encode(operation)))
            self.store.event(db, p.tenant, p.seller, None, p.user, 'PAYOUT_INTENT_RECORDED',
                             {'operation_key': operation_key, 'sender_batch_id': batch_id}, self.service.clock())
        # Intent is durable before the external call. Hold a write transaction while
        # rechecking payee/control state and dispatching; activation cannot race it.
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            grant = db.execute('SELECT * FROM pg_grants WHERE user_id=?', (p.user,)).fetchone()
            payee = self.store.payee(db, p)
            changed = (payee['version'] != operation['payee_version'] or payee['active_payer_id'] != operation['payer_id']
                       or payee['paused'] or not grant or not grant['review'] or grant['channel'] != 'browser'
                       or (grant['tenant'], grant['seller']) != (p.tenant, p.seller))
            try:
                # Zero additional exposure: this operation is already reserved.
                self._controls(db, p, '0.00', currency)
            except DestinationError:
                changed = True
            if changed:
                operation['status'] = 'BLOCKED'
            else:
                payload = {'sender_batch_header': {'sender_batch_id': batch_id}, 'items': [{
                    'recipient_type': 'PAYPAL_ID', 'receiver': operation['payer_id'],
                    'amount': {'value': amount, 'currency': currency}, 'sender_item_id': batch_id}]}
                try:
                    result = self.provider.create(payload)
                    operation['provider_batch_id'] = name(result['batch_header']['payout_batch_id'])
                    operation['status'] = 'RECONCILE_REQUIRED'
                except Exception as exc:
                    operation['status'] = 'UNKNOWN'
                    # ProbeError text is already bounded (HTTP code, error name, debug id). Keep it for the audit event.
                    operation['failure_hint'] = str(exc)[:200]
            db.execute('UPDATE pg_payouts SET data=? WHERE tenant=? AND seller=? AND operation_key=?',
                       (encode(operation), p.tenant, p.seller, operation_key))
            self.store.event(db, p.tenant, p.seller, None, p.user, 'PAYOUT_DISPATCH_RECORDED',
                             {'operation_key': operation_key, 'status': operation['status'], **({'failure_hint': operation['failure_hint']} if operation.get('failure_hint') else {})}, self.service.clock())
        if operation['provider_batch_id']:
            return self.reconcile(token, operation_key)
        return self._public(operation)

    def reconcile(self, token, operation_key, *, recovered_batch_id=None):
        """Read provider state; never retries create, cancels, or creates a replacement.

        If a timeout lost the provider ID, an operator can supply a batch ID from
        PayPal records. It is accepted only after all persisted bindings match.
        """
        p = self.store.principal(token, 'review')
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT data FROM pg_payouts WHERE tenant=? AND seller=? AND operation_key=?',
                             (p.tenant, p.seller, key(operation_key))).fetchone()
            if not row:
                raise DestinationError('CASE_NOT_FOUND', 404)
            operation = json.loads(row[0])
            batch_id = recovered_batch_id or operation['provider_batch_id']
            if operation['status'] == 'BLOCKED' or not batch_id:
                return self._public(operation)
            try:
                data = self.provider.batch(name(batch_id))
                header = data['batch_header']
                items = data['items']
                if header['payout_batch_id'] != batch_id or header['sender_batch_header']['sender_batch_id'] != operation['sender_batch_id'] or len(items) != 1:
                    raise ValueError()
                item = items[0]['payout_item']
                if (item['recipient_type'], item['receiver'], item['sender_item_id'], item['amount']['currency'], Decimal(item['amount']['value'])) != (
                        'PAYPAL_ID', operation['payer_id'], operation['sender_batch_id'], operation['currency'], Decimal(operation['amount'])):
                    raise ValueError()
                status = items[0]['transaction_status']
                if status not in ('SUCCESS', 'PENDING', 'UNCLAIMED', 'RETURNED', 'FAILED', 'BLOCKED', 'ONHOLD', 'DENIED', 'REFUNDED'):
                    raise ValueError()
                operation.update(provider_batch_id=batch_id, provider_status=status, status='RECONCILED')
            except Exception:
                self.store.event(db, p.tenant, p.seller, None, p.user, 'PAYOUT_RECONCILE_FAILED',
                                 {'operation_key': operation_key, 'reason_code': 'PROVIDER_READ_OR_BINDING_FAILED'}, self.service.clock())
                if operation['status'] != 'RECONCILED':
                    operation.update(status='UNKNOWN', provider_status='UNKNOWN')
                return self._public(operation)
            db.execute('UPDATE pg_payouts SET data=? WHERE tenant=? AND seller=? AND operation_key=?',
                       (encode(operation), p.tenant, p.seller, operation_key))
            self.store.event(db, p.tenant, p.seller, None, p.user, 'PAYOUT_RECONCILED',
                             {'operation_key': operation_key, 'provider_status': operation['provider_status']}, self.service.clock())
            return self._public(operation)
