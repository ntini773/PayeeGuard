"""Risk facts and flags for a destination change. Pure functions. No I/O, no AI.

Two kinds of trusted facts feed the flags:
- Marketplace security signals (device, password reset, country, last payout change). A trusted ledger import. In this
  prototype the feed is SIMULATED and says so. It is never typed in by sellers or agents.
- PayPal account facts derived at login (account type, age, name match). Only derived values are stored. The raw name,
  email and address are used in memory to compute them and then dropped.

A flag raises scrutiny. One flag lengthens the safety wait. Two or more flags block approval, and a reviewer can still reject.
Flags are time windows, so they clear by themselves, and the backend checks them again at activation, after the cooling-off.
"""
import hashlib
import re

HOUR, DAY = 3600, 86400
# code -> plain sentence for reviewers and the AI. UI wording belongs to the UI owner.
FLAG_TEXT = {
    'NEW_DEVICE_RECENT': 'The seller signed in from a device the marketplace had not seen before, recently.',
    'PASSWORD_RESET_RECENT': 'The seller password was reset recently.',
    'COUNTRY_CHANGE_RECENT': 'The seller sign-in country changed recently.',
    'DESTINATION_CHANGE_RECENT': 'The payout account was already changed recently.',
    'PAYPAL_ACCOUNT_YOUNG': 'The PayPal account is very new.',
    'PAYPAL_NAME_MISMATCH': 'The name on the PayPal account does not match the seller name.',
    'PAYPAL_COUNTRY_MISMATCH': 'The PayPal account country does not match the seller country.',
}


def _tokens(value):
    return {t for t in re.sub(r'[^a-z0-9 ]', ' ', str(value or '').casefold()).split() if len(t) > 1}


def name_match(paypal_name, seller_name):
    """MATCH, PARTIAL (some words shared, for example a middle name or nickname), MISMATCH, or UNKNOWN."""
    a, b = _tokens(paypal_name), _tokens(seller_name)
    if not a or not b:
        return 'UNKNOWN'
    if a == b:
        return 'MATCH'
    return 'PARTIAL' if a & b else 'MISMATCH'


def _age_days(created, now):
    """Days since an ISO date or epoch seconds. None when PayPal did not send it or it cannot be read."""
    import datetime
    try:
        if isinstance(created, (int, float)) and not isinstance(created, bool):
            moment = float(created)
        else:
            text = str(created).replace('Z', '+00:00')
            moment = datetime.datetime.fromisoformat(text).timestamp()
    except (ValueError, TypeError):
        return None
    return max(0, int((now - moment) // DAY)) if moment <= now else None


def derive_paypal_facts(attributes, payee, now):
    """Derived facts only. `attributes` are raw PayPal fields held in memory. Nothing raw is returned."""
    attributes = attributes if isinstance(attributes, dict) else {}
    address = attributes.get('address') if isinstance(attributes.get('address'), dict) else {}
    country, expected = str(address.get('country') or '').upper(), str((payee or {}).get('country') or '').upper()
    return {
        'account_type': str(attributes.get('account_type') or 'UNKNOWN').upper()[:20],
        'account_age_days': _age_days(attributes.get('account_creation_date'), now),
        'name_match': name_match(attributes.get('name'), (payee or {}).get('legal_name')),
        'country_match': 'UNKNOWN' if not country or not expected else ('MATCH' if country == expected else 'MISMATCH'),
    }


def risk_findings(case, signals, policy, now):
    """The flags that apply right now. Each is {'code', 'level', 'detail'}. Empty when everything is clear."""
    found = []

    def add(code):
        found.append({'code': code, 'level': 'ELEVATED', 'detail': FLAG_TEXT[code]})

    def within(stamp, seconds):
        return isinstance(stamp, (int, float)) and not isinstance(stamp, bool) and 0 <= now - stamp <= seconds

    signals = signals if isinstance(signals, dict) else {}
    if within(signals.get('new_device_at'), policy.new_device_hours * HOUR):
        add('NEW_DEVICE_RECENT')
    if within(signals.get('password_reset_at'), policy.password_reset_days * DAY):
        add('PASSWORD_RESET_RECENT')
    if within(signals.get('country_change_at'), policy.country_change_days * DAY):
        add('COUNTRY_CHANGE_RECENT')
    if within(signals.get('last_destination_change_at'), policy.destination_change_days * DAY):
        add('DESTINATION_CHANGE_RECENT')
    facts = (case.get('paypal_facts') or {}).get('new') or {}
    age = facts.get('account_age_days')
    if isinstance(age, int) and age < policy.min_paypal_account_days:
        add('PAYPAL_ACCOUNT_YOUNG')
    if facts.get('name_match') == 'MISMATCH':
        add('PAYPAL_NAME_MISMATCH')
    if facts.get('country_match') == 'MISMATCH':
        add('PAYPAL_COUNTRY_MISMATCH')
    return found


def is_blocked(findings):
    """Two or more flags together block approval."""
    return len(findings) >= 2


def signal_ages(signals, now):
    """Hours since each marketplace event, for reviewers and the AI. None when it never happened."""
    out = {}
    for key in ('new_device_at', 'password_reset_at', 'country_change_at', 'last_destination_change_at'):
        stamp = (signals or {}).get(key)
        out[key.replace('_at', '_hours_ago')] = round((now - stamp) / HOUR, 1) if isinstance(stamp, (int, float)) and stamp <= now else None
    return out


def sampled_for_review(case_id, percent):
    """A fixed share of otherwise-clean cases still goes to a person. Deterministic per case, so it cannot be gamed by retrying."""
    return int(hashlib.sha256(str(case_id).encode()).hexdigest(), 16) % 100 < percent


def fast_lane_status(case, signals, payee, policy, now):
    """Whether a clean case may be approved by rules, with no operator. Everything must hold. Doubt means manual review.
    Returns {'enabled', 'eligible', 'sampled', 'missing': [codes]}. The safety wait still applies to every approved case."""
    if not policy.fast_lane:
        return {'enabled': False, 'eligible': False, 'sampled': False, 'missing': ['FAST_LANE_OFF']}
    missing = []
    auth = case.get('authentication') or {}
    if (auth.get('new_account') or {}).get('status') != 'VALIDATED' or (auth.get('old_account') or {}).get('status') != 'MATCHED':
        missing.append('BOTH_ACCOUNTS_NOT_VERIFIED')
    facts = (case.get('paypal_facts') or {}).get('new') or {}
    if facts.get('name_match') != 'MATCH':
        missing.append('NAME_NOT_CONFIRMED')
    if facts.get('country_match') != 'MATCH':
        missing.append('COUNTRY_NOT_CONFIRMED')
    if risk_findings(case, signals, policy, now):
        missing.append('RISK_FLAGS_PRESENT')
    if not (isinstance(signals, dict) and signals.get('entitlement_confirmed') is True):
        missing.append('ENTITLEMENT_NOT_CONFIRMED')
    if any(not e.get('accepted') for e in case.get('recovery_evidence') or []):
        missing.append('EVIDENCE_REJECTED')
    if (payee or {}).get('paused') or (payee or {}).get('compromised'):
        missing.append('SELLER_ON_HOLD')
    sampled = sampled_for_review(case.get('case_id'), policy.fast_lane_sample_percent)
    if not missing and sampled:
        missing.append('SAMPLED_FOR_REVIEW')
    return {'enabled': True, 'eligible': not missing, 'sampled': sampled, 'missing': missing}
