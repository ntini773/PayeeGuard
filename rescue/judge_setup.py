"""One-time, idempotent setup of the marketplace data that judges test with.

Creates, only if they do not exist yet:
  - the database (sandbox mode),
  - app logins `seller` and `seller_stolen` (same password) and `operator` and `operator_stolen` (same password).
    A login can review only one seller, so each seller has its own care-team login,
  - two marketplace sellers: `seller-1` (clean signals, for the genuine case) and
    `seller-2` (new device + password reset signals, for the stolen-login case),
  - each seller's established PayPal account A as the active payout account,
  - two small sandbox earnings per seller.

Existing users, payees, signals and earnings are never changed, so a restart or a redeploy
never regenerates credentials. To change a password, delete the database on purpose.

Passwords are read from the environment only (never from command-line arguments, never printed):
  JUDGE_SELLER_PASSWORD, JUDGE_OPERATOR_PASSWORD
With --require-passwords (used by the Render start script) a missing password stops the start.
Without it, a missing password is generated once and saved to <runtime dir>/judge-accounts.json (mode 0600).

Other inputs (flag or environment):
  --active-payer-id / JUDGE_ACTIVE_PAYER_ID   PayPal payer ID of the seller's current account (account A)
  --legal-name / JUDGE_SELLER_LEGAL_NAME      seller's name on marketplace records (matches the new account B's PayPal name)
  --country / JUDGE_SELLER_COUNTRY            two-letter country on marketplace records
"""
import argparse
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path

from .config import settings
from .destination_policy import Policy
from .destination_service import DestinationService
from .destination_store import DestinationStore
from .marketplace_payouts import MarketplacePayouts
from .store import Store

TENANT = 'marketplace-demo'
SELLERS = (  # seller login, marketplace seller id, signals (hours ago), entitlement confirmed, care-team login
    ('seller', 'seller-1', {}, True, 'operator'),
    ('seller_stolen', 'seller-2', {'new_device_at': 3.0, 'password_reset_at': 20.0}, False, 'operator_stolen'),
)
EARNINGS = (('order-1001', '1.00'), ('order-1002', '1.00'))
PASSWORD_VARIABLES = {'seller': 'JUDGE_SELLER_PASSWORD', 'operator': 'JUDGE_OPERATOR_PASSWORD'}


def _password(role, generated, require):
    value = os.environ.get(PASSWORD_VARIABLES[role], '')
    if value:
        if len(value) < 12:
            raise SystemExit(PASSWORD_VARIABLES[role] + ' must be at least 12 characters')
        return value
    if require:
        raise SystemExit('Set ' + PASSWORD_VARIABLES[role] + ' (deployments never generate credentials)')
    generated[role] = secrets.token_urlsafe(18)
    return generated[role]


def provision(runtime, active_payer_id, legal_name, country, require_passwords=False):
    """Returns a status dictionary. It never contains passwords."""
    runtime = Path(runtime)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', active_payer_id or ''):
        raise SystemExit('A valid active payer ID is required (JUDGE_ACTIVE_PAYER_ID)')
    os.umask(0o077)
    runtime.mkdir(parents=True, exist_ok=True)
    database = runtime / 'app-sandbox.sqlite3'
    store = Store(database)
    with store.connect() as db:
        if not db.execute('SELECT 1 FROM metadata').fetchone():
            db.execute('INSERT INTO metadata VALUES (?,?)', ('mode', 'sandbox'))
    if store.metadata('mode') != 'sandbox':
        raise SystemExit('This database is not in sandbox mode')
    generated = {}
    status: dict = {'users': {}, 'sellers': {}}
    destinations = DestinationStore(store)
    service = DestinationService(destinations, policy=Policy.configured(settings(), 'sandbox'))

    chosen = {}

    def password_for(role):
        if role not in chosen:
            chosen[role] = _password(role, generated, require_passwords)
        return chosen[role]

    def ensure_user(user, role, password_role):
        with store.connect() as db:
            exists = db.execute('SELECT 1 FROM users WHERE id=?', (user,)).fetchone()
        if exists:
            status['users'][user] = 'EXISTS (unchanged)'
            return
        store.add_user(user, role, password_for(password_role))
        status['users'][user] = 'CREATED'

    ensure_user('operator', 'operator', 'operator')
    ensure_user('operator_stolen', 'operator', 'operator')
    ensure_user('seller', 'recipient', 'seller')
    ensure_user('seller_stolen', 'recipient', 'seller')

    now = time.time()
    for user, seller, hours, entitled, care in SELLERS:
        with store.connect() as db:
            payee = db.execute('SELECT 1 FROM pg_payees WHERE tenant=? AND seller=?', (TENANT, seller)).fetchone()
        if payee:
            status['sellers'][seller] = 'EXISTS (unchanged)'
            continue
        destinations.provision_payee(TENANT, seller, active_payer_id, cap='100.00', currency='USD',
                                     legal_name=legal_name or None, country=country or None)
        destinations.provision_grant(user, TENANT, seller, manage=True)
        destinations.provision_grant(care, TENANT, seller, review=True)
        destinations.provision_signals(TENANT, seller, entitlement_confirmed=entitled,
                                       **{key: now - h * 3600 for key, h in hours.items()})  # type: ignore[arg-type]
        for earning_id, amount in EARNINGS:
            MarketplacePayouts(service, None).provision(TENANT, seller, earning_id, amount=amount, currency='USD')
        status['sellers'][seller] = 'CREATED'
    if generated:
        target = runtime / 'judge-accounts.json'
        accounts = {'operator': generated.get('operator'), 'operator_stolen': generated.get('operator'), 'seller': generated.get('seller'), 'seller_stolen': generated.get('seller')}
        accounts = {k: v for k, v in accounts.items() if v}
        existing = json.loads(target.read_text()) if target.exists() else {}
        existing.update(accounts)
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as handle:
            json.dump(existing, handle)
        status['generated_passwords_saved_privately'] = str(target)
    return status


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--directory', type=Path, default=Path(os.environ.get('RESCUE_RUNTIME_DIR', 'runtime')))
    parser.add_argument('--active-payer-id', default=os.environ.get('JUDGE_ACTIVE_PAYER_ID', ''))
    parser.add_argument('--legal-name', default=os.environ.get('JUDGE_SELLER_LEGAL_NAME', ''))
    parser.add_argument('--country', default=os.environ.get('JUDGE_SELLER_COUNTRY', ''))
    parser.add_argument('--require-passwords', action='store_true', help='Fail instead of generating a missing password (deployments)')
    args = parser.parse_args(argv)
    print(json.dumps(provision(args.directory, args.active_payer_id, args.legal_name, args.country, args.require_passwords), indent=2))


if __name__ == '__main__':
    sys.exit(main())
