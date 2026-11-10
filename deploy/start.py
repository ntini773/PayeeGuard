"""Single-instance Render demo bootstrap. Existing storage is never reset."""
import os
from pathlib import Path
import subprocess
import sys


def main():
    runtime = Path(os.environ['RESCUE_RUNTIME_DIR'])
    if not os.environ.get('RESCUE_PUBLIC_ORIGIN', '').startswith('https://'):
        raise SystemExit('Set RESCUE_PUBLIC_ORIGIN to the exact HTTPS service origin')
    mode = os.environ.get('RESCUE_MODE', 'sandbox')
    ai = os.environ.get('RESCUE_AI', 'nvidia')
    if mode not in ('demo', 'sandbox') or ai not in ('nvidia', 'fixture'):
        raise SystemExit('Invalid deployment mode')
    if mode == 'sandbox' and ai != 'nvidia':
        raise SystemExit('Sandbox requires NVIDIA')
    if not (runtime / ('app-' + mode + '.sqlite3')).exists():
        command = [sys.executable, '-m', 'rescue.app', 'init', '--mode', mode]
        if mode == 'sandbox':
            required = ('RESCUE_ITEM_ID', 'RESCUE_EXPECTED_PAYER_ID', 'RESCUE_AMOUNT', 'RESCUE_CURRENCY')
            if not all(os.environ.get(key) for key in required):
                raise SystemExit('First sandbox startup requires trusted RESCUE_ITEM_ID, RESCUE_EXPECTED_PAYER_ID, RESCUE_AMOUNT and RESCUE_CURRENCY')
            for flag, key in zip(('--item-id', '--expected-payer-id', '--amount', '--currency'), required):
                command.extend([flag, os.environ[key]])
        subprocess.run(command, check=True)
    os.execv(sys.executable, [sys.executable, '-m', 'rescue.app', 'serve', '--mode', mode, '--ai', ai])


if __name__ == '__main__':
    main()
