import json
import os
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXPORT = os.path.join(ROOT, 'exports', 'php-files-to-convert.json')
OUT = os.path.join(ROOT, 'exports', 'php-files-to-convert-validated.json')

with open(EXPORT, 'r', encoding='utf-8') as f:
    items = json.load(f)

counts = Counter()
existing = []
missing = []
converted = []

for it in items:
    counts[it.get('priority_group') or 'other'] += 1
    p = os.path.join(ROOT, it['path'].replace('/', os.path.sep))
    if os.path.exists(p):
        # exclude guides/converted files
        if os.path.commonpath([p, os.path.join(ROOT, 'guide')]) == os.path.join(ROOT, 'guide'):
            converted.append(it)
        else:
            existing.append(it)
    else:
        missing.append(it)

summary = {
    'total_exported': len(items),
    'by_group': dict(counts),
    'existing_on_disk': len(existing),
    'already_converted_in_guide': len(converted),
    'missing_on_disk': len(missing),
}

print('SUMMARY')
print(json.dumps(summary, indent=2))

# write validated list (existing files but excluding files in guide/)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(existing, f, indent=2)

print('\nWrote validated list to', OUT)
