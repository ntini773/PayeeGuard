"""Run local Postman contract checks with synthetic data; never touches .runtime."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from rescue.store import Store
from rescue.destination_store import DestinationStore
from rescue.destination_service import DestinationService
from rescue.destination_demo import DemoPayoutProvider
from rescue.marketplace_payouts import MarketplacePayouts


def main():
    cli = shutil.which('postman')
    if not cli:
        raise SystemExit('Postman CLI must be on PATH')
    env = {k: v for k, v in os.environ.items() if not k.startswith(('POSTMAN_', 'RESCUE_', 'AI_', 'NVIDIA_', 'PAYPAL_'))}
    with tempfile.TemporaryDirectory(prefix='payout-destination-postman-') as directory:
        root = Path(directory)
        env['XDG_CONFIG_HOME'] = str(root / 'cli-config')
        db = Store(root / 'app-demo.sqlite3')
        credentials = db.initialize('demo', 'DEMO-ALICE', 'SIM-ORIGINAL')
        for user in ('staff', 'external', 'blockedOperator'):
            credentials[user] = secrets.token_urlsafe(24)
            db.add_user(user, 'recipient', credentials[user])
        ds = DestinationStore(db)
        for user in ('creator', 'operator', 'staff', 'external'):
            ds.provision_grant(user, 'fixture-marketplace', 'fixture-seller',
                manage=user in ('creator', 'external'), review=user == 'operator',
                channel='external' if user == 'external' else 'browser')
        ds.provision_payee('fixture-marketplace', 'fixture-seller', 'DEMO-ALICE')
        ds.provision_grant('blockedOperator', 'fixture-marketplace', 'blocked-seller', manage=True, review=True)
        ds.provision_payee('fixture-marketplace', 'blocked-seller', 'DEMO-BLOCKED')
        service = DestinationService(ds)
        payouts = MarketplacePayouts(service, DemoPayoutProvider(ds))
        payouts.provision('fixture-marketplace', 'fixture-seller', 'earning-1', amount='0.01', currency='USD')
        payouts.provision('fixture-marketplace', 'blocked-seller', 'blocked-earning', amount='0.01', currency='USD')
        token = db.login('blockedOperator', credentials['blockedOperator'])
        case = service.create(token, {'reason_text': 'Synthetic compromise scenario'}, 'blocked-fixture')
        service.set_compromise(token, case['case_id'], compromised=True, reason='Synthetic risk record', expected_version=case['version'])
        db.logout(token)
        variables = root / 'environment.json'
        variables.write_text(json.dumps({'name': 'Disposable fixture credentials', 'values': [
            {'key': user+'Password', 'value': password, 'type': 'secret', 'enabled': True}
            for user, password in credentials.items()]}))
        variables.chmod(0o600)
        with (root / 'server.log').open('w') as log:
            process = subprocess.Popen([sys.executable, '-m', 'rescue.app', 'serve', '--mode', 'demo',
                '--ai', 'fixture', '--runtime-dir', directory], cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                for _ in range(50):
                    if process.poll() is not None:
                        raise SystemExit('Disposable server failed to start. Check local socket permissions and port 8765 availability.')
                    try:
                        with urlopen('http://127.0.0.1:8765/healthz', timeout=1) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise SystemExit('Disposable server did not become healthy')
                return subprocess.run([cli, 'collection', 'run',
                    str(ROOT / 'integrations/postman/destination.postman_collection.json'),
                    '-e', str(variables), '--reporters', 'cli'], cwd=ROOT, env=env).returncode
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == '__main__':
    raise SystemExit(main())
