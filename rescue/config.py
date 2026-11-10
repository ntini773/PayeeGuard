import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def settings():
    # Read credentials in place; never copy the source .env into this repository.
    values = {}
    for path in (ROOT.parent / 'counteroffer' / '.env', ROOT / '.env'):
        if path.exists():
            for line in path.read_text().splitlines():
                if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    values[key.strip()] = value.strip().strip('\"\'')
    values.update(os.environ)
    return values
