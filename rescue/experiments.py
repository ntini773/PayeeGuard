import json
import sqlite3
import time
import uuid
from .paypal import ProbeError, identifier


class Experiments:
    """Durable experiment IDs and evidence. Not a marketplace case database."""
    def __init__(self, path, paypal):
        self.paypal = paypal
        self.db = sqlite3.connect(path)
        self.db.execute('CREATE TABLE IF NOT EXISTS operations (name TEXT PRIMARY KEY, created REAL, payload TEXT, result TEXT)')
        self.db.execute('CREATE TABLE IF NOT EXISTS evidence (seq INTEGER PRIMARY KEY, at REAL, kind TEXT, data TEXT)')
        self.db.commit()

    def record(self, kind, data):
        self.db.execute('INSERT INTO evidence(at,kind,data) VALUES (?,?,?)', (time.time(), kind, json.dumps(data)))
        self.db.commit()
        return data

    def create(self, name, recipient, kind):
        identifier(name)
        if kind not in ('EMAIL', 'PAYPAL_ID') or not recipient:
            raise ProbeError('Invalid recipient')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row = self.db.execute('SELECT created,payload,result FROM operations WHERE name=?', (name,)).fetchone()
            if row:
                created, raw, result = row
                payload = json.loads(raw)
                item = payload['items'][0]
                if item['receiver'] != recipient or item['recipient_type'] != kind:
                    raise ProbeError('Experiment name already bound to another destination')
                if result:
                    self.db.commit()
                    return json.loads(result)
                if time.time() - created > 28 * 86400:
                    raise ProbeError('Retry too old; reconcile manually before any new payment')
            else:
                payload = {'sender_batch_header': {'sender_batch_id': 'rescue-' + uuid.uuid4().hex},
                    'items': [{'recipient_type': kind, 'receiver': recipient,
                        'amount': {'value': '0.01', 'currency': 'USD'}, 'sender_item_id': name}]}
                self.db.execute('INSERT INTO operations VALUES (?,?,?,NULL)', (name, time.time(), json.dumps(payload)))
            self.db.commit()  # ID survives even if the request times out.
        except Exception:
            self.db.rollback()
            raise
        result = self.paypal.create(payload)
        self.db.execute('UPDATE operations SET result=? WHERE name=?', (json.dumps(result), name))
        self.db.commit()
        return self.record('create:' + name, result)

    def cancel(self, item_id):
        before = self.record('before-cancel', self.paypal.item(item_id))
        if before.get('transaction_status') != 'UNCLAIMED':
            raise ProbeError('Cancellation requires fresh UNCLAIMED status')
        try:
            self.record('cancel-response', self.paypal.cancel(item_id))
        except ProbeError as exc:
            self.record('cancel-error', {'error': str(exc)})
        # A cancel response is never accepted as final state confirmation.
        after = self.record('after-cancel', self.paypal.item(item_id))
        return {'gate_passed': after.get('transaction_status') == 'RETURNED', 'item': after}
