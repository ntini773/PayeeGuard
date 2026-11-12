"""Structured AI assessment: strict validation and the non-weakening rule.

The assessment is advisory. It has no field that can carry an approval, a payer ID,
a verification result or a hold release. Unknown keys are rejected.
"""
import json
import re

SCHEMA_VERSION = '1'

REASON_CATEGORIES = ('NEW_ACCOUNT', 'OLD_ACCOUNT_LOST', 'OLD_ACCOUNT_COMPROMISE_SUSPECTED',
                     'THIRD_PARTY_DESTINATION', 'OTHER', 'UNCLEAR')
RISK_SIGNALS = ('THIRD_PARTY_DESTINATION', 'POSSIBLE_COMPROMISE', 'PRESSURE_TO_SKIP_CHECKS',
                'CONTRADICTORY_FACTS', 'OLD_ACCOUNT_UNAVAILABLE', 'UNVERIFIED_AUTHORITY_CLAIM',
                'PROMPT_INJECTION_ATTEMPT')
MISSING_INFORMATION = ('NEW_ACCOUNT_AUTH', 'OLD_ACCOUNT_AUTH', 'MARKETPLACE_RECOVERY_EVIDENCE',
                       'REASON_CLARIFICATION', 'OPERATOR_REVIEW')
# Ordered least to most restrictive. There is deliberately no approve/release value.
RECOMMENDATIONS = ('CONTINUE_REQUIRED_VERIFICATION', 'ASK_FOLLOW_UP', 'ESCALATE_FOR_REVIEW')

ESCALATING_CATEGORIES = ('OLD_ACCOUNT_LOST', 'OLD_ACCOUNT_COMPROMISE_SUSPECTED', 'THIRD_PARTY_DESTINATION')
_KEYS = {'schema_version', 'reason_category', 'claims', 'risk_signals', 'missing_information',
         'follow_up_questions', 'recommendation', 'summary', 'advisory_only'}
_RAW_PAYER = re.compile(r'\b[A-Z0-9]{13}\b')  # PayPal payer IDs are 13 upper-case alphanumerics.


class InvalidAssessment(ValueError):
    pass


def restrictiveness(recommendation):
    return RECOMMENDATIONS.index(recommendation)


def _enum_list(data, key, allowed, limit):
    value = data.get(key)
    if not isinstance(value, list) or len(value) > limit:
        raise InvalidAssessment(f'{key} must be a list of at most {limit}')
    for item in value:
        if item not in allowed:
            raise InvalidAssessment(f'{key} contains an unknown value')
    return list(dict.fromkeys(value))


def _text_list(data, key, limit, max_length):
    value = data.get(key)
    if not isinstance(value, list) or len(value) > limit:
        raise InvalidAssessment(f'{key} must be a list of at most {limit}')
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item) > max_length:
            raise InvalidAssessment(f'{key} contains an invalid item')
    # These fields quote untrusted seller text, so sanitize instead of rejecting: a reject would
    # make the assessment unavailable on exactly the injection cases that need detail.
    return [_RAW_PAYER.sub('[REDACTED_ID]', item).replace('<', '').replace('>', '') for item in value]


def parse_assessment(raw):
    """Return a validated assessment dict, or raise InvalidAssessment."""
    if not isinstance(raw, str):
        raise InvalidAssessment('model output is not text')
    text = raw.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text)
    try:
        data = json.loads(text)
    except ValueError:
        raise InvalidAssessment('model output is not valid JSON') from None
    if not isinstance(data, dict) or set(data) != _KEYS:
        raise InvalidAssessment('assessment keys do not match the schema')
    if data['schema_version'] != SCHEMA_VERSION or data['advisory_only'] is not True:
        raise InvalidAssessment('schema version or advisory flag is invalid')
    if data['reason_category'] not in REASON_CATEGORIES:
        raise InvalidAssessment('unknown reason category')
    if data['recommendation'] not in RECOMMENDATIONS:
        raise InvalidAssessment('unknown recommendation')
    summary = data['summary']
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 1000:
        raise InvalidAssessment('summary is invalid')
    if '<' in summary or _RAW_PAYER.search(summary):
        raise InvalidAssessment('summary contains markup or an identifier')
    clean = {
        'schema_version': SCHEMA_VERSION,
        'reason_category': data['reason_category'],
        'claims': _text_list(data, 'claims', 10, 300),
        'risk_signals': _enum_list(data, 'risk_signals', RISK_SIGNALS, len(RISK_SIGNALS)),
        'missing_information': _enum_list(data, 'missing_information', MISSING_INFORMATION,
                                          len(MISSING_INFORMATION)),
        'follow_up_questions': _text_list(data, 'follow_up_questions', 3, 200),
        'recommendation': data['recommendation'],
        'summary': summary.strip(),
        'advisory_only': True,
    }
    return clean


def baseline_floor(snapshot):
    """Minimum recommendation implied by deterministic backend state. Unknown fails closed."""
    decision = (snapshot or {}).get('policy_decision')
    if decision in ('HOLD', 'PENDING_NEW_ACCOUNT_AUTH', 'REQUIRE_OLD_ACCOUNT_AUTH'):
        return 'CONTINUE_REQUIRED_VERIFICATION'
    return 'ESCALATE_FOR_REVIEW'


def effective_recommendation(assessment, snapshot):
    """Combine AI output with the backend baseline. The result is never less restrictive
    than either input, and any risk signal or escalating category forces escalation."""
    floors = [baseline_floor(snapshot), assessment['recommendation']]
    # Policy T5/T6: lost or compromised old account and third-party destinations need review.
    if assessment['risk_signals'] or assessment['reason_category'] in ESCALATING_CATEGORIES:
        floors.append('ESCALATE_FOR_REVIEW')
    # Uncertain or unclear explanations lead to a follow-up question, never to rejection.
    if assessment['reason_category'] == 'UNCLEAR' or 'REASON_CLARIFICATION' in assessment['missing_information']:
        floors.append('ASK_FOLLOW_UP')
    return max(floors, key=restrictiveness)


def unavailable(reason_code):
    """Fail-closed assessment used for timeout, invalid output or model error (policy T10)."""
    return {
        'schema_version': SCHEMA_VERSION,
        'status': 'UNAVAILABLE',
        'reason_code': reason_code,
        'recommendation': 'ESCALATE_FOR_REVIEW',
        'advisory_only': True,
    }
