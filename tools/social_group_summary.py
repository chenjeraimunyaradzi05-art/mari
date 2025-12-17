import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'exports' / 'php-files-to-convert-validated.json'
OUT = ROOT / 'exports' / 'social-files-summary.json'

with open(EXPORT, 'r', encoding='utf-8') as f:
    items = json.load(f)

social = [it for it in items if it.get('priority_group') == 'social']
summary = {'total': len(social), 'controllers': [], 'views': [], 'models': [], 'jobs': [], 'migrations': [], 'other': []}

for it in social:
    p = it['path']
    if '/Controllers/' in p or 'Controller.php' in p:
        summary['controllers'].append(it)
    elif p.endswith('.blade.php') or '/views/' in p or 'resources/views' in p:
        summary['views'].append(it)
    elif '/Models/' in p:
        summary['models'].append(it)
    elif '/Jobs/' in p or 'Job.php' in p:
        summary['jobs'].append(it)
    elif '/migrations/' in p or '/database/migrations/' in p:
        summary['migrations'].append(it)
    else:
        summary['other'].append(it)

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'counts': {k: len(v) for k, v in summary.items() if k != 'total'}, 'files': {k: [x['path'] for x in v] for k, v in summary.items() if k != 'total'}}, f, indent=2)

print('Social group classified: total=', summary['total'])
print('controllers=', len(summary['controllers']), 'views=', len(summary['views']), 'models=', len(summary['models']), 'jobs=', len(summary['jobs']), 'migrations=', len(summary['migrations']), 'other=', len(summary['other']))
print('Wrote summary to', OUT)
