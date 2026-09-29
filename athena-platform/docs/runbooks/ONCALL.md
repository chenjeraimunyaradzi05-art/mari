# On-Call Runbook

**Backend:** the API host's public URL, `https://api.your-domain.com` below (`NEXT_PUBLIC_API_URL` on the web tier)  
**Frontend:** `https://athena-empress.netlify.app`  
**Database:** Neon PostgreSQL (`ap-southeast-2`)  
**Hosting:** API host (Express) / Neon (database) / Netlify (web client)

```bash
# Set once per shell for the commands below
export API_URL=https://api.your-domain.com
```

---

## Quick Health Checks

```bash
# Basic health
curl $API_URL/health

# Readiness (checks Neon)
curl $API_URL/readyz

# Auth flow diagnostics (12 checks)
curl $API_URL/health/auth-diag

# Metrics (requires token)
curl -H "X-Metrics-Token: $METRICS_TOKEN" $API_URL/metrics

# Through the web tier's proxy — proves NEXT_PUBLIC_API_URL is right
curl https://athena-empress.netlify.app/api/health
```

**Correlation:** Every request includes `X-Request-Id`. Error responses include `requestId` to correlate with server logs.

---

## Common Failure Modes

### Auth routes returning 500
1. Run `/health/auth-diag` — it tests all 12 auth dependencies
2. Common causes:
   - **Missing DB columns:** Schema/migration mismatch (`npx prisma migrate status` with `DIRECT_DATABASE_URL` set)
   - **JWT_SECRET not set:** Server falls back to random secret that won't persist across restarts
   - **DB unreachable:** Check `DATABASE_URL` on the host and the compute state in the Neon console
3. Read the API host's logs: `start.ts` prints boot errors and migration output visibly

### `/readyz` is 503
- Neon connectivity failure. Check:
  - Compute state in the Neon console (a suspended compute wakes on the first connection; a stuck one shows here)
  - `DATABASE_URL` on the host is the **pooled** URL with `sslmode=require`
  - Connection count in Neon → Monitoring (the direct URL used for traffic exhausts it fast)

### `/api/*` fails on the Netlify site but the API answers directly
- `NEXT_PUBLIC_API_URL` was unset or stale **when the site was built**. The catch-all proxy (`client/src/app/api/[...path]/route.ts`) falls back to `localhost:5000` when it is unset, so every call fails.
- The value is baked into the build, not read at request time. Next.js replaces every `process.env.NEXT_PUBLIC_*` reference with its build-time value in the server route handlers as well as in the browser bundle, and the proxy route handlers also copy it into a module-level constant. Changing the variable in Netlify changes nothing on the running site.
- So: set it in Netlify → Site Settings → Environment Variables, then **Deploys → Trigger deploy** (a new build). Restarting, or clearing a cache without rebuilding, is not enough. The same applies to the `NEXT_PUBLIC_API_URL` repository secret the "Build and Deploy" workflow builds with.
- A Netlify rollback ("Publish deploy" on an older deploy, below) brings back the API URL that deploy was built with. If the API has moved since, roll forward instead.

### High 429 rate (rate limiting)
- Configurable via environment variables:
  - `RATE_LIMIT_ENABLED` (set to `false` to disable temporarily)
  - `RATE_LIMIT_MAX` (default: 100)
  - `RATE_LIMIT_WINDOW_MS` (default: 900000 = 15 min)

### CORS errors in browser console
- Verify `ALLOWED_ORIGINS` on the API host includes the Netlify URL
- Verify `CLIENT_URL` and `FRONTEND_URL` are set correctly

### Cookies not being set (login works but refresh fails)
- Auth routes (`/api/auth/*`) must go through Next.js API route handlers, NOT the middleware edge rewrite
- Check `client/src/proxy.ts` — auth paths should be excluded from rewrite
- Check `client/src/app/api/auth/*/route.ts` — these must forward `Set-Cookie` headers

### Deploy / shutdown issues
- Server supports graceful shutdown (SIGTERM/SIGINT) with readiness draining
- During shutdown, `/readyz` returns `503` to drain traffic
- Migrations run automatically on deploy via `start.ts` → `prisma migrate deploy`, and again from the "Build and Deploy" workflow; both are idempotent

---

## How anyone finds out

Read this before the escalation table, because it decides whether the table
means anything.

**There is no paging system, no metrics scraper and no dashboard, and no alert
rule is evaluated by anything.** `/metrics` is produced and token-gated
correctly and nothing reads it. The rules and the scrape job for it are written
and tested (`athena-platform/infrastructure/monitoring/`), and wait on a hosted
service only the owner can open. An earlier version of this runbook said "Page on-call" as if
a rota and a pager existed; they do not, and a response-time target measured
from an alert nobody receives is not a target. If the API falls over at 2am,
the answer is a GitHub issue within about fifteen minutes *if* the uptime
workflow below has been configured, and a member reporting it if it has not.

What does exist, and what to turn on before relying on any of the numbers
below:

| Signal | State | What it takes |
|---|---|---|
| Render health check on `/livez` | **Live** — Render restarts an instance that stops answering, and emails the service's notification address on failed deploys and health-check failures. | Set the notification email in Render → Settings → Notifications. With the uptime workflow below, this is all that tells a human unprompted. |
| Uptime workflow on `/readyz` (`.github/workflows/uptime.yml`) | **Present; runs once configured.** Every 15 minutes it asks `$API_URL/readyz` — the one that proves Neon is reachable; `/livez` only proves the process is up — and, if `PRODUCTION_SITE_URL` is set, the site's `/api/health`, which proves the web tier was built with the right `NEXT_PUBLIC_API_URL`. Three failures a minute apart open one issue titled "Production is down", which GitHub emails to the repository's watchers; the next passing run closes it. Until the variable is set every run shows as *skipped*. | Set the `PRODUCTION_API_URL` and `PRODUCTION_SITE_URL` repository **variables** (Settings → Secrets and variables → Actions → Variables) and make sure the people on call watch the repository. Know its limits: it is not a pager, GitHub runs schedules late under load, and a billing lock on Actions or sixty days without a commit stops it without a word. |
| External uptime service on `/readyz` | **Not configured.** | Still the recommendation, on top of the workflow: point Better Stack, Uptime Robot or Pingdom at `$API_URL/readyz` on a 1-minute interval with SMS or push alerts. A 503 there is a P0 and is invisible to Render's own check. |
| `scripts/send-incident-notification.js` | **Present, wired to nothing.** Posts to a webhook and/or emails via SendGrid. With neither `INCIDENT_WEBHOOK_URL` nor `INCIDENT_NOTIFY_EMAILS` set it now exits non-zero rather than reporting success for a notification it sent to nobody. | Set `INCIDENT_WEBHOOK_URL` (Slack/Teams incoming webhook) wherever it is invoked, and call it from the uptime service's webhook or from a deploy step. |
| GitHub issue on a failed production migration | **Live**, from `.github/workflows/build-and-deploy.yml`. | Nothing — but it is a GitHub notification, not a page, and it only covers migrations. |
| Sentry | **Reports errors once `SENTRY_DSN` is set in production.** The central error handler (`middleware/errorHandler.ts`) now sends every 5xx it answers, with the request id that matches the log line, and the process-level handlers send crashes. Not sent: refusals (4xx), the deliberate 503s that `/health/launch-readiness` already lists, any request body or query string, and any 5xx a handler writes itself with `res.status(...)` instead of passing the error to `next()`. Today that is the readiness probes, the maintenance gate and the metrics endpoint, on purpose — and the consent gate's 503 when its own lookup fails (`middleware/gdpr.middleware.ts`), which is logged at error level and does not reach Sentry. `initSentry()` still runs after the Express app is built, so Sentry's performance tracing does not attach — errors arrive, traces do not. | Set `SENTRY_DSN`, then turn on an alert rule in Sentry itself ("a new issue is created" → email) — without one Sentry records errors and tells nobody. |
| Prometheus alert rules (`athena-platform/infrastructure/monitoring/`) | **Written and tested in CI; evaluated by nothing.** Seven rules — API down, its scrape missing, more than 5% server errors, slow, event loop blocked, crash-looping, memory near the 2 GB limit — each over a metric the API emits, with a `page` or `ticket` severity. | Open a hosted metrics service that can page a phone (the owner's choice), then follow the README beside the rules: scrape `$API_URL/metrics` with `METRICS_TOKEN` as the bearer token under the job name `athena-api`, load `alerts.yml`, route `page` to a phone, and fire `AthenaApiDown` once on purpose to prove the path. |

## Escalation

The response times below are targets for a human who has *already* been told.
Nothing in the list above wakes anyone: the uptime workflow sends a GitHub
notification, which is read when someone next looks, not at 2am. Until a
hosted uptime service with SMS or push alerts exists, a 15-minute response to
a P0 is a target for business hours only.

| Severity | Response Time | Action |
|----------|--------------|--------|
| P0 — Site down | 15 min | Roll back if the last deploy is the suspect; otherwise work the failure modes above. Tell the other maintainers by hand — `node scripts/send-incident-notification.js --severity critical --message "..."` if a webhook is configured. |
| P1 — Auth broken | 30 min | Check `/health/auth-diag`, review the API host's logs |
| P2 — Feature broken | 4 hours | Investigate, hotfix if straightforward |
| P3 — Cosmetic/minor | Next business day | Triage and schedule |

### Rollback Procedures

**API host (backend):**
Redeploy the previous successful build from the host's dashboard. Migrations are additive, so an older build runs against the newer schema.

**Netlify (frontend):**
Netlify Dashboard → Deploys → Click previous deploy → Publish deploy

**Database migration rollback:**
```bash
# From athena-platform/server, with DIRECT_DATABASE_URL set to the Neon direct URL
npx prisma migrate resolve --rolled-back <MIGRATION_NAME>

# Data: see "Backups and restore" below before restoring anything
```

---

## Backups and restore

There are two layers, and until the second is set up only the first exists.
Stated plainly, because a runbook that implies more is how a restore fails on
the day it is needed.

**1. Neon's point-in-time history.** Always on. How far back it reaches depends
on the Neon plan and is set per project; read it in the Neon console (the
project's settings, under the restore or history-retention window) and write
the number here. Until someone has, treat it as unknown — the free plan's
window is measured in hours, not days. It lives inside Neon, so it is not a
copy of anything if the Neon account itself is lost, locked or deleted.

**2. The nightly off-platform copy.** `.github/workflows/backup.yml`, doing the
work in `athena-platform/server/scripts/db-backup.sh`. **Present; runs once
configured.** Every night at 02:40 Brisbane time it:

1. checks every setting below, and that the bucket's lifecycle rules delete
   each copy within the retention period the owner chose — a bucket that
   would keep copies longer is refused before anything is dumped;
2. dumps the `public` schema with `pg_dump` inside a held read-only snapshot,
   counting every table's rows inside that same snapshot;
3. restores the dump into a throwaway Postgres of the same major version on
   the runner (in memory, on loopback) and requires every table's count to
   match — **every copy is restore-tested, not a sample**;
4. encrypts it with [age](https://age-encryption.org) to the public keys of the
   people holding the private keys offline, removes the plaintext, and uploads
   `database/athena-<UTC time>.dump.age` to the bucket.

A copy whose restore drill fails is still uploaded, as
`athena-<time>.UNVERIFIED.dump.age`, and the run fails: a copy that might not
restore is better than none, but nobody should mistake it for a good one. Any
failed run opens one GitHub issue titled **"Database backup failed"** (watchers
are emailed); the next run that uploads a verified copy closes it.

Until the `production-backups` environment holds every setting below, **every
run fails and opens that issue**, naming what is missing. That is deliberate: a
skipped run would look like a working backup. And like every workflow here, it
does nothing while GitHub Actions is billing-locked on the account.

The Actions logs of this repository are public, so the script prints no row, no
row count and no table size — only table names, which are in the schema anyway,
and the size of the sealed file. Do not add `set -x`, an artifact upload or a
step that prints the environment to that workflow.

### Setting up the off-platform copy

Three decisions only the owner can make come first, because the settings
encode them:

- **Retention** — how many days a copy may exist (`BACKUP_RETENTION_DAYS`).
  Longer gives older restore points; it also means a member who asked to be
  erased is still in the copies for that long. Whatever is chosen goes in the
  privacy policy and in `docs/security/retention-and-deletion.md`.
- **Who holds the keys** — at least two people, each with a private key kept
  offline. With one holder, losing that one file makes every copy unreadable,
  and the run says so in a notice.
- **Where the bucket lives** — `ap-southeast-2` keeps the copies in Australia.
  Any other region is an overseas disclosure under APP 8 and has to be listed
  as one (step 7).

Then, once:

1. **Keys.** Each holder runs `age-keygen -o athena-backup-<name>.key` on a
   machine they trust, keeps that file offline (a password manager's file
   attachment, or printed and locked away — not in a shared drive, not in
   GitHub), and sends only the `Public key: age1…` line it prints.
2. **Bucket.** A new S3 bucket used for nothing else, in the chosen region:
   Block Public Access fully on, default encryption on. Versioning is optional;
   if it is on, noncurrent versions need their own expiry, and the check adds
   the two periods together. Give it a lifecycle rule for the `database/`
   prefix whose days (plus the noncurrent days, if versioned) are at most the
   retention decision. S3 counts from the midnight (UTC) after an upload and
   removes expired objects in the background, which can take a further day, so
   set the rule a day inside the decision. For example, for a 35-day decision on
   a versioned bucket (33 + 1, with a day in hand):

   ```bash
   aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
     "Rules": [{
       "ID": "athena-backup-retention",
       "Status": "Enabled",
       "Filter": { "Prefix": "database/" },
       "Expiration": { "Days": 33 },
       "NoncurrentVersionExpiration": { "NoncurrentDays": 1 },
       "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
     }]
   }'
   ```

3. **An AWS identity that can only add copies.** An IAM user whose only policy
   is this. It cannot read, list or delete anything, so a leaked key can
   neither take a copy away nor destroy one:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::BUCKET/database/*" },
       { "Effect": "Allow", "Action": ["s3:GetLifecycleConfiguration", "s3:GetBucketVersioning"], "Resource": "arn:aws:s3:::BUCKET" }
     ]
   }
   ```

4. **A read-only database role.** In the Neon SQL editor, as the role that owns
   the tables (the one the migrations run as, `neondb_owner` unless it was
   renamed):

   ```sql
   CREATE ROLE athena_backup WITH LOGIN PASSWORD '<long random password>';
   GRANT CONNECT ON DATABASE neondb TO athena_backup;
   GRANT USAGE ON SCHEMA public TO athena_backup;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO athena_backup;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO athena_backup;
   -- Tables later migrations create, so the backup does not start failing
   -- with "permission denied" the day a new model ships:
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO athena_backup;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO athena_backup;
   ```

   Its connection string is `BACKUP_DATABASE_URL`: the **direct** host, not the
   one with `-pooler` in it (the pooler cannot hold the snapshot the dump is
   taken in, and the check refuses it), with `sslmode=require`.
5. **The GitHub environment.** Settings → Environments → New environment,
   named `production-backups`. Under *Deployment branches*, allow `main` only,
   so a workflow edited on another branch cannot read these. Then add:

   | Name | Kind | Value |
   |---|---|---|
   | `BACKUP_DATABASE_URL` | secret | the direct URL of `athena_backup` (step 4) |
   | `BACKUP_AWS_ACCESS_KEY_ID` | secret | the IAM user's key (step 3) |
   | `BACKUP_AWS_SECRET_ACCESS_KEY` | secret | its secret |
   | `BACKUP_AWS_REGION` | variable | the bucket's region, e.g. `ap-southeast-2` |
   | `BACKUP_S3_BUCKET` | variable | the bucket's name alone, no `s3://` |
   | `BACKUP_AGE_RECIPIENTS` | variable | the `age1…` public keys from step 1, separated by spaces |
   | `BACKUP_RETENTION_DAYS` | variable | the retention decision, in days |

6. **Run it once by hand.** Actions → *Database backup* → *Run workflow*. The
   run's summary names the copy, whether the drill passed and how long the
   bucket keeps it. Then have each key holder do the decrypt step (2) of
   **From an off-platform copy**, under *Restoring* below, on that copy, and
   record the date here.
7. **Say where the copies are.** Set `BACKUP_AWS_REGIONS` on the API host to
   the bucket's region, so the published data-transfers disclosure
   (`GET /api/compliance/data-transfers`) lists it, and put the retention
   period in the privacy policy.

### What a nightly run proves, and what it does not

It proves that the copy restores into an empty Postgres of the same major
version, and that every table came back with exactly the rows the snapshot
held. It does not prove that anyone can still decrypt it — only the key holders
can, so have each of them decrypt the newest copy every quarter and whenever a
holder changes. It says nothing about Neon's own history either; the
branch-restore rehearsal below covers that.

### Restoring

**Prefer restoring beside production, never over it.** Restoring over it undoes
**every** write since the restore point, and on this platform that includes
blocks a member placed against someone, safety settings she changed and
erasures she asked for — a restore that quietly lifts a block or resurrects a
deleted account is a safety incident of its own. Whichever layer the rows come
from, before any of them go back into production:

- re-apply the blocks and safety-setting changes made after the restore point
  (the API logs, and `UserSafetySettings.updatedAt`, say which members changed
  anything);
- check every row against the accounts erased since — `AuditLog` rows with
  action `ACCOUNT_DELETE` after the restore point — and copy nothing back that
  belongs to one of them.

**From Neon's history.** In the Neon console, create a new branch from the
production branch at a past time, copy the damaged rows back from it, then
delete the branch.

**From an off-platform copy.** On the machine of a key holder:

```bash
# 1. Fetch the copy. The workflow's AWS user cannot read the bucket; use an
#    account that can.
aws s3 cp "s3://$BUCKET/database/athena-2026-10-01T1640Z.dump.age" .

# 2. Decrypt it. The result is a plaintext copy of every member's record.
age --decrypt -i athena-backup-<name>.key -o athena.dump athena-2026-10-01T1640Z.dump.age

# 3. Restore it into an empty database beside production — a new database in
#    the Neon project (Databases → New database), or a local Postgres of the
#    same major version. Never into the production database itself.
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_DIRECT_URL" athena.dump

# 4. Copy back what is needed (with the checks above), then remove the
#    plaintext and drop the restore database.
shred -u athena.dump
```

**Rehearsing the Neon layer.** A restore nobody has tried is a hope. The drill,
which touches nothing in production: create a branch at a time about a day ago;
point a local server at its URLs (`DATABASE_URL` and `DIRECT_DATABASE_URL`);
run `npx prisma migrate status` and `SELECT count(*) FROM "User"` (and the same
for `"Post"` and `"Message"` — Prisma's table names are the model names,
quoted) against it; compare with production; delete the branch. Record the date
and the result here, and repeat it after any change of Neon plan.

**Taking a copy before a risky change.** Run the *Database backup* workflow by
hand rather than dumping to a laptop: it produces the same sealed,
restore-tested copy. If Actions is unavailable, the encrypted `pg_dump` under
Useful Commands is the fallback — a plaintext copy of every member's record,
so it is encrypted as it is written and deleted once the change is done.

`S3_BACKUPS_BUCKET`, which used to sit in the API's env templates, was never
read by anything and is not part of this. The backup job's settings live in the
`production-backups` environment only; the API never holds them.

---

## Key Environment Variables

| Variable | Impact if Missing |
|----------|------------------|
| `JWT_SECRET` | Auth tokens use random fallback — won't persist across restarts |
| `DATABASE_URL` | Server starts but all DB queries fail (503 on `/readyz`) |
| `DIRECT_DATABASE_URL` | Derived from `DATABASE_URL` with a warning; migrations may hang if the derivation is wrong |
| `CLIENT_URL` | CORS blocks all frontend requests |
| `ALLOWED_ORIGINS` | CORS blocks requests from non-primary origins |
| `NEXT_PUBLIC_API_URL` (Netlify) | Every `/api` request on the site fails |
| `SENDGRID_API_KEY` | Emails logged to console instead of sent (non-blocking) |
| `STRIPE_SECRET_KEY` | Payment features disabled (non-blocking) |

---

## Useful Commands

```bash
# All from athena-platform/server with the Neon URLs exported

# Migration status against production
DATABASE_URL=$DIRECT_DATABASE_URL npx prisma migrate status

# Check DB connectivity
DATABASE_URL=$DIRECT_DATABASE_URL npx prisma db execute --stdin <<< "SELECT 1;"

# One-off copy before a risky change — plaintext member data, so encrypt it as
# it is written and delete it afterwards (see "Backups and restore" above)
pg_dump "$DIRECT_DATABASE_URL" | gpg --symmetric --cipher-algo AES256 -o backup_$(date +%Y%m%d).sql.gpg

# API host logs: use the host's dashboard or CLI; the process logs to stdout
```
