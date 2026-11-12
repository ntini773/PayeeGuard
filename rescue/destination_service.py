"""Central destination lifecycle. Model results are persisted separately, never executed."""
import hashlib
from dataclasses import replace
from functools import wraps
import json
import re
import secrets
import time
import uuid
from .destination_errors import DestinationError
from .destination_store import encode, name
from .destination_policy import Policy, evaluate, OPEN, TERMINAL
from .destination_risk import derive_paypal_facts, fast_lane_status, is_blocked, risk_findings, signal_ages

AUTO_ACTOR = 'policy:fast-lane'


def text(value, maximum=4000):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise DestinationError('INVALID_REQUEST')
    return value.strip()


def key(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', value):
        raise DestinationError('INVALID_REQUEST')
    return value


def masked(value):
    return '***-' + value[-4:] if value else None


def safe_text(value):
    # Seller text is not a credential channel. Scrub identifier/key-shaped content
    # in views sent to either the investigator or ordinary callers.
    value = re.sub(r'\b[A-Z0-9]{13}\b', '[REDACTED_ID]', value)
    value = re.sub(r'\bnvapi-[A-Za-z0-9_-]+', '[REDACTED]', value)
    return re.sub(r'(?i)\b(?:access_token|client_secret|password|oauth_state|session_cookie)\s*[:=]\s*\S+',
                  '[REDACTED]', value)


def audit_scope_failure(method):
    @wraps(method)
    def wrapped(self, token, *args, **kwargs):
        try:
            return method(self, token, *args, **kwargs)
        except DestinationError as exc:
            if exc.code == 'CASE_NOT_FOUND':
                try:
                    p = self.store.principal(token)
                    self.store.denied(p, 'CASE_SCOPE_DENIED', kwargs.get('correlation'))
                except DestinationError:
                    pass
            raise
    return wrapped


def redact(value):
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return safe_text(value) if isinstance(value, str) else value


class DestinationService:
    def __init__(self, store, *, clock=time.time, policy=None):
        self.store, self.clock = store, clock
        self.policy = policy or Policy()

    def create(self, token, payload, request_key, correlation=None):
        p = self.store.principal(token, 'manage', correlation)
        if not isinstance(payload, dict) or set(payload) - {'reason_text', 'reason_category'}:
            self.store.denied(p, 'INVALID_REQUEST', correlation)
            raise DestinationError('INVALID_REQUEST')
        reason = {'seller_text': text(payload.get('reason_text')),
                  'category_claimed_by_seller': text(payload['reason_category'], 80) if 'reason_category' in payload else None}
        request_key = key(request_key)
        fingerprint = hashlib.sha256(encode(reason).encode()).hexdigest()
        now = self.clock()
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute("SELECT payload,resource FROM pg_requests WHERE tenant=? AND seller=? AND kind='create' AND key=?",
                               (p.tenant, p.seller, request_key)).fetchone()
            if prior:
                if prior['payload'] != fingerprint:
                    raise DestinationError('IDEMPOTENCY_CONFLICT', 409)
                return self._view(db, p, self.store.case(db, p, prior['resource']))
            payee = self.store.payee(db, p)
            existing = db.execute("SELECT 1 FROM pg_cases WHERE tenant=? AND seller=? AND "
                "json_extract(data,'$.state') NOT IN ('REJECTED','EXPIRED','ACTIVE_NEW_DESTINATION','ACTIVE')",
                (p.tenant, p.seller)).fetchone()
            if existing:
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            case = {'case_id': 'chg_' + uuid.uuid4().hex, 'tenant_id': p.tenant, 'seller_id': p.seller,
                    'state': 'CHANGE_REQUESTED', 'version': 1, 'created_at': now, 'updated_at': now,
                    'reason': reason, 'messages': [reason['seller_text']],
                    'active_at_request': payee['active_payer_id'], 'payee_version': payee['version'],
                    'proposed_payer_id': None,
                    'authentication': {'new_account': {'status': 'NOT_STARTED'}, 'old_account': {'status': 'NOT_STARTED'}},
                    'marketplace_review': {'decision': None}, 'cooling_off': {'status': 'NOT_STARTED', 'ends_at': None},
                    'policy_version': self.policy.version, 'policy_decision': 'HOLD', 'recovery_evidence': [], 'risk_flags': [],
                    'expires_at': now + self.policy.request_seconds, 'simulation': False}
            db.execute('INSERT INTO pg_cases VALUES (?,?,?,?)', (case['case_id'], p.tenant, p.seller, encode(case)))
            db.execute('INSERT INTO pg_requests VALUES (?,?,?,?,?,?)',
                       (p.tenant, p.seller, 'create', request_key, fingerprint, case['case_id']))
            self.store.event(db, p.tenant, p.seller, case['case_id'], p.user, 'DESTINATION_CHANGE_REQUESTED',
                             {'previous_state': 'ACTIVE', 'new_state': case['state'], 'reason': 'SELLER_REQUEST',
                              'policy_version': case['policy_version'], 'evidence_refs': [], 'correlation_id': correlation}, now)
            return self._view(db, p, case)

    def _view(self, db, p, case):
        payee = self.store.payee(db, p)
        row = db.execute('SELECT * FROM pg_assessments WHERE case_id=? AND tenant=? AND seller=? ORDER BY seq DESC LIMIT 1',
                         (case['case_id'], p.tenant, p.seller)).fetchone()
        assessment = redact(json.loads(row['data'])) if row else None
        if assessment:
            assessment['stale'] = row['case_version'] != case['version']
        if not (p.review and p.channel == 'browser'):
            assessment = None
        review = redact(case['marketplace_review'])
        if not (p.review and p.channel == 'browser'):
            review = {k: v for k, v in review.items() if k in ('decision', 'at')}
        reviewer_view = bool(p.review and p.channel == 'browser')
        findings = risk_findings(case, self.store.signals(db, p), self.policy, self.clock()) if reviewer_view else None
        return {'case_id': case['case_id'], 'tenant_id': p.tenant, 'seller_id': p.seller,
                'state': case['state'], 'version': case['version'], 'created_at': case['created_at'],
                'updated_at': case['updated_at'], 'reason': {'seller_text': safe_text(case['reason']['seller_text']),
                'category_claimed_by_seller': safe_text(case['reason']['category_claimed_by_seller'] or '')},
                'destinations': {'active': {'masked_payer_id': masked(payee['active_payer_id'])},
                                 'proposed': {'masked_payer_id': masked(case['proposed_payer_id'])}},
                'authentication': case['authentication'], 'marketplace_review': review,
                'cooling_off': case['cooling_off'], 'policy_decision': case['policy_decision'],
                'payout_control': {'proposed_destination_usable': case['state'] == 'ACTIVE_NEW_DESTINATION'
                                  and payee['active_payer_id'] == case['proposed_payer_id'] and not payee['paused'],
                                  'active_destination_paused': payee['paused'],
                                  'hold_reason': None if case['state'] in ('ACTIVE', 'ACTIVE_NEW_DESTINATION') else case['policy_decision']},
                'simulation': case.get('simulation', False), 'expires_at': case['expires_at'],
                'reviewer_findings': case.get('reviewer_findings', []) if p.review and p.channel == 'browser' else [],
                'ai_assessment': assessment, 'authorization_model': 'PROTOTYPE_BACKEND_GRANTS',
                # Reviewer-only, like the AI assessment: a seller must not learn what trips the flags.
                **({'risk_findings': findings, 'risk_blocks_approval': is_blocked(findings),
                    'risk_signals_source': (self.store.signals(db, p) or {}).get('source'),
                    'fast_lane': fast_lane_status(case, self.store.signals(db, p), payee, self.policy, self.clock()),
                    'paypal_facts': case.get('paypal_facts', {})} if reviewer_view else {})}

    @audit_scope_failure
    def status(self, token, case_id):
        p = self.store.principal(token)
        with self.store.connect() as db:
            return self._view(db, p, self.store.case(db, p, case_id))

    @audit_scope_failure
    def seller_messages(self, token, case_id):
        p = self.store.principal(token)
        with self.store.connect() as db:
            return [safe_text(m) for m in self.store.case(db, p, case_id)['messages']]

    @audit_scope_failure
    def assess(self, token, case_id, model=None, on_event=None, reader=None, always_read=()):
        """Run only the existing read-only investigator, and append advisory output."""
        from .destination_reader import BackendCaseReader
        from .investigator import investigate, nvidia_investigator_model, MODEL_ID, PROMPT_VERSION
        from .investigator_schema import unavailable
        p = self.store.principal(token)
        reader = reader or BackendCaseReader(self, token, case_id)
        snapshot = reader.snapshot()  # reject inaccessible cases before creating a model
        messages = reader.seller_messages()
        try:
            selected = nvidia_investigator_model() if model is None else model
            result = investigate(reader, '\n'.join(messages), selected, on_event=on_event, always_read=always_read)
        except Exception:
            result = {'assessment': unavailable('MODEL_UNAVAILABLE'),
                      'effective_recommendation': 'ESCALATE_FOR_REVIEW'}
        # Revalidate scope after the external call. A revoked session cannot persist.
        current = self.store.principal(token)
        if (p.tenant, p.seller, p.user) != (current.tenant, current.seller, current.user):
            raise DestinationError('SELLER_SCOPE_DENIED', 403)
        entry = {'assessment': result['assessment'], 'effective_recommendation': result['effective_recommendation'],
                 'advisory_only': True, 'can_change_state': False, 'assessed_at': self.clock(),
                 'model': MODEL_ID if model is None else 'injected-test-model', 'prompt_version': PROMPT_VERSION,
                 'case_version': snapshot['version']}
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.store.case(db, p, case_id)
            db.execute('INSERT INTO pg_assessments(case_id,tenant,seller,at,case_version,data) VALUES (?,?,?,?,?,?)',
                       (case_id, p.tenant, p.seller, entry['assessed_at'], snapshot['version'], encode(entry)))
            self.store.event(db, p.tenant, p.seller, case_id, p.user, 'AI_ASSESSMENT_RECORDED',
                             {'advisory_only': True, 'case_version': snapshot['version']}, self.clock())
        return self.status(token, case_id)

    def _save(self, db, p, case, event, previous, reason, evidence_refs=(), correlation=None, actor=None):
        case['updated_at'] = self.clock()
        self.store.save(db, p, case, case['version'])
        self.store.event(db, p.tenant, p.seller, case['case_id'], actor or p.user, event,
                         {'previous_state': previous, 'new_state': case['state'], 'reason': reason,
                          'policy_version': self.policy.version, 'evidence_refs': list(evidence_refs),
                          'correlation_id': correlation}, self.clock())

    def _refresh(self, db, p, case):
        """Backend-only time progression. Runs inside the caller's write transaction."""
        if case['state'] in TERMINAL:
            return
        payee = self.store.payee(db, p)
        approval = case['marketplace_review']
        reviewer = db.execute('SELECT * FROM pg_grants WHERE user_id=?', (approval.get('actor'),)).fetchone()
        valid = bool(reviewer and reviewer['tenant'] == p.tenant and reviewer['seller'] == p.seller
                     and reviewer['review'] and reviewer['channel'] == 'browser')
        if approval.get('auto') is True and approval.get('actor') == AUTO_ACTOR:
            valid = True  # approved by the rules themselves. Staleness is still checked by evaluate()
        result = evaluate(case, payee, self.policy, self.clock(), reviewer_valid=valid, signals=self.store.signals(db, p))
        previous = case['state']
        if result['decision'] == 'EXPIRED':
            case['state'] = 'EXPIRED'
        elif previous == 'APPROVED_COOLING_OFF' and result['decision'] not in ('ACTIVATE', 'APPROVE_COOLING_OFF'):
            case['state'] = 'PENDING_REVIEW'
            case['marketplace_review'] = {'decision': None}
            case['cooling_off'] = {'status': 'INVALIDATED', 'ends_at': None}
        elif result['decision'] == 'AUTO_APPROVE' and previous == 'PENDING_REVIEW':
            # Every check is clear and the case was not sampled for a person. Rules approve. The safety wait still runs.
            now = self.clock()
            case['policy_version'] = self.policy.version
            case['marketplace_review'] = {'decision': 'APPROVED', 'actor': AUTO_ACTOR, 'auto': True, 'at': now,
                                          'reason': 'Approved by rules: every check is clear.', 'policy_version': self.policy.version,
                                          'approved_version': case['version'] + 1}
            case['cooling_off'] = {'status': 'WAITING', 'ends_at': now + self.policy.cooling_seconds}
            case['state'], case['old_contact_notice'] = 'APPROVED_COOLING_OFF', 'SIMULATED_SENT'
            result = dict(result, decision='APPROVE_COOLING_OFF')
        elif result['decision'] == 'ACTIVATE':
            case['state'] = 'ACTIVE_NEW_DESTINATION'
            case['cooling_off']['status'] = 'COMPLETE'
            payee.update(active_payer_id=case['proposed_payer_id'], version=payee['version'] + 1,
                         simulation=bool(case.get('simulation')))
            db.execute('UPDATE pg_payees SET data=? WHERE tenant=? AND seller=?', (encode(payee), p.tenant, p.seller))
        case['policy_decision'] = result['decision']
        if previous != case['state']:
            auto = case['marketplace_review'].get('auto') is True and case['state'] == 'APPROVED_COOLING_OFF'
            self._save(db, p, case, 'DESTINATION_CHANGE_AUTO_APPROVED' if auto else 'DESTINATION_CHANGE_' + case['state'], previous,
                       'FAST_LANE_ELIGIBLE' if auto else result['reason_codes'][0], actor=AUTO_ACTOR if auto else None)

    @audit_scope_failure
    def cancel(self, token, case_id, correlation=None):
        """The seller can cancel an open or waiting request. This is the safety valve after the old-contact notice."""
        p = self.store.principal(token, 'manage', correlation)
        self.refresh(token, case_id)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            if case['state'] not in OPEN | {'APPROVED_COOLING_OFF'}:
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            previous = case['state']
            case['state'], case['policy_decision'] = 'REJECTED', 'REJECTED'
            case['marketplace_review'] = {'decision': 'REJECTED', 'actor': p.user, 'at': self.clock(), 'cancelled': True,
                                          'reason': 'Cancelled by the seller', 'policy_version': self.policy.version}
            case['cooling_off'] = {'status': 'INVALIDATED', 'ends_at': None}
            self._save(db, p, case, 'DESTINATION_CHANGE_CANCELLED_BY_SELLER', previous, 'SELLER_CANCELLED', correlation=correlation)
            return self._view(db, p, case)

    @audit_scope_failure
    def risk_audit(self, token, case_id):
        """Trusted risk facts for a browser reviewer and the read-only AI review. Derived values only."""
        p = self.store.principal(token, 'review')
        if p.channel != 'browser':
            raise DestinationError('REQUEST_DENIED', 403)
        with self.store.connect() as db:
            case = self.store.case(db, p, case_id)
            signals = self.store.signals(db, p)
            payee = self.store.payee(db, p)
        now = self.clock()
        findings = risk_findings(case, signals, self.policy, now)
        return {'findings': findings, 'blocks_approval': is_blocked(findings),
                'paypal_facts': case.get('paypal_facts', {}),
                'fast_lane': fast_lane_status(case, signals, payee, self.policy, now),
                'marketplace_signals': signal_ages(signals, now) if signals else None,
                'marketplace_signals_source': (signals or {}).get('source'),
                'seller_name_on_file': bool(payee.get('legal_name')),
                'windows': {'new_device_hours': self.policy.new_device_hours, 'password_reset_days': self.policy.password_reset_days,
                            'country_change_days': self.policy.country_change_days,
                            'destination_change_days': self.policy.destination_change_days,
                            'min_paypal_account_days': self.policy.min_paypal_account_days}}

    @audit_scope_failure
    def refresh(self, token, case_id):
        p = self.store.principal(token)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            self._refresh(db, p, case)
            return self._view(db, p, case)

    @audit_scope_failure
    def begin_auth(self, token, case_id, purpose, correlation=None):
        p = self.store.principal(token, 'manage', correlation)
        if purpose not in ('NEW', 'OLD'):
            raise DestinationError('INVALID_REQUEST')
        # Commit expiry before validating the requested action.
        self.refresh(token, case_id)
        nonce = secrets.token_urlsafe(32)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            allowed = {'CHANGE_REQUESTED', 'PENDING_NEW_ACCOUNT_AUTH'} if purpose == 'NEW' else {'PENDING_OLD_ACCOUNT_AUTH', 'PENDING_REVIEW'}
            if case['state'] not in allowed or (purpose == 'OLD' and not case['proposed_payer_id']):
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            previous = case['state']
            field = 'new_account' if purpose == 'NEW' else 'old_account'
            if purpose == 'NEW':
                case['state'] = 'PENDING_NEW_ACCOUNT_AUTH'
            case['authentication'][field] = {'status': 'PENDING'}
            self._save(db, p, case, purpose + '_ACCOUNT_AUTH_STARTED', previous, 'PAYPAL_AUTH_REQUIRED', correlation=correlation)
            db.execute('UPDATE pg_oauth SET consumed=1 WHERE tenant=? AND seller=? AND case_id=? AND purpose=?',
                       (p.tenant, p.seller, case_id, purpose))
            db.execute('INSERT INTO pg_oauth(digest,tenant,seller,case_id,session,purpose,version,expires) VALUES (?,?,?,?,?,?,?,?)',
                       (self.store.identity.digest(nonce), p.tenant, p.seller, case_id, p.session, purpose,
                        case['version'], self.clock() + self.policy.oauth_seconds))
        return nonce

    @audit_scope_failure
    def callback(self, token, case_id, purpose, state, code, provider, redirect_uri, correlation=None):
        """Consume a bound state BEFORE exchanging code; the browser never supplies identity."""
        p = self.store.principal(token, 'manage', correlation)
        if not isinstance(state, str) or not state or not isinstance(code, str) or not code or purpose not in ('NEW', 'OLD'):
            self.store.denied(p, 'PAYPAL_CALLBACK_INVALID', correlation)
            raise DestinationError('PAYPAL_CALLBACK_INVALID', 400)
        self.refresh(token, case_id)
        invalid = False
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            row = db.execute('SELECT * FROM pg_oauth WHERE digest=?', (self.store.identity.digest(state),)).fetchone()
            if not row or row['consumed'] or row['expires'] <= self.clock() or (
                    row['tenant'], row['seller'], row['case_id'], row['session'], row['purpose'], row['version']) != (
                    p.tenant, p.seller, case_id, p.session, purpose, case['version']):
                invalid = True
                self.store.event(db, p.tenant, p.seller, case_id, p.user, 'PAYPAL_CALLBACK_REJECTED',
                                 {'reason_code': 'BINDING_OR_EXPIRY_INVALID', 'correlation_id': correlation}, self.clock())
            else:
                db.execute('UPDATE pg_oauth SET consumed=1 WHERE digest=?', (self.store.identity.digest(state),))
                expected_version = case['version']
        if invalid:
            raise DestinationError('PAYPAL_CALLBACK_INVALID', 400)
        try:
            identity = provider.identity(code, redirect_uri)
            payer = name(identity.get('payer_id'))
            if identity.get('verified_account') is not True:
                raise ValueError()
        except Exception:
            with self.store.connect() as db:
                self.store.event(db, p.tenant, p.seller, case_id, p.user, 'PAYPAL_CALLBACK_REJECTED',
                                 {'reason_code': 'PROVIDER_IDENTITY_UNAVAILABLE', 'correlation_id': correlation}, self.clock())
            raise DestinationError('PAYPAL_CALLBACK_INVALID', 400) from None
        simulated = getattr(provider, 'simulated', False) is True
        if simulated and self.policy.mode != 'demo':
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        current = self.store.principal(token, 'manage', correlation)
        if current != p:
            raise DestinationError('PAYPAL_CALLBACK_INVALID', 400)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            if case['version'] != expected_version or case['state'] not in OPEN or self.clock() >= case['expires_at']:
                raise DestinationError('CASE_VERSION_CONFLICT', 409)
            payee = self.store.payee(db, p)
            if payee['version'] != case['payee_version']:
                raise DestinationError('CASE_VERSION_CONFLICT', 409)
            previous = case['state']
            field = 'new_account' if purpose == 'NEW' else 'old_account'
            status = 'VALIDATED' if purpose == 'NEW' else ('MATCHED' if payer == case['active_at_request'] else 'NOT_MATCHED')
            case['authentication'][field] = {'status': status, 'verified_by': 'DEMO_SIMULATION' if simulated else 'PAYPAL_CALLBACK', 'validated_at': self.clock()}
            if purpose == 'OLD' and status == 'NOT_MATCHED':
                case.setdefault('reviewer_findings', []).append('OLD_ACCOUNT_MISMATCH')
            if simulated:
                case['simulation'] = True
            if purpose == 'NEW':
                case['proposed_payer_id'] = payer
                # Same-ID evidence does not activate anything: retain A and complete
                # as no change (ACTIVE), consistent with policy T0.
                case['state'] = 'ACTIVE' if payer == payee['active_payer_id'] else 'PENDING_OLD_ACCOUNT_AUTH'
            else:
                case['state'] = 'PENDING_REVIEW'
            # Derived PayPal facts only. The raw name and address are used here and dropped.
            case.setdefault('paypal_facts', {})['new' if purpose == 'NEW' else 'old'] = derive_paypal_facts(
                identity.get('attributes'), payee, self.clock())
            result = evaluate(case, payee, self.policy, self.clock(), signals=self.store.signals(db, p))
            case['policy_decision'] = result['decision']
            self._save(db, p, case, purpose + '_ACCOUNT_AUTH_' + status, previous, status, [field], correlation)
            return self._view(db, p, case)

    @audit_scope_failure
    def recovery(self, token, case_id, reason, correlation=None):
        """Seller claim routes to recovery; it never creates accepted evidence."""
        p = self.store.principal(token, 'manage', correlation)
        reason = text(reason)
        self.refresh(token, case_id)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            if case['state'] not in ('PENDING_OLD_ACCOUNT_AUTH', 'PENDING_REVIEW'):
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            previous = case['state']
            case['state'] = 'PENDING_REVIEW'
            case['authentication']['old_account'] = {'status': 'UNAVAILABLE', 'source': 'SELLER_CLAIM'}
            case['old_contact_notice'] = 'REQUIRED_NOT_SENT'
            case['messages'].append(reason)
            case['policy_decision'] = 'REQUIRE_MARKETPLACE_REVIEW'
            self._save(db, p, case, 'RECOVERY_REQUESTED', previous, 'OLD_ACCOUNT_UNAVAILABLE', correlation=correlation)
            return self._view(db, p, case)

    @audit_scope_failure
    def record_evidence(self, token, case_id, *, kind, reference, reason, accepted, expected_version, source="HOST_CONSOLE"):
        """Trusted host console or explicitly labelled prototype browser reviewer."""
        p = self.store.principal(token, 'review')
        if source not in ('HOST_CONSOLE', 'REVIEWER_PROTOTYPE_ENTRY') or (source == 'REVIEWER_PROTOTYPE_ENTRY' and self.policy.mode not in ('demo', 'sandbox')):
            raise DestinationError('REQUEST_DENIED', 403)
        if kind not in ('SELLER_ENTITLEMENT', 'ACCOUNT_RECOVERY') or type(accepted) is not bool:
            raise DestinationError('INVALID_REQUEST')
        reference, reason = name(reference), text(reason, 1000)
        self.refresh(token, case_id)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            if case['state'] != 'PENDING_REVIEW':
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            self._version(case, expected_version)
            case['recovery_evidence'].append({'kind': kind, 'reference': reference, 'reason': reason,
                                            'accepted': accepted, 'verifier': p.user, 'at': self.clock(), 'source': source})
            self._save(db, p, case, 'MARKETPLACE_EVIDENCE_RECORDED', case['state'], 'EVIDENCE_RECORDED', [reference])
            return self._view(db, p, case)

    @staticmethod
    def _version(case, expected):
        if type(expected) is not int or case['version'] != expected:
            raise DestinationError('CASE_VERSION_CONFLICT', 409)

    @audit_scope_failure
    def review(self, token, case_id, decision, reason, expected_version, correlation=None):
        p = self.store.principal(token, 'review', correlation)
        reason = text(reason, 1000)
        if decision not in ('APPROVE', 'REJECT'):
            raise DestinationError('INVALID_REQUEST')
        self.refresh(token, case_id)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            self._version(case, expected_version)
            if case['state'] != 'PENDING_REVIEW':
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            payee = self.store.payee(db, p)
            signals = self.store.signals(db, p)
            if decision == 'APPROVE':
                outcome = evaluate(case, payee, self.policy, self.clock(), signals=signals)
                if 'RISK_SIGNALS_BLOCK_APPROVAL' in outcome['reason_codes']:
                    raise DestinationError('POLICY_BLOCKED', 409)  # two or more risk flags. A reviewer can still reject.
                if outcome['decision'] != 'PENDING_REVIEW':
                    raise DestinationError('POLICY_REVIEW_REQUIRED', 409)
            previous = case['state']
            case['policy_version'] = self.policy.version
            case['marketplace_review'] = {'decision': 'APPROVED' if decision == 'APPROVE' else 'REJECTED',
                'actor': p.user, 'reason': safe_text(reason), 'at': self.clock(), 'policy_version': self.policy.version,
                'approved_version': case['version'] + 1}
            if decision == 'APPROVE':
                recovery = case['authentication']['old_account']['status'] != 'MATCHED'
                flagged = bool(risk_findings(case, signals, self.policy, self.clock()))
                delay = self.policy.recovery_seconds if (recovery or flagged) else self.policy.cooling_seconds
                case['cooling_off'] = {'status': 'WAITING', 'ends_at': self.clock() + delay}
                case['state'], case['policy_decision'] = 'APPROVED_COOLING_OFF', 'APPROVE_COOLING_OFF'
            else:
                case['state'], case['policy_decision'] = 'REJECTED', 'REJECTED'
            self._save(db, p, case, 'DESTINATION_CHANGE_' + decision, previous, 'AUTHORIZED_REVIEW', correlation=correlation)
            return self._view(db, p, case)

    @audit_scope_failure
    def message(self, token, case_id, message, request_key, correlation=None):
        p = self.store.principal(token, 'manage', correlation)
        message, request_key = text(message), key(request_key)
        fingerprint = hashlib.sha256(message.encode()).hexdigest()
        self.refresh(token, case_id)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            kind = 'message:' + case_id
            prior = db.execute('SELECT payload FROM pg_requests WHERE tenant=? AND seller=? AND kind=? AND key=?',
                               (p.tenant, p.seller, kind, request_key)).fetchone()
            if prior:
                if prior['payload'] != fingerprint:
                    raise DestinationError('IDEMPOTENCY_CONFLICT', 409)
                return dict(self._view(db, p, case), message_replayed=True)
            if case['state'] in TERMINAL:
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            previous = case['state']
            case['messages'].append(message)
            # New seller information after approval requires a fresh human review.
            # This is deterministic invalidation, not an AI authorization action.
            if case['state'] == 'APPROVED_COOLING_OFF':
                case['state'], case['policy_decision'] = 'PENDING_REVIEW', 'REQUIRE_MARKETPLACE_REVIEW'
                case['marketplace_review'] = {'decision': None}
                case['cooling_off'] = {'status': 'INVALIDATED', 'ends_at': None}
            self._save(db, p, case, 'SELLER_MESSAGE_ADDED', previous, 'UNTRUSTED_SELLER_CLAIM', correlation=correlation)
            db.execute('INSERT INTO pg_requests VALUES (?,?,?,?,?,?)',
                       (p.tenant, p.seller, kind, request_key, fingerprint, case_id))
            return dict(self._view(db, p, case), message_replayed=False)

    @audit_scope_failure
    def events(self, token, case_id):
        p = self.store.principal(token)
        with self.store.connect() as db:
            self.store.case(db, p, case_id)
            rows = db.execute('SELECT seq,at,event,actor,data FROM pg_events WHERE tenant=? AND seller=? AND case_id=? ORDER BY seq',
                              (p.tenant, p.seller, case_id)).fetchall()
        result = []
        for row in rows:
            item = {'seq': row['seq'], 'at': row['at'], 'event': row['event']}
            data = json.loads(row['data'])
            if p.review and p.channel == 'browser':
                item.update(actor=row['actor'], details=redact(data))
            else:
                item['details'] = {k: data[k] for k in ('previous_state', 'new_state', 'reason') if k in data}
            result.append(item)
        return result

    @audit_scope_failure
    def summary(self, token, case_id):
        p = self.store.principal(token)
        view = self.status(token, case_id)
        next_steps = {
            'CHANGE_REQUESTED': 'Connect the proposed PayPal account.',
            'PENDING_NEW_ACCOUNT_AUTH': 'Complete the proposed PayPal account login.',
            'PENDING_OLD_ACCOUNT_AUTH': 'Connect the existing PayPal account, or request marketplace recovery.',
            'PENDING_REVIEW': 'A marketplace reviewer must check the required evidence.',
            'APPROVED_COOLING_OFF': 'Wait until the backend cooling-off deadline and final checks pass.',
            'REJECTED': 'The proposed destination was not approved.',
            'EXPIRED': 'This request expired. Start a new request if still needed.',
            'ACTIVE': 'The connected account is already the active destination.',
            'ACTIVE_NEW_DESTINATION': 'The destination change completed. Normal payout controls still apply.',
        }
        summary = {'case_id': case_id, 'state': view['state'], 'next_steps': next_steps[view['state']],
                   'ai_assessment': view['ai_assessment'], 'advisory_only': True}
        if p.review and p.channel == 'browser':
            with self.store.connect() as db:
                case = self.store.case(db, p, case_id)
                policy = evaluate(case, self.store.payee(db, p), self.policy, self.clock(), signals=self.store.signals(db, p))
            summary.update(seller_claims=self.seller_messages(token, case_id),
                backend_verified_evidence=view['authentication'], marketplace_evidence=[
                    {'kind': e.get('kind'), 'reference': e.get('reference'), 'accepted': e.get('accepted', False),
                     'at': e.get('at'), 'source': e.get('source', 'LEGACY_UNSPECIFIED'), 'verifier': e.get('verifier'), 'reason': safe_text(e.get('reason') or '')}
                    for e in case['recovery_evidence']],
                policy_findings=policy, missing_evidence=policy['required_actions'])
        return summary

    @audit_scope_failure
    def set_compromise(self, token, case_id, *, compromised, reason, expected_version):
        """Trusted marketplace risk integration. No seller/agent endpoint."""
        p = self.store.principal(token, 'review')
        text(reason, 1000)
        if type(compromised) is not bool:
            raise DestinationError('INVALID_REQUEST')
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            self._version(case, expected_version)
            payee = self.store.payee(db, p)
            payee['compromised'] = compromised
            payee['paused'] = compromised and self.policy.compromise_policy == 'pause'
            db.execute('UPDATE pg_payees SET data=? WHERE tenant=? AND seller=?', (encode(payee), p.tenant, p.seller))
            previous = case['state']
            case['risk_flags'] = ['POSSIBLE_COMPROMISE'] if compromised else []
            if case['state'] == 'APPROVED_COOLING_OFF':
                case['state'] = 'PENDING_REVIEW'
                case['marketplace_review'] = {'decision': None}
                case['cooling_off'] = {'status': 'INVALIDATED', 'ends_at': None}
            self._save(db, p, case, 'MARKETPLACE_RISK_UPDATED', previous, 'TRUSTED_RISK_REVIEW')
        return self.status(token, case_id)

    @audit_scope_failure
    def simulate_elapsed(self, token, case_id, expected_version):
        p = self.store.principal(token, 'review')
        if self.policy.mode != 'demo':
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            case = self.store.case(db, p, case_id)
            self._version(case, expected_version)
            if case['state'] != 'APPROVED_COOLING_OFF':
                raise DestinationError('CASE_STATE_CONFLICT', 409)
            case['simulation'] = True
            case['cooling_off'].update(ends_at=self.clock(), simulation=True)
            case['marketplace_review']['approved_version'] = case['version'] + 1
            self._save(db, p, case, 'SIMULATED_COOLING_OFF', case['state'], 'DEMO_SIMULATION_ONLY')
        return self.refresh(token, case_id)

    def auth_binding(self, token, state):
        """Resolve the private fixed callback URL using the server-stored binding."""
        p = self.store.principal(token, 'manage')
        with self.store.connect() as db:
            self.store.authorize(db, p)
            row = db.execute('SELECT * FROM pg_oauth WHERE digest=? AND tenant=? AND seller=? AND session=? AND consumed=0 AND expires>?',
                (self.store.identity.digest(state), p.tenant, p.seller, p.session, self.clock())).fetchone()
        if not row:
            self.store.denied(p, 'PAYPAL_CALLBACK_INVALID')
            raise DestinationError('PAYPAL_CALLBACK_INVALID')
        return row['case_id'], row['purpose']

    @audit_scope_failure
    def list_cases(self, token, *, limit=50, before=None):
        p = self.store.principal(token)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise DestinationError('INVALID_REQUEST')
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.store.authorize(db, p)
            args = [p.tenant, p.seller]
            extra = ''
            if before is not None:
                cursor = self.store.case(db, p, before)
                extra = " AND (json_extract(data,'$.created_at'),id) < (?,?)"
                args.extend([cursor['created_at'], before])
            args.append(limit)
            rows = db.execute("SELECT data FROM pg_cases WHERE tenant=? AND seller=?" + extra +
                              " ORDER BY json_extract(data,'$.created_at') DESC,id DESC LIMIT ?", args).fetchall()
            cases = []
            for row in rows:
                case = json.loads(row[0])
                self._refresh(db, p, case)
                cases.append(self._view(db, p, case))
            return cases

    def operator_cases(self, token, *, limit=50, before=None):
        p = self.store.principal(token, 'review')
        if type(limit) is not int or not 1 <= limit <= 100:
            raise DestinationError('INVALID_REQUEST')
        with self.store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.store.authorize(db, p)
            args, extra = [p.tenant], ''
            if before is not None:
                cursor = db.execute('SELECT data FROM pg_cases WHERE id=? AND tenant=?', (before, p.tenant)).fetchone()
                if not cursor:
                    raise DestinationError('CASE_NOT_FOUND', 404)
                cursor = json.loads(cursor[0])
                extra = " AND (json_extract(data,'$.created_at'),id) < (?,?)"
                args.extend([cursor['created_at'], before])
            args.append(limit)
            rows = db.execute("SELECT data FROM pg_cases WHERE tenant=?" + extra +
                              " ORDER BY json_extract(data,'$.created_at') DESC,id DESC LIMIT ?", args).fetchall()
            result = []
            for row in rows:
                case = json.loads(row[0])
                # Internal tenant-review capability used solely for centralized
                # timer progression. User mutation routes still use their grant seller.
                scoped = replace(p, seller=case['seller_id'], grant_seller=p.seller)
                self._refresh(db, scoped, case)
                result.append({'case_id': case['case_id'], 'seller_id': case['seller_id'], 'tenant_id': p.tenant,
                    'created_at': case['created_at'], 'state': case['state'], 'version': case['version'],
                    'simulation': case.get('simulation', False),
                    'reviewer_findings': case.get('reviewer_findings', []),
                    'destinations': {'active': {'masked_payer_id': masked(self.store.payee(db, scoped)['active_payer_id'])},
                                     'proposed': {'masked_payer_id': masked(case['proposed_payer_id'])}},
                    'cooling_off': case['cooling_off']})
            return result

    def assessment_current(self, token, case_id):
        p = self.store.principal(token)
        with self.store.connect() as db:
            case = self.store.case(db, p, case_id)
            row = db.execute('SELECT case_version FROM pg_assessments WHERE case_id=? AND tenant=? AND seller=? ORDER BY seq DESC LIMIT 1',
                             (case_id, p.tenant, p.seller)).fetchone()
            return bool(row and row[0] == case['version'])
