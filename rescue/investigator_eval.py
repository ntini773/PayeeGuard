"""Compare the AI investigator with the rules-only baseline on the shared dataset.

`pixi run evaluate-investigator`            live NVIDIA + rules (needs a key; synthetic text only)
`pixi run evaluate-investigator --rules-only` offline, deterministic
Options: --runs N (repeat live runs), --output FILE (write JSON, no secrets).
No PayPal call; the case is synthetic and in memory. Results describe this small
author-labelled dataset only; they are not general accuracy."""
import argparse
import json
import re
import sys
import time
from importlib import metadata
from .investigator import MODEL_ID, PROMPT_VERSION, investigate, nvidia_investigator_model
from .investigator_dataset import CASES
from .investigator_rules import rules_investigate
from .investigator_schema import effective_recommendation, restrictiveness

BASELINE = {'state': 'PENDING_OLD_ACCOUNT_AUTH', 'policy_decision': 'REQUIRE_OLD_ACCOUNT_AUTH',
            'authentication': {'new_account': {'status': 'VALIDATED'}, 'old_account': {'status': 'PENDING'}},
            'marketplace_review': {'decision': None},
            'destinations': {'active': {'masked_payer_id': 'PAYER-***-A'},
                             'proposed': {'masked_payer_id': 'PAYER-***-B'}},
            'payout_control': {'proposed_destination_usable': False}}


class SyntheticReader:
    def __init__(self, messages, snapshot=BASELINE):
        self._messages, self._snapshot = messages, snapshot

    def snapshot(self):
        return self._snapshot

    def seller_messages(self):
        return self._messages


def _words(text):
    return {w for w in re.findall(r'\w+', text.lower()) if len(w) > 3}


def unsupported_claims(claims, seller_text):
    """Claims with under half their content words present in the seller text (grounding check)."""
    source, count = _words(seller_text), 0
    for claim in claims:
        words = _words(claim)
        if words and len(words & source) / len(words) < 0.5:
            count += 1
    return count


def score(case, assessment, effective):
    signals = set(assessment.get('risk_signals', []))
    return {
        'available': assessment.get('status', 'AVAILABLE') == 'AVAILABLE',
        'category': assessment.get('reason_category'),
        'category_match': assessment.get('reason_category') == case.category,
        'signals': sorted(signals),
        'missed_required': sorted(case.required - signals),
        'false_positive_signals': sorted(signals - case.allowed - case.required),
        'unsupported_claims': unsupported_claims(assessment.get('claims', []), case.text),
        'missing_information': assessment.get('missing_information', []),
        'effective': effective,
        'meets_minimum': restrictiveness(effective) >= restrictiveness(case.minimum),
    }


def run_rules():
    rows = {}
    for case in CASES:
        assessment = rules_investigate(case.text)
        rows[case.name] = score(case, assessment, effective_recommendation(assessment, BASELINE))
    return rows


def run_ai(model):
    rows = {}
    for case in CASES:
        result = investigate(SyntheticReader([case.text]), case.text, model)
        row = score(case, result['assessment'], result['effective_recommendation'])
        row['reason_code'] = result['assessment'].get('reason_code')
        row['denied_tools'] = result['denied_tool_calls']
        rows[case.name] = row
    return rows


def totals(rows):
    values = list(rows.values())
    return {'cases': len(values),
            'unavailable': sum(not r['available'] for r in values),
            'category_match': sum(r['category_match'] for r in values),
            'meets_minimum': sum(r['meets_minimum'] for r in values),
            'cases_missing_required_signal': sum(bool(r['missed_required']) for r in values),
            'false_positive_signals': sum(len(r['false_positive_signals']) for r in values),
            'unsupported_claims': sum(r['unsupported_claims'] for r in values)}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--rules-only', action='store_true')
    parser.add_argument('--runs', type=int, default=1)
    parser.add_argument('--output')
    args = parser.parse_args(argv)
    report = {'date': time.strftime('%Y-%m-%d'), 'dataset': 'rescue/investigator_dataset.py',
              'labels': 'author-written, not independently adjudicated', 'cases': len(CASES),
              'rules_only': {'rows': run_rules()}}
    report['rules_only']['totals'] = totals(report['rules_only']['rows'])
    if not args.rules_only:
        try:
            model = nvidia_investigator_model()
        except Exception as exc:
            print(json.dumps({'evaluation': 'UNAVAILABLE', 'error_type': type(exc).__name__}))
            raise SystemExit(1)
        try:
            version = metadata.version('langchain-nvidia-ai-endpoints')
        except Exception:
            version = 'unknown'
        report['ai'] = {'model': MODEL_ID, 'prompt_version': PROMPT_VERSION, 'client_version': version,
                        'temperature': 0, 'provider': 'NVIDIA live; PayPal not called', 'runs': []}
        for _ in range(max(1, args.runs)):
            rows = run_ai(model)
            report['ai']['runs'].append({'rows': rows, 'totals': totals(rows)})
    for name in (c.name for c in CASES):
        line = {'case': name, 'rules': report['rules_only']['rows'][name]}
        if 'ai' in report:
            line['ai'] = [run['rows'][name] for run in report['ai']['runs']]
        print(json.dumps(line, ensure_ascii=False), flush=True)
    print('RULES-ONLY TOTALS', json.dumps(report['rules_only']['totals']))
    for index, run in enumerate(report.get('ai', {}).get('runs', []), 1):
        print(f'AI RUN {index} TOTALS', json.dumps(run['totals']))
    if args.output:
        with open(args.output, 'w') as handle:
            json.dump(report, handle, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
