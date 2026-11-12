"""Disposable destination demo. All identities and payouts in this module are simulated."""
import argparse
import json
import os
from pathlib import Path
import secrets
from .destination_errors import DestinationError
from .destination_store import DestinationStore
from .destination_service import DestinationService
from .destination_policy import Policy
from .marketplace_payouts import MarketplacePayouts
from .store import Store
from .config import settings


class DemoPayoutProvider:
    simulated = True

    def __init__(self, store):
        self.store = store

    def create(self, payload):
        # A synthetic receipt only. No HTTP client, API credentials or money movement.
        return {'batch_header': {'payout_batch_id': 'SIM-' + payload['sender_batch_header']['sender_batch_id']}}

    def batch(self, batch_id):
        with self.store.connect() as db:
            row = db.execute("SELECT data FROM pg_payouts WHERE json_extract(data,'$.provider_batch_id')=?", (batch_id,)).fetchone()
        if not row:
            raise DestinationError('CASE_NOT_FOUND', 404)
        op = json.loads(row[0])
        if not op['simulation']:
            raise DestinationError('SIMULATION_FORBIDDEN', 403)
        return {'batch_header': {'payout_batch_id': batch_id, 'sender_batch_header': {'sender_batch_id': op['sender_batch_id']}},
                'items': [{'transaction_status': 'SUCCESS', 'payout_item': {
                    'recipient_type': 'PAYPAL_ID', 'receiver': op['payer_id'], 'sender_item_id': op['sender_batch_id'],
                    'amount': {'value': op['amount'], 'currency': op['currency']}}}]}


class DemoIdentityProvider:
    simulated = True

    def __init__(self, payer):
        self.payer = payer

    def identity(self, code, redirect):
        return {'payer_id': self.payer, 'verified_account': True}


def seed(directory):
    """Refuse to reuse any directory, protecting databases, credentials and audits."""
    root = Path(directory)
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    identity = Store(root / 'app-demo.sqlite3')
    credentials = identity.initialize('demo', 'DEMO-ALICE', 'SIM-ORIGINAL')
    for user in ('staff', 'external'):
        credentials[user] = secrets.token_urlsafe(24)
        identity.add_user(user, 'recipient', credentials[user])
    store = DestinationStore(identity)
    for user in credentials:
        store.provision_grant(user, 'demo-marketplace', 'demo-seller', manage=user in ('creator', 'external'),
                              review=user == 'operator', channel='external' if user == 'external' else 'browser')
    store.provision_payee('demo-marketplace', 'demo-seller', 'DEMO-ALICE', cap='0.01')
    service = DestinationService(store, policy=Policy.configured(settings(), 'demo'))
    payouts = MarketplacePayouts(service, DemoPayoutProvider(store))
    payouts.provision('demo-marketplace', 'demo-seller', 'demo-earning-1', amount='0.01', currency='USD')
    token = identity.login('creator', credentials['creator'])
    try:
        case = service.create(token, {'reason_text': 'I opened a new account for my shop.'}, 'demo-change-1')
        nonce = service.begin_auth(token, case['case_id'], 'NEW')
        service.callback(token, case['case_id'], 'NEW', nonce, 'SIMULATED_CODE', DemoIdentityProvider('DEMO-NEW'), 'demo-only')
    finally:
        identity.logout(token)
    path = root / 'demo-accounts.json'
    path.write_text(json.dumps(credentials, indent=2))
    path.chmod(0o600)
    return {'directory': str(root), 'case_id': case['case_id'], 'simulation': True,
            'credentials_file': str(path), 'state': 'PENDING_OLD_ACCOUNT_AUTH'}


def seed_six(directory):
    result = seed(directory)
    store = DestinationStore(Store(directory / 'app-demo.sqlite3'))
    # Explicit fixture construction, isolated from production transitions.
    from .destination_store import encode
    import uuid, time
    with store.connect() as db:
        base = json.loads(db.execute('SELECT data FROM pg_cases LIMIT 1').fetchone()[0])
        db.execute('DELETE FROM pg_cases')
        seeded = []
        for state in ('PENDING_OLD_ACCOUNT_AUTH', 'APPROVED_COOLING_OFF', 'PENDING_REVIEW', 'ACTIVE_NEW_DESTINATION', 'REJECTED', 'EXPIRED'):
            case = json.loads(encode(base))
            case.update(case_id='chg_' + uuid.uuid4().hex, state=state, simulation=True)
            if state == 'APPROVED_COOLING_OFF':
                case['authentication']['old_account'] = {'status': 'MATCHED', 'verified_by': 'DEMO_SIMULATION'}
                case['recovery_evidence'] = [{'kind': 'SELLER_ENTITLEMENT', 'reference': 'SIM-RECORD', 'accepted': True, 'at': time.time(), 'verifier': 'operator', 'reason': 'Explicit simulated marketplace fixture'}]
                case['marketplace_review'] = {'decision': 'APPROVED', 'actor': 'operator', 'at': time.time(),
                    'policy_version': case['policy_version'], 'approved_version': case['version']}
                case['cooling_off'] = {'status': 'WAITING', 'ends_at': time.time() + Policy.configured(settings(), 'demo').cooling_seconds, 'simulation': True}
            db.execute('INSERT INTO pg_cases VALUES (?,?,?,?)', (case['case_id'], case['tenant_id'], case['seller_id'], encode(case)))
            store.event(db, case['tenant_id'], case['seller_id'], case['case_id'], 'demo-seed', 'SIMULATED_STATE_FIXTURE', {'state': state})
            seeded.append({'state': state, 'masked_case_id': 'chg_***' + case['case_id'][-6:]})
    result.pop('case_id', None)
    result['cases'] = seeded
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, help='New directory only; existing directories are never reset')
    args = parser.parse_args()
    os.umask(0o077)
    if args.directory is None:
        import tempfile
        parent = Path(tempfile.mkdtemp(prefix='payout-six-state-'))
        args.directory = parent / 'runtime'
    try:
        result = seed_six(args.directory)
    except FileExistsError:
        parser.error('Directory already exists; choose a new disposable demo directory')
    print(json.dumps(result, indent=2))
    print('No real PayPal or NVIDIA call was made. Credentials are saved privately, not printed.')


if __name__ == '__main__':
    main()
