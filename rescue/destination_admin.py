"""Trusted local provisioning/review integration; no web or model can invoke it.

Use --help. Never pass passwords/API keys as command-line arguments.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
from .store import Store
from .config import settings
from .destination_store import DestinationStore
from .destination_service import DestinationService
from .destination_policy import Policy
from .marketplace_payouts import MarketplacePayouts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--mode', choices=['demo', 'sandbox'], required=True)
    commands = parser.add_subparsers(dest='command', required=True)
    grant = commands.add_parser('grant', help='Provision trusted prototype marketplace permissions')
    for arg in ('user', 'tenant', 'seller'):
        grant.add_argument('--' + arg, required=True)
    grant.add_argument('--manage', action='store_true')
    grant.add_argument('--review', action='store_true')
    grant.add_argument('--channel', choices=['browser', 'external'], default='browser')
    apikey = commands.add_parser('apikey', help='Create or revoke a marketplace backend API key (external-channel user only)')
    apikey.add_argument('--user', required=True)
    apikey.add_argument('--label', required=True)
    apikey.add_argument('--revoke', action='store_true')
    payee = commands.add_parser('payee', help='Insert a trusted existing payee; never replace one')
    for arg in ('tenant', 'seller', 'active-payer-id', 'cap', 'currency'):
        payee.add_argument('--' + arg, required=True)
    payee.add_argument('--legal-name', help='Seller name on marketplace records. Compared with the name on the PayPal account.')
    payee.add_argument('--country', help='Two-letter country on marketplace records.')
    signals = commands.add_parser('signals', help='Import marketplace security signals (simulated feed). No PayPal call')
    for arg in ('tenant', 'seller'):
        signals.add_argument('--' + arg, required=True)
    signals.add_argument('--entitlement-confirmed', action='store_true', help='Marketplace records confirm this seller (simulated).')
    for arg in ('new-device', 'password-reset', 'country-change', 'destination-change'):
        signals.add_argument('--' + arg + '-hours-ago', type=float, help='Hours since this event. Leave out for never.')
    earning = commands.add_parser('earning', help='Provision a trusted marketplace earning; no PayPal call')
    for arg in ('tenant', 'seller', 'earning-id'):
        earning.add_argument('--' + arg, required=True)
    earning.add_argument('--amount', default='0.01')
    earning.add_argument('--currency', default='USD')
    evidence = commands.add_parser('evidence', help='Record marketplace-owned evidence, not seller claims')
    for arg in ('user', 'case', 'reference', 'reason'):
        evidence.add_argument('--' + arg, required=True)
    evidence.add_argument('--kind', choices=['SELLER_ENTITLEMENT', 'ACCOUNT_RECOVERY'], required=True)
    evidence.add_argument('--version', required=True, type=int)
    evidence.add_argument('--accepted', action='store_true')
    args = parser.parse_args()
    if not args.database.is_file():
        parser.error('Initialize the app database first; no new database was created')
    os.umask(0o077)
    identity = Store(args.database)
    if identity.metadata('mode') != args.mode:
        parser.error('Database mode mismatch')
    store = DestinationStore(identity)
    service = DestinationService(store, policy=Policy.configured(settings(), args.mode))
    if args.command == 'grant':
        store.provision_grant(args.user, args.tenant, args.seller, manage=args.manage, review=args.review, channel=args.channel)
    elif args.command == 'apikey':
        if args.revoke:
            print(json.dumps({'revoked': identity.revoke_api_key(args.user, args.label)}))
        else:
            key = identity.create_api_key(args.user, args.label)
            target = Path(args.database).parent / f'api-key-{args.label}.txt'
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as handle:
                handle.write(key + '\n')
            print(json.dumps({'api_key': 'CREATED', 'saved_privately': str(target), 'note': 'shown once; only a digest is stored'}))
    elif args.command == 'payee':
        store.provision_payee(args.tenant, args.seller, args.active_payer_id, currency=args.currency, cap=args.cap,
                              legal_name=args.legal_name, country=args.country)
    elif args.command == 'signals':
        import time
        now = time.time()
        hours = {'new_device_at': args.new_device_hours_ago, 'password_reset_at': args.password_reset_hours_ago,
                 'country_change_at': args.country_change_hours_ago, 'last_destination_change_at': args.destination_change_hours_ago}
        store.provision_signals(args.tenant, args.seller, entitlement_confirmed=args.entitlement_confirmed,
                                **{k: (now - v * 3600 if v is not None else None) for k, v in hours.items()})
        print(json.dumps({'signals': 'IMPORTED', 'source': 'SIMULATED_FEED', 'events': sorted(k for k, v in hours.items() if v is not None)}))
    elif args.command == 'earning':
        if args.mode == 'sandbox':
            # Sandbox money is fake, but keep a ceiling so a typo cannot ask for a huge payout. USD only.
            from decimal import Decimal, InvalidOperation
            try:
                amount = Decimal(args.amount)
            except InvalidOperation:
                amount = Decimal('-1')
            if args.currency != 'USD' or not Decimal('0.01') <= amount <= Decimal('1000.00') or amount.as_tuple().exponent < -2:
                parser.error('Sandbox test earnings must be USD, from 0.01 to 1000.00, with at most two decimals')
        MarketplacePayouts(service, None).provision(args.tenant, args.seller, args.earning_id,
                                                  amount=args.amount, currency=args.currency)
        print(json.dumps({'earning_id': '***' + args.earning_id[-4:], 'status': 'PROVISIONED'}))
    else:
        token = identity.login(args.user, getpass.getpass('Marketplace password (hidden): '))
        try:
            result = service.record_evidence(token, args.case, kind=args.kind, reference=args.reference,
                reason=args.reason, accepted=args.accepted, expected_version=args.version)
            print(json.dumps({'case_id': result['case_id'], 'version': result['version'], 'state': result['state']}))
        finally:
            identity.logout(token)
    print('Backend operation recorded. No PayPal call was made.')


if __name__ == '__main__':
    main()
