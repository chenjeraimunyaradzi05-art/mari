import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'exports' / 'php-files-to-convert-validated.json'
OUT = ROOT / 'exports' / 'auth-files-summary.json'

with open(EXPORT, 'r', encoding='utf-8') as f:
    items = json.load(f)

auth = [it for it in items if it.get('priority_group') == 'auth']
summary = {'total': len(auth), 'controllers': [], 'views': [], 'commands': [], 'middleware': [], 'other': []}

for it in auth:
    p = it['path']
    if '/Controllers/' in p or 'Controller.php' in p:
        summary['controllers'].append(it)
    elif '/views/' in p or p.endswith('.blade.php') or '/resources/views/' in p or p.endswith('.php') and ('views' in p or 'blade' in p):
        summary['views'].append(it)
    elif '/Console/Commands/' in p:
        summary['commands'].append(it)
    elif '/Middleware/' in p:
        summary['middleware'].append(it)
    else:
        summary['other'].append(it)

# write summary out
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'counts': {k: len(v) for k,v in summary.items() if k != 'total'}, 'files': {k: [x['path'] for x in v] for k,v in summary.items() if k != 'total'}}, f, indent=2)

print('Auth group classified: total=', summary['total'])
print('controllers=', len(summary['controllers']), 'views=', len(summary['views']), 'commands=', len(summary['commands']), 'middleware=', len(summary['middleware']), 'other=', len(summary['other']))
print('Wrote summary to', OUT)
