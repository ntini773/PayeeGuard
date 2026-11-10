"""Deterministic fallback workflow; this application never sends sandbox replacements."""
import hashlib
import json
import threading
import time
import uuid
from decimal import Decimal, InvalidOperation
from .paypal import ProbeError
from .store import Denied


class DemoPayPal:
    """Explicitly simulated provider, isolated from sandbox requests."""
    def item(self, item_id):
        return {'payout_item_id': item_id, 'transaction_status': 'UNCLAIMED',
                'payout_item': {'amount': {'value': '0.01', 'currency': 'USD'}},
                'errors': {'name': 'RECEIVER_UNREGISTERED'}}

    def cancel(self, item_id):
        raise ProbeError('SIMULATED HTTP 500 INTERNAL_SERVICE_ERROR; mirrors observed sandbox failure')


class Workflow:
    def __init__(self, store, paypal):
        self.store, self.paypal = store, paypal
        self.lock = threading.RLock()
        self.mode = store.metadata('mode')
        if self.mode == 'demo' and not isinstance(paypal, DemoPayPal):
            raise Denied('Demo requires the isolated simulated provider')
        if self.mode == 'sandbox' and isinstance(paypal, DemoPayPal):
            raise Denied('Sandbox cannot use simulated evidence')

    @staticmethod
    def recipient(actor, case):
        if actor['role'] != 'recipient' or actor['user_id'] != case['owner']:
            raise Denied('Only the intended marketplace recipient may perform this action')

    @staticmethod
    def operator(actor):
        if actor['role'] != 'operator':
            raise Denied('Marketplace operator approval required')

    def match(self, case):
        payee = self.store.payee(case['owner'])
        identity = case.get('identity')
        if not identity:
            return {'sufficient': False, 'reason': 'Authenticate the PayPal destination first'}
        if not identity.get('verified_account'):
            return {'sufficient': False, 'reason': 'PayPal account is not verified'}
        if not payee.get('expected_payer_id') or identity['payer_id'] != payee['expected_payer_id']:
            return {'sufficient': False, 'reason': 'Authenticated payer ID does not match the established payee record; manual review required'}
        if identity.get('mode') != case['mode']:
            return {'sufficient': False, 'reason': 'Evidence mode mismatch'}
        return {'sufficient': True, 'reason': 'Exact payer-ID match to established marketplace fixture; operator approval still required'}

    def identity(self, case_id, actor, evidence):
        with self.lock:
            case = self.store.case(case_id, actor)
            self.recipient(actor, case)
            if case['state'] in ('CANCELLATION_PENDING', 'RETURNED_NO_REPLACEMENT', 'CLOSED_SIMULATED'):
                raise Denied('Destination cannot change after cancellation has started')
            payer = evidence.get('payer_id')
            if not isinstance(payer, str) or not payer or len(payer) > 100:
                raise Denied('Missing authenticated payer ID')
            verified = evidence.get('verified_account')
            if verified not in (True, False, 'true', 'false'):
                raise Denied('Invalid account verification evidence')
            case['identity'] = {'payer_id': payer, 'verified_account': verified is True or verified == 'true',
                                'mode': self.mode, 'authenticated_at': time.time()}
            case['approval'] = None
            case['proposal'] = None
            match = self.match(case)
            case['state'] = 'DESTINATION_VERIFIED' if match['sufficient'] else 'ESCALATED'
            self.store.save(case, actor, 'destination_authenticated', {'identity': case['identity'], 'match': match})
            return case

    def refresh(self, case_id, actor):
        with self.lock:
            case = self.store.case(case_id, actor)
            if case['state'] == 'CLOSED_SIMULATED':
                return case
            try:
                result = self.paypal.item(case['original_item_id'])
                if result.get('payout_item_id') != case['original_item_id']:
                    raise ProbeError('Provider returned a different payout item')
                money = result.get('payout_item', {}).get('amount', {})
                try:
                    valid = (Decimal(money.get('value', 'NaN')) == Decimal(case['amount']) and money.get('currency') == case['currency'])
                except InvalidOperation:
                    valid = False
                if not valid:
                    raise ProbeError('Payout amount/currency differs from marketplace entitlement')
            except ProbeError as exc:
                case['paypal_status'] = 'UNKNOWN'
                case['status_checked_at'] = None
                case['approval'] = None
                if case['state'] != 'CANCELLATION_PENDING':
                    case['state'] = 'INVESTIGATION_REQUIRED'
                self.store.save(case, actor, 'status_lookup_failed', {'error': str(exc)})
                raise
            case['paypal_status'] = result.get('transaction_status', 'UNKNOWN')
            case['reason'] = result.get('errors', {}).get('name')
            case['status_checked_at'] = time.time()
            if case['paypal_status'] == 'SUCCESS':
                case['state'] = 'ORIGINAL_PAID'
                case['approval'] = None
            elif case['paypal_status'] == 'RETURNED':
                case['state'] = 'RETURNED_NO_REPLACEMENT'
            elif case['paypal_status'] != 'UNCLAIMED':
                case['state'] = 'INVESTIGATION_REQUIRED'
                case['approval'] = None
            self.store.save(case, actor, 'payout_status_retrieved', {'status': case['paypal_status'], 'reason': case['reason'], 'mode': self.mode})
            return case

    def message(self, case_id, actor, text):
        with self.lock:
            case = self.store.case(case_id, actor)
            self.recipient(actor, case)
            if not isinstance(text, str) or not 1 <= len(text.strip()) <= 4000:
                raise Denied('Message must contain 1–4000 characters')
            case['messages'].append({'role': 'user', 'content': text.strip()})
            # Any new recipient information requires a fresh decision, never silently retains approval.
            case['approval'] = None
            case['proposal'] = None
            if case['state'] not in ('CANCELLATION_PENDING', 'RETURNED_NO_REPLACEMENT', 'CLOSED_SIMULATED', 'ORIGINAL_PAID'):
                case['state'] = 'INVESTIGATING'
            self.store.save(case, actor, 'recipient_message', {'message': text.strip()})
            return case

    def propose(self, case_id, actor, action, explanation):
        with self.lock:
            case = self.store.case(case_id, actor)
            self.recipient(actor, case)
            if action not in ('claim_original', 'authenticate', 'change_destination', 'escalate', 'clarify'):
                raise Denied('Unsupported proposed action')
            if not isinstance(explanation, str) or not 1 <= len(explanation) <= 2000:
                raise Denied('Invalid explanation')
            if case['state'] in ('CANCELLATION_PENDING', 'RETURNED_NO_REPLACEMENT', 'CLOSED_SIMULATED', 'ORIGINAL_PAID'):
                raise Denied('Case is already in payment handling; use status refresh')
            case['approval'] = None
            if action == 'change_destination':
                if not self.match(case)['sufficient']:
                    raise Denied('Destination evidence is insufficient')
                if case['paypal_status'] != 'UNCLAIMED' or not case['status_checked_at'] or time.time() - case['status_checked_at'] > 300:
                    raise Denied('A recent UNCLAIMED status is required')
                case['state'] = 'AWAITING_APPROVAL'
            else:
                case['state'] = {'claim_original': 'CLAIM_ASSISTANCE', 'authenticate': 'AWAITING_AUTH',
                                 'escalate': 'ESCALATED', 'clarify': 'NEEDS_INFORMATION'}[action]
            case['proposal'] = {'action': action, 'explanation': explanation, 'at': time.time()}
            self.store.save(case, actor, 'action_proposed', case['proposal'])
            return case

    def fingerprint(self, case):
        data = {key: case[key] for key in ('owner', 'original_item_id', 'amount', 'currency', 'identity', 'proposal')}
        data['payee'] = self.store.payee(case['owner'])
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def approve(self, case_id, actor, version, approve):
        with self.lock:
            self.operator(actor)
            case = self.store.case(case_id, actor)
            if case['version'] != version:
                raise Denied('Case changed since review; reload and review again')
            if case['state'] != 'AWAITING_APPROVAL' or not self.match(case)['sufficient']:
                raise Denied('No eligible destination-change proposal')
            case['approval'] = {'operator': actor['user_id'], 'approved': approve,
                                'fingerprint': self.fingerprint(case), 'at': time.time()}
            case['state'] = 'APPROVED' if approve else 'ESCALATED'
            self.store.save(case, actor, 'operator_approved' if approve else 'operator_rejected', case['approval'])
            return case

    def approved(self, case):
        approval = case.get('approval')
        return (approval and approval['approved'] is True and self.match(case)['sufficient']
                and approval['fingerprint'] == self.fingerprint(case))

    def cancel(self, case_id, actor):
        with self.lock:
            self.operator(actor)
            case = self.store.case(case_id, actor)
            if case['state'] == 'CANCELLATION_PENDING':
                return self.refresh(case_id, actor)  # repeated clicks/restarts only reconcile
            if case['state'] != 'APPROVED' or not self.approved(case):
                raise Denied('Current operator approval and matching evidence are required')
            case = self.refresh(case_id, actor)
            if case['paypal_status'] != 'UNCLAIMED' or not self.approved(case):
                raise Denied('Original is not safely cancellable')
            case['state'] = 'CANCELLATION_PENDING'
            self.store.save(case, actor, 'cancellation_started', {'item_id': case['original_item_id']})
            try:
                self.paypal.cancel(case['original_item_id'])
            except ProbeError as exc:
                case['cancellation_error'] = str(exc)
                self.store.save(case, actor, 'cancellation_error', {'error': str(exc)})
            # Never infer RETURNED from the cancellation response, including after timeout.
            return self.refresh(case_id, actor)

    def simulate_recovery(self, case_id, actor):
        with self.lock:
            self.operator(actor)
            case = self.store.case(case_id, actor)
            if self.mode != 'demo':
                raise Denied('Simulation is disabled for sandbox cases; no real replacement API exists here')
            if case['replacement']:
                return case
            if case['state'] != 'CANCELLATION_PENDING' or not self.approved(case):
                raise Denied('First complete verification, approval and the failure demonstration')
            case['paypal_status'] = 'RETURNED'
            self.store.save(case, actor, 'SIMULATED_RETURNED', {'simulated': True})
            # Exact approved amount/destination; fake identifiers cannot be confused with PayPal IDs.
            case['replacement'] = {'id': 'SIM-REPLACEMENT-' + uuid.uuid4().hex,
                'payer_id': case['identity']['payer_id'], 'amount': case['amount'], 'currency': case['currency'],
                'status': 'SIMULATED_SUCCESS', 'simulated': True}
            case['state'] = 'CLOSED_SIMULATED'
            self.store.save(case, actor, 'SIMULATED_REPLACEMENT', case['replacement'])
            return case
