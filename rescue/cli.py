import argparse
import json
import os
from .config import ROOT, settings
from .paypal import PayPal, ProbeError
from .experiments import Experiments
from .login import login


def main():
    parser = argparse.ArgumentParser(description='Sandbox feasibility gates; all payouts fixed at USD 0.01')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('access')
    sub.add_parser('login')
    for command in ('batch', 'item', 'cancel'):
        p = sub.add_parser(command)
        p.add_argument('id')
    p = sub.add_parser('create-email')
    p.add_argument('name')
    p.add_argument('email')
    p = sub.add_parser('create-payer')
    p.add_argument('name')
    args = parser.parse_args()
    os.umask(0o077)
    runtime = ROOT / '.runtime'
    runtime.mkdir(mode=0o700, exist_ok=True)
    paypal = PayPal(settings())
    experiments = Experiments(runtime / 'experiments.sqlite3', paypal)
    try:
        if args.command == 'access':
            paypal.access_token()
            result = {'oauth': 'PASS', 'payouts_access': 'NOT YET PROVEN'}
        elif args.command == 'login':
            result = experiments.record('identity', login(paypal))
        elif args.command == 'create-email':
            result = experiments.create(args.name, args.email, 'EMAIL')
        elif args.command == 'create-payer':
            row = experiments.db.execute("SELECT data FROM evidence WHERE kind='identity' ORDER BY seq DESC LIMIT 1").fetchone()
            if not row:
                raise ProbeError('Run login first; typed payer IDs are not authentication evidence')
            result = experiments.create(args.name, json.loads(row[0])['payer_id'], 'PAYPAL_ID')
        elif args.command == 'cancel':
            result = experiments.cancel(args.id)
        else:
            result = experiments.record(args.command, getattr(paypal, args.command)(args.id))
        print(json.dumps(result, indent=2))
    except ProbeError as exc:
        experiments.record('error', {'command': args.command, 'message': str(exc)})
        print(str(exc))
        raise SystemExit(1)
    finally:
        experiments.db.close()


if __name__ == '__main__':
    main()
