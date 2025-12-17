#!/usr/bin/env python3
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime

if len(sys.argv) < 2:
    print('Usage: backup_group.py <group>')
    sys.exit(1)

GROUP = sys.argv[1]
ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'exports' / 'php-files-to-convert.json'

with open(EXPORT, 'r', encoding='utf-8') as f:
    files = json.load(f)

items = [p for p in files if p['priority_group'] == GROUP]
print(f'Found {len(items)} files in priority {GROUP}')

stamp = datetime.now().strftime('%Y%m%d')
OUT = ROOT / 'backups' / 'php-converted' / f'{GROUP}-{stamp}'
OUT.mkdir(parents=True, exist_ok=True)
log = OUT / 'backup-log.txt'

copied = 0
with open(log, 'w', encoding='utf-8') as lg:
    for it in items:
        src = ROOT / it['path']
        if not src.exists():
            lg.write(f'MISSING: {it["path"]}\n')
            continue
        dst = OUT / it['path']
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src), str(dst))
        lg.write(f'COPIED: {it["path"]}\n')
        copied += 1

print('Copied', copied, 'files to', str(OUT))
print('Log written to', str(log))
