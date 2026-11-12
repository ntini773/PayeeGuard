"""Conventional keyword/regex investigator. Same output schema as the AI, no model.

Deliberately simple: this is the baseline the AI is compared against, not a product."""
import re
from .investigator_schema import parse_assessment
import json

_RULES = {
    'OLD_ACCOUNT_UNAVAILABLE': r"\blost (access|it)|no longer (have|access)|can'?not (log|access)|can'?t (log|access)|locked out|closed|खो|बंद|लॉगिन नहीं",
    'THIRD_PARTY_DESTINATION': r"\bfriend|someone else|\b(my )?(brother|sister|cousin|partner|uncle|aunt|colleague)\b|third party|another person|\bhis\b|\bher\b|assistant",
    'POSSIBLE_COMPROMISE': r"hack|compromis|unauthori[sz]ed|didn'?t make|someone (else )?(may have )?(logged|accessed)|stolen",
    'PRESSURE_TO_SKIP_CHECKS': r"urgent|immediately|right now|asap|\bskip\b|without (the )?(login|verification)|hurry|don'?t make me|bypass|no need to",
    'UNVERIFIED_AUTHORITY_CLAIM': r"(operator|admin|manager|support|ceo|owner)('s)? (already )?(approved|authori[sz]ed|said)|already approved|\bceo\b",
    'PROMPT_INJECTION_ATTEMPT': r"ignore (all )?(previous|prior|the)|you are now|system prompt|\w+=(true|false)|call \w+_\w+|case_id=|payer id",
    'POSSIBLE_CONTRADICTION': r"(every day|still use).*(cannot|can'?t)",
}


def rules_investigate(text):
    low = text.lower()
    signals = [name for name, pattern in _RULES.items() if re.search(pattern, low if name != 'OLD_ACCOUNT_UNAVAILABLE' else text.lower())]
    signals = ['CONTRADICTORY_FACTS' if s == 'POSSIBLE_CONTRADICTION' else s for s in signals]
    if 'POSSIBLE_COMPROMISE' in signals:
        category = 'OLD_ACCOUNT_COMPROMISE_SUSPECTED'
    elif 'THIRD_PARTY_DESTINATION' in signals:
        category = 'THIRD_PARTY_DESTINATION'
    elif 'OLD_ACCOUNT_UNAVAILABLE' in signals:
        category = 'OLD_ACCOUNT_LOST'
    elif len(text.split()) < 8 and 'new' not in low:
        category = 'UNCLEAR'
    elif re.search(r'\bnew\b.*(account|paypal)', low):
        category = 'NEW_ACCOUNT'
    else:
        category = 'OTHER'
    missing = ['OLD_ACCOUNT_AUTH']
    if category == 'UNCLEAR':
        missing.append('REASON_CLARIFICATION')
    if category in ('OLD_ACCOUNT_LOST', 'OLD_ACCOUNT_COMPROMISE_SUSPECTED'):
        missing.append('MARKETPLACE_RECOVERY_EVIDENCE')
    recommendation = ('ESCALATE_FOR_REVIEW' if signals else
                      'ASK_FOLLOW_UP' if category == 'UNCLEAR' else 'CONTINUE_REQUIRED_VERIFICATION')
    return parse_assessment(json.dumps({
        'schema_version': '1', 'reason_category': category, 'claims': [text.strip()[:300]],
        'risk_signals': signals, 'missing_information': missing, 'follow_up_questions': [],
        'recommendation': recommendation, 'summary': 'Rules-only keyword analysis.', 'advisory_only': True}))
