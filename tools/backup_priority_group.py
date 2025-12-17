#!/usr/bin/env python3
import json
import shutil
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'exports' / 'php-files-to-convert.json'
with open(EXPORT, 'r', encoding='utf-8') as f:
    files = json.load(f)

# filter for auth
group = 'auth'
items = [p for p in files if p['priority_group'] == group]
print(f'Found {len(items)} files in priority {group}')

# Use forward-slash-safe paths and verbose output for Windows PowerShell and cmd
stamp = datetime.now().strftime('%Y%m%d')
OUT = ROOT / 'backups' / 'php-converted' / f'{group}-{stamp}'
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

# Print short summary
print('Copied', copied, 'files to', str(OUT))
print('Log written to', str(log))
