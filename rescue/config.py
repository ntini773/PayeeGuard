import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def settings():
    # Read only this project’s private configuration; shell values take precedence.
    values = {}
    for path in (ROOT / '.env',):
        if path.exists():
            for line in path.read_text().splitlines():
                if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    values[key.strip()] = value.strip().strip('\"\'')
    values.update(os.environ)
    return values
