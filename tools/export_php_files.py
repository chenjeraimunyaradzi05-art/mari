#!/usr/bin/env python3
import os
import json
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = ["/vendor/", "\\vendor\\", "/node_modules/", "\\node_modules\\", "/.git/", "\\.git\\", "/storage/", "\\storage\\", "/public/vendor/", "\\public\\vendor\\"]
INCLUDE_EXTS = ('.php', '.blade.php')

priority_map = [
    ("auth", ["auth", "verify", "password", "login", "register", "forgot", "reset", "mfa"]),
    ("profile", ["profile", "profile-verification", "update-password", "delete-user", "delete-account"]),
    ("social", ["social", "post", "comment", "reaction", "follow", "followController", "postController", "posts"]),
    ("messages", ["message", "conversation", "messaging"]),
    ("admin", ["admin", "moderation", "verification", "site-setting"]),
    ("marketplace", ["marketplace", "listing", "women-real-estate"]),
    ("emails", ["mail", "emails", "newsletter", "mail/", "Mail\\"]),
]

results = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    # skip excluded dirs early
    lp = str(dirpath)
    if any(x.lower() in lp.lower() for x in EXCLUDE_DIRS):
        continue
    for fname in filenames:
        if not fname.endswith(INCLUDE_EXTS):
            continue
        fpath = os.path.join(dirpath, fname)
        # filter again for vendor in full path
        if any(x.lower() in fpath.lower() for x in EXCLUDE_DIRS):
            continue
        rel = os.path.relpath(fpath, ROOT)
        entry = {
            "path": rel.replace('\\', '/'),
            "name": os.path.basename(fpath),
            "ext": os.path.splitext(fname)[1],
            "size": os.path.getsize(fpath),
        }
        # infer priority
        lower = rel.lower()
        assigned = False
        for pr, tokens in priority_map:
            for t in tokens:
                if t in lower:
                    entry['priority_group'] = pr
                    assigned = True
                    break
            if assigned:
                break
        if not assigned:
            entry['priority_group'] = 'other'
        results.append(entry)

# Sort groups: auth, profile, social, messages, admin, marketplace, emails, other
group_order = {"auth":1, "profile":2, "social":3, "messages":4, "admin":5, "marketplace":6, "emails":7, "other":99}
results.sort(key=lambda r: (group_order.get(r['priority_group'], 50), r['path']))

OUTDIR = ROOT / 'exports'
OUTDIR.mkdir(exist_ok=True)

json_path = OUTDIR / 'php-files-to-convert.json'
csv_path = OUTDIR / 'php-files-to-convert.csv'

with open(json_path, 'w', encoding='utf-8') as jf:
    json.dump(results, jf, indent=2)

with open(csv_path, 'w', encoding='utf-8', newline='') as cf:
    writer = csv.DictWriter(cf, fieldnames=['path','name','ext','size','priority_group'])
    writer.writeheader()
    for r in results:
        writer.writerow(r)

print(f"Wrote {len(results)} files to {json_path} and {csv_path}")
