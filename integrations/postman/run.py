"""Run the real Postman CLI against a disposable offline app. Never upload results."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]


def main():
    cli = shutil.which('postman')
    if not cli:
        raise SystemExit('Postman CLI is missing. Install it using the official guide linked in integrations/README.md.')
    env = dict(os.environ)
    for name in ('POSTMAN_API_KEY', 'RESCUE_PUBLIC_ORIGIN', 'RESCUE_RUNTIME_DIR'):
        env.pop(name, None)
    # This is an unlinked local JSON collection, with no cloud ID or API key.
    with tempfile.TemporaryDirectory(prefix='rescue-postman-') as directory:
        runtime = Path(directory)
        env['XDG_CONFIG_HOME'] = str(runtime / 'config')
        command = [sys.executable, '-m', 'rescue.app']
        options = ['--mode', 'demo', '--ai', 'fixture', '--runtime-dir', directory]
        subprocess.run(command + ['init'] + options, cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)
        credentials = json.loads((runtime / 'demo-accounts.json').read_text())
        variables = runtime / 'environment.json'
        variables.write_text(json.dumps({'name':'Disposable fixture', 'values':[
            {'key': user+'Password', 'value': password, 'enabled': True, 'type':'secret'}
            for user, password in credentials.items()]}))
        variables.chmod(0o600)
        with (runtime / 'server.log').open('w') as log:
            server = subprocess.Popen(command + ['serve'] + options, cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                for _ in range(50):
                    if server.poll() is not None:
                        raise SystemExit('Fixture server could not start. Stop other port 8765 listeners and check socket permissions.')
                    try:
                        with urlopen('http://127.0.0.1:8765/healthz', timeout=1) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise SystemExit('Fixture server did not become healthy')
                result = subprocess.run([cli, 'collection', 'run',
                    str(ROOT / 'integrations/postman/safety.postman_collection.json'),
                    '-e', str(variables), '--reporters', 'cli'], cwd=ROOT, env=env)
                return result.returncode
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


if __name__ == '__main__':
    sys.exit(main())
