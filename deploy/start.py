"""Render start script for the hosted judge demo (single instance, persistent disk).

Credentials are never generated here. The first start creates the database and the judge accounts from the
JUDGE_* environment variables. Every later start (restart or redeploy) finds the existing database on the
disk and changes nothing. To change a password on purpose, delete the database file on the disk first.
"""
import os
import sys
from pathlib import Path


def main():
    runtime = Path(os.environ['RESCUE_RUNTIME_DIR'])
    if not os.environ.get('RESCUE_PUBLIC_ORIGIN', '').startswith('https://'):
        raise SystemExit('Set RESCUE_PUBLIC_ORIGIN to the exact HTTPS service origin')
    for key in ('NVIDIA_API_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'):
        if not os.environ.get(key):
            raise SystemExit('Set ' + key)
    if not (runtime / 'app-sandbox.sqlite3').exists():
        from rescue import judge_setup  # first start only: needs the JUDGE_* variables
        print(judge_setup.provision(runtime, os.environ.get('JUDGE_ACTIVE_PAYER_ID', ''),
                                    os.environ.get('JUDGE_SELLER_LEGAL_NAME', ''), os.environ.get('JUDGE_SELLER_COUNTRY', ''),
                                    require_passwords=True))
    else:
        print('Existing database found on the disk. Judge accounts were not touched.')
    os.execv(sys.executable, [sys.executable, '-m', 'rescue.app', 'serve', '--mode', 'sandbox', '--ai', 'nvidia',
                              '--runtime-dir', str(runtime)])


if __name__ == '__main__':
    main()
