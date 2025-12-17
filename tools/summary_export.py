#!/usr/bin/env python3
import json
from pathlib import Path
from collections import Counter
p=Path('exports/php-files-to-convert.json')
js=json.loads(p.read_text())
print('Total files:', len(js))
print('Counts by priority:')
for k,v in Counter([x['priority_group'] for x in js]).most_common():
    print(f'{k}: {v}')
print('\nTop 20 files:')
for x in js[:20]:
    print(x['path'])
