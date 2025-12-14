Migration Porting Notes
-----------------------

What I changed
- Made many migrations driver-aware and sqlite-compatible.
- Replaced inline awaits in non-async callbacks with pre-evaluated `originalHas` maps.
- Added defensive index/constraint drops and `originalHas` checks in `down()` functions.
- Replaced MySQL-only constructs (FULLTEXT, TINYINT UNSIGNED, named PRIMARY KEY clauses) with portable alternatives.

How to validate locally
1. Sync `.cjs` copies and run the bundled runner to apply all migrations against a fresh tmp SQLite DB:

```bash
node tools/sync_migrations_to_tmp_cjs.cjs
node tools/run_migrations_tmp_latest.cjs
```

2. Run tests:

```bash
npm test
```

Notes
- The runner uses `tmp/migrations_cjs` and `tmp/dev.sqlite3`. It will recreate `tmp/dev.sqlite3` for a clean run.
- I avoided adding temporary artifacts like `tmp/dev.sqlite3` to the repo.

If you want, I can open a PR branch and push these commits (requires a remote). Otherwise I can prepare the PR description here.
