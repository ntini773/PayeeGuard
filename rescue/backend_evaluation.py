"""Evaluate the investigator through real scoped storage and BackendCaseReader.

Data and PayPal identities are synthetic; --live sends only the published synthetic
seller messages to NVIDIA. Default mode is an offline rules-backed transport check.
"""
import argparse
import json
from pathlib import Path
import tempfile
import time
from .destination_store import DestinationStore
from .destination_service import DestinationService
from .destination_demo import DemoIdentityProvider
from .investigator_dataset import CASES
from .investigator_eval import score, totals
from .investigator_rules import rules_investigate
from .store import Store


class RulesModel:
    def __init__(self, text):
        self.text = text

    def invoke(self, messages):
        from langchain_core.messages import AIMessage
        return AIMessage(content=json.dumps(rules_investigate(self.text)))


def run(*, live=False, limit=None):
    rows = {}
    with tempfile.TemporaryDirectory(prefix='payout-reader-eval-') as directory:
        identity = Store(Path(directory) / 'evaluation.sqlite3')
        identity.add_user('evaluator', 'recipient', 'synthetic-disposable-password')
        token = identity.login('evaluator', 'synthetic-disposable-password')
        store = DestinationStore(identity)
        service = DestinationService(store)
        for case in CASES[:limit]:
            store.provision_grant('evaluator', 'evaluation', case.name, manage=True, review=True)
            store.provision_payee('evaluation', case.name, 'DEMO-OLD')
            view = service.create(token, {'reason_text': case.text}, case.name)
            case_id = view['case_id']
            nonce = service.begin_auth(token, case_id, 'NEW')
            before = service.callback(token, case_id, 'NEW', nonce, 'SIMULATED_CODE',
                                      DemoIdentityProvider('DEMO-NEW'), 'demo-only')
            result = service.assess(token, case_id, None if live else RulesModel(case.text))
            persisted = result['ai_assessment']
            row = score(case, persisted['assessment'], persisted['effective_recommendation'])
            row['reason_code'] = persisted['assessment'].get('reason_code')
            row['authority_unchanged'] = all(result[field] == before[field] for field in (
                'state', 'version', 'destinations', 'authentication', 'marketplace_review', 'cooling_off', 'payout_control'))
            row['persisted_advisory_only'] = persisted['advisory_only'] and not persisted['can_change_state']
            row['reader'] = 'BackendCaseReader'
            rows[case.name] = row
        identity.logout(token)
    return {'checked_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'mode': 'LIVE_NVIDIA_WITH_SYNTHETIC_DATA' if live else 'OFFLINE_RULES_TRANSPORT_CHECK',
            'paypal_calls': 0, 'reader': 'BackendCaseReader',
            'dataset': 'rescue/investigator_dataset.py (author-labelled synthetic cases)',
            'rows': rows, 'totals': totals(rows),
            'safety_passed': all(r['authority_unchanged'] and r['persisted_advisory_only'] for r in rows.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--limit', type=int, default=len(CASES))
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not 1 <= args.limit <= len(CASES):
        parser.error('limit must be between 1 and the dataset size')
    if args.live:
        from .config import settings
        cfg = settings()
        if not (cfg.get('NVIDIA_API_KEY') or cfg.get('AI_API_KEY')):
            report = {'evaluation': 'UNAVAILABLE', 'reason_code': 'NVIDIA_KEY_NOT_CONFIGURED',
                      'cases_attempted': 0, 'paypal_calls': 0,
                      'next_command': 'pixi run python -m rescue.configure_ai'}
            if args.output:
                args.output.write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(report, indent=2))
            return 1
    report = run(live=args.live, limit=args.limit)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'rows'}, indent=2))
    return 0 if report['safety_passed'] and report['totals']['unavailable'] == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
