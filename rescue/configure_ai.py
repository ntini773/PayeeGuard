"""Configure this project's NVIDIA key privately without changing PayPal settings."""
import getpass
import os
from pathlib import Path
import tempfile
from .config import ROOT


def save_key(path, key):
    if not isinstance(key, str) or not key or any(c.isspace() for c in key) or any(c in key for c in ('"', "'")):
        raise ValueError('Enter a nonempty API key without whitespace or quotes')
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Refusing to replace a linked configuration file')
    original = path.read_text() if path.exists() else ''
    lines = [line for line in original.splitlines() if line.split('=', 1)[0].strip() != 'NVIDIA_API_KEY']
    lines.append('NVIDIA_API_KEY=' + key)
    descriptor, temporary = tempfile.mkstemp(prefix='.nvidia-config-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write('\n'.join(lines) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    try:
        key = getpass.getpass('NVIDIA API key (hidden; saved only in this project): ')
        save_key(ROOT / '.env', key)
    except (ValueError, OSError) as exc:
        print('Configuration was not saved (' + type(exc).__name__ + '). No key was printed.')
        raise SystemExit(1) from None
    print('Saved NVIDIA_API_KEY in the project-local .env with owner-only permissions. PayPal settings preserved.')
    print('Next: pixi run diagnose-ai')


if __name__ == '__main__':
    main()
