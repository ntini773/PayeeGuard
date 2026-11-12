"""Pure authorization policy. AI assessment is deliberately not an input."""
from dataclasses import dataclass
import math
import hashlib
import json
from .destination_errors import DestinationError
from .destination_risk import fast_lane_status, is_blocked, risk_findings


@dataclass(frozen=True)
class Policy:
    mode: str = 'demo'
    version: str = 'demo-1'
    cooling_seconds: int = 3 * 86400
    recovery_seconds: int = 7 * 86400
    request_seconds: int = 14 * 86400
    oauth_seconds: int = 600
    compromise_policy: str = 'pause'
    # Risk windows. A flag counts while its event is newer than the window.
    new_device_hours: int = 24
    password_reset_days: int = 7
    country_change_days: int = 7
    destination_change_days: int = 30
    min_paypal_account_days: int = 30
    # Fast lane: clean cases are approved by rules without an operator. OFF by default. Never in production.
    fast_lane: bool = False
    fast_lane_sample_percent: int = 10
    # Production needs deliberate deployment configuration, never demo defaults.
    production_configured: bool = False

    @classmethod
    def configured(cls, settings, mode):
        values = {'mode': mode}
        for field in ('cooling_seconds', 'recovery_seconds', 'request_seconds', 'oauth_seconds', 'new_device_hours',
                      'password_reset_days', 'country_change_days', 'destination_change_days', 'min_paypal_account_days'):
            raw = settings.get('RESCUE_' + field.upper())
            if raw is not None:
                try:
                    values[field] = int(raw)
                except (ValueError, TypeError):
                    raise DestinationError('POLICY_CONFIGURATION_INVALID') from None
        if str(settings.get('RESCUE_FAST_LANE', '')).strip().lower() in ('on', 'true', '1', 'yes'):
            values['fast_lane'] = True
        if settings.get('RESCUE_FAST_LANE_SAMPLE_PERCENT') is not None:
            try:
                values['fast_lane_sample_percent'] = int(settings['RESCUE_FAST_LANE_SAMPLE_PERCENT'])
            except (ValueError, TypeError):
                raise DestinationError('POLICY_CONFIGURATION_INVALID') from None
        if 'RESCUE_COMPROMISE_POLICY' in settings:
            values['compromise_policy'] = settings['RESCUE_COMPROMISE_POLICY']
        # Configuration changes invalidate prior approvals, including shorter waits.
        digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()[:12]
        values['version'] = 'demo-' + digest
        return cls(**values)

    def __post_init__(self):
        if self.mode not in ('demo', 'sandbox', 'production') or not self.version:
            raise DestinationError('POLICY_CONFIGURATION_INVALID')
        for value in (self.cooling_seconds, self.recovery_seconds, self.request_seconds, self.oauth_seconds,
                      self.new_device_hours, self.password_reset_days, self.country_change_days,
                      self.destination_change_days, self.min_paypal_account_days):
            if type(value) is not int or value <= 0:
                raise DestinationError('POLICY_CONFIGURATION_INVALID')
        if type(self.fast_lane) is not bool or type(self.fast_lane_sample_percent) is not int or not 0 <= self.fast_lane_sample_percent <= 100:
            raise DestinationError('POLICY_CONFIGURATION_INVALID')
        if self.fast_lane and self.mode == 'production':
            raise DestinationError('POLICY_CONFIGURATION_INVALID')  # prototype rule: no automatic approval in production
        if self.recovery_seconds <= self.cooling_seconds or self.compromise_policy not in ('pause', 'cap'):
            raise DestinationError('POLICY_CONFIGURATION_INVALID')
        if self.mode == 'production' and (not self.production_configured or self.version.startswith('demo')):
            raise DestinationError('POLICY_CONFIGURATION_INVALID')


OPEN = frozenset({'CHANGE_REQUESTED', 'PENDING_NEW_ACCOUNT_AUTH', 'PENDING_OLD_ACCOUNT_AUTH', 'PENDING_REVIEW'})
TERMINAL = frozenset({'ACTIVE', 'ACTIVE_NEW_DESTINATION', 'REJECTED', 'EXPIRED'})


def evaluate(case, payee, policy, now, *, reviewer_valid=True, signals=None):
    """Same deterministic entry point for review and timer re-evaluation."""
    reasons, actions = [], []
    def result(decision, *codes):
        return {'decision': decision, 'reason_codes': list(codes), 'required_actions': actions,
                'may_activate_proposed_destination': decision == 'ACTIVATE', 'policy_version': policy.version}
    if case.get('simulation') and policy.mode != 'demo':
        return result('REQUIRE_MARKETPLACE_REVIEW', 'SIMULATION_NOT_AUTHORIZATION')
    if case['state'] in ('REJECTED', 'EXPIRED'):
        return result(case['state'], 'CHANGE_CLOSED')
    if case['state'] == 'ACTIVE':
        return result('ALLOW_NO_CHANGE', 'SAME_DESTINATION')
    if case['state'] == 'ACTIVE_NEW_DESTINATION':
        return result('ACTIVE_NEW_DESTINATION', 'CHANGE_COMPLETE')
    if case['payee_version'] != payee['version'] or case['active_at_request'] != payee['active_payer_id']:
        return result('REQUIRE_MARKETPLACE_REVIEW', 'ACTIVE_DESTINATION_CHANGED')
    if case['state'] in OPEN and now >= case['expires_at']:
        return result('EXPIRED', 'REQUEST_DEADLINE_ELAPSED')
    if case['authentication']['new_account']['status'] != 'VALIDATED' or not case['proposed_payer_id']:
        actions.append('CONNECT_PROPOSED_PAYPAL_ACCOUNT')
        return result('HOLD', 'NEW_ACCOUNT_AUTH_REQUIRED')
    if case['proposed_payer_id'] == payee['active_payer_id']:
        return result('ALLOW_NO_CHANGE', 'SAME_DESTINATION')
    recovery = case['authentication']['old_account']['status'] != 'MATCHED'
    if recovery and case['authentication']['old_account']['status'] in ('NOT_STARTED', 'PENDING'):
        actions.append('CONNECT_OLD_PAYPAL_ACCOUNT')
        return result('REQUIRE_OLD_ACCOUNT_AUTH', 'OLD_ACCOUNT_AUTH_REQUIRED')
    # Marketplace and PayPal risk flags. They never approve anything. They lengthen the wait, and two together block approval.
    findings = risk_findings(case, signals, policy, now)
    flag_codes = [f['code'] for f in findings]
    if is_blocked(findings):
        actions.append('RESOLVE_RISK_FLAGS')
        return result('REQUIRE_MARKETPLACE_REVIEW', 'RISK_SIGNALS_BLOCK_APPROVAL', *flag_codes)
    # Fast lane: every check is clear, so rules approve and no operator is needed. The safety wait still runs.
    if (case['state'] == 'PENDING_REVIEW' and case['marketplace_review'].get('decision') is None and not case.get('simulation')
            and fast_lane_status(case, signals, payee, policy, now)['eligible']):
        return result('AUTO_APPROVE', 'FAST_LANE_ELIGIBLE')
    evidence_type = 'ACCOUNT_RECOVERY' if recovery else 'SELLER_ENTITLEMENT'
    # A rejected revision must supersede earlier acceptance. Contradictory
    # current records require review; history remains intact for audit.
    latest = {e['reference']: e for e in case['recovery_evidence'] if e['kind'] == evidence_type}
    evidence = list(latest.values())
    # An approval made by the fast lane rests on the marketplace feed (entitlement confirmed) instead of a typed record.
    # It stands only while the feed still says so. Any rejected evidence or compromise flag still sends it to a person.
    auto_ok = (case['marketplace_review'].get('auto') is True and isinstance(signals, dict)
               and signals.get('entitlement_confirmed') is True)
    if case['risk_flags'] or any(not e['accepted'] for e in evidence) or (not evidence and not auto_ok):
        actions.append('COLLECT_MARKETPLACE_RECOVERY_EVIDENCE' if recovery else 'VERIFY_MARKETPLACE_ENTITLEMENT')
        return result('REQUIRE_MARKETPLACE_REVIEW', 'MARKETPLACE_EVIDENCE_REQUIRED')
    approval = case['marketplace_review']
    if approval.get('decision') != 'APPROVED':
        actions.append('AUTHORIZED_OPERATOR_REVIEW')
        return result('PENDING_REVIEW', 'OPERATOR_REVIEW_REQUIRED')
    if (not reviewer_valid or approval.get('policy_version') != policy.version or
            approval.get('approved_version') != case['version'] or case['policy_version'] != policy.version):
        return result('REQUIRE_MARKETPLACE_REVIEW', 'APPROVAL_STALE')
    deadline = case['cooling_off'].get('ends_at')
    if not isinstance(deadline, (int, float)) or not math.isfinite(deadline):
        return result('REQUIRE_MARKETPLACE_REVIEW', 'COOLING_CONFIGURATION_MISSING')
    required = policy.recovery_seconds if (recovery or findings) else policy.cooling_seconds
    if deadline < approval['at'] + required and not (policy.mode == 'demo' and case.get('simulation')):
        return result('REQUIRE_MARKETPLACE_REVIEW', 'COOLING_PERIOD_INCREASED')
    if now < deadline:
        return result('APPROVE_COOLING_OFF', 'WAIT_FOR_COOLING_OFF')
    return result('ACTIVATE', 'COOLING_OFF_ELAPSED')
