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

# Readiness (checks Neon, and in production Redis)
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
   - **JWT_SECRET not set:** In production the API refuses to start without it (and refuses a placeholder, a short value or a repeating one), so this shows as a failed deploy, not as 500s. Outside `development` and `test` there is no fallback either: a staging or preview deployment (any `NODE_ENV` other than those two) refuses to start without it as well, and signing a token throws. Never rotate it casually; it signs every member out
   - **DB unreachable:** Check `DATABASE_URL` on the host and the compute state in the Neon console
3. Read the API host's logs: `start.ts` prints boot errors and migration output visibly

### `/readyz` is 503
The answer is the same for every cause and does not say which (the route answers anyone); the API's log has the line, and `/health/detailed` (diagnostics token) names the dependency. Two things make it 503:
- Neon connectivity failure. Check:
  - Compute state in the Neon console (a suspended compute wakes on the first connection; a stuck one shows here)
  - `DATABASE_URL` on the host is the **pooled** URL with `sslmode=require`
  - Connection count in Neon → Monitoring (the direct URL used for traffic exhausts it fast)
- **In production, Redis does not answer a PING within a second** (log line `Readiness check failed: Redis does not answer`; `/health/detailed` shows `redis: down`). See "Redis is unreachable" below. The host's own health check is on `/livez` on purpose, so this never restarts a healthy API: it is the uptime workflow (and the on-call) that hears about it. A new instance opens Redis on its first probe (given a second to do it), so a deploy does not leave it 503 for long.

### `/api/*` fails on the Netlify site but the API answers directly
- `NEXT_PUBLIC_API_URL` was unset or stale **when the site was built**. The catch-all proxy (`client/src/app/api/[...path]/route.ts`) falls back to `localhost:5000` when it is unset, so every call fails.
- The value is baked into the build, not read at request time. Next.js replaces every `process.env.NEXT_PUBLIC_*` reference with its build-time value in the server route handlers as well as in the browser bundle, and the proxy route handlers also copy it into a module-level constant. Changing the variable in Netlify changes nothing on the running site.
- So: set it in Netlify → Site Settings → Environment Variables, then **Deploys → Trigger deploy** (a new build). Restarting, or clearing a cache without rebuilding, is not enough. The same applies to the `NEXT_PUBLIC_API_URL` repository secret the "Build and Deploy" workflow builds with.
- A Netlify rollback ("Publish deploy" on an older deploy, below) brings back the API URL that deploy was built with. If the API has moved since, roll forward instead.

### High 429 rate (rate limiting)
- The overall budget follows the caller (`middleware/apiBudget.ts`): a signed-in member has 1,500 calls per window under her own key, whatever address she is on; an address with no valid token has 100; staff have 5,000. If members are being refused, the budget is the thing to look at, and it is per member, so one noisy member does not use up anybody else's.
- Configurable via environment variables:
  - `RATE_LIMIT_MAX` (default: 100): the budget for an address with no valid token. Raising it raises the budget for strangers too, so it is a stopgap, not the fix for signed-in members.
  - `RATE_LIMIT_MEMBER_MAX` (default: 1500) and `RATE_LIMIT_STAFF_MAX` (default: 5000)
  - `RATE_LIMIT_WINDOW_MS` (default: 900000 = 15 min)
  - `RATE_LIMIT_ENABLED` only switches the limits off outside production. **Production ignores it**: setting it to `false` there changes nothing, on purpose.
- Sign-in and sign-up are 10 attempts per 15 minutes per address, on separate counters; password reset and resend-verification are 5 an hour; the session refresh is 30 a minute and sits outside the overall budget. These are in `src/index.ts` and `createCredentialLimiters`.
- A 429 carries `Retry-After` and `RateLimit-*` headers; `curl -i` any `/api` route to read the numbers a caller is being given.
- **Reads that add up to a copy of the membership have a budget of their own**, counted per account (per address for a visitor with no account) in ten minutes, in `middleware/rateLimiter.ts`: a member's profile page and her follower and following lists, 120 (`PROFILE_READ_MAX`); member search for a signed-in member, 200 (`MEMBER_SEARCH_MAX`); the mentor and job directories, 300 (`DIRECTORY_READ_MAX`). They sit under the overall budget above, which is far too loose to stop a crawl of one kind of page. A person opening profiles one after another does about twelve a minute at the very most.
- **The ticket `AthenaSustainedRateLimiting`** is more than one 429 every two seconds for a quarter of an hour. It is one of two things. A crawler: search the log for `A caller keeps running into a rate limit`, which is written once an hour for a caller refused more than 20 times and names the limiter (`profile-read`, `member-search`, `directory-read`, `search`, `upload`, `ai`) and the account id, or the address for a visitor; look the account up in the admin screen and suspend it if it is a script. Or a limit set tighter than ordinary use, which is refusing members: the line then names many different accounts, one or two times each, and the variable above for that limiter is the one to raise.
- **A visitor with no account sees a member's card, not her record.** `GET /api/users/:id` answers a signed-out caller with name, picture, headline and counts and `signInRequired: true`, and member search finds her by name and headline only. A signed-in member reads the whole of a public profile. `PUBLIC_PROFILE_DETAIL=full` on the API restores the old behaviour for everyone; it is the owner's decision to make, not an on-call fix. A signed-in member who is shown the card has an access token that did not resolve: the route answers 401 in that case so the app refreshes, and one who sees it anyway should be asked to sign out and in.
- If every member behind one office or campus is being refused, check the web host has `PROXY_SHARED_SECRET` (the same value as the API's): without it the API sees every visitor as the web host and the anonymous budget is shared by the whole site.

### Redis is unreachable (the limits are per instance)
Raised by the `AthenaRedisFallbackActive` alert, and shown in `/health/detailed` under ops as a standing condition named `redis_fallback.login_lockout`, `redis_fallback.rate_limit_counters` or `redis_fallback.rate_limit_sliding_window`, with the reason.
- **What it means:** the sign-in lockout and the rate limiters keep counting, in each API process, instead of letting requests through. Nothing is open. But with two instances every caller has two budgets, a restart hands out a fresh one, and the failure counts for a password-guessing run are not shared, so it is slowed and not stopped.
- **What to do:** check `athena-redis` on the host (render.yaml: the `redis` service) and that `REDIS_URL` on the API still points at it. The gauge returns to 0 and the condition clears on the first Redis call that works; nothing needs restarting.
- The API refuses to boot in production without `REDIS_URL` (which has to be a redis:// or rediss:// address), so this is Redis going away after boot, not a missing setting.
- **The scheduled sweeps stop while it is away, on purpose.** Nothing else can say whether this is the only instance, and the sweeps are not repeatable (an escrow-expiry warning about money, a wellness reminder, a scheduled post), so each is skipped, not run unlocked. `/health/detailed` lists them under ops as `redis.sweeps_skipped`, with their names; the API log says `Skipping a scheduled sweep` once per sweep per outage, not once a minute. The condition falls to zero the moment Redis answers again (the log says `Redis answers again: the scheduled sweeps that were skipped run at their next round`), and each sweep then runs at its next scheduled round: within a minute for most, within its own interval for a daily one. Reminders and expiry warnings are late by the length of the outage, not lost.
- **It does not need a restart.** The shared connection retries every three seconds at most for as long as it takes, and opens itself again if it ever ends (log: `Redis main: the connection has ended; opening it again in 30 seconds`). An instance that has been without Redis for an hour comes back on its own; `Redis main: still unreachable after 10 attempts` is logged once per outage, and `Redis main ready` when it is over. If it has not come back and Redis is up, restart the API and say so in the incident notes: that would be a defect in the reconnect, which `src/utils/__tests__/redis.reconnect.test.ts` is meant to prevent.
- `/health/detailed` asks the same connection the sweeps use, so `redis: up` there means the sweeps can run. (It used to ask a second connection that retried for ever and answered "up" while the sweeps were dead.)

### CORS errors in browser console
- Verify `ALLOWED_ORIGINS` on the API host includes the Netlify URL
- Verify `CLIENT_URL` and `FRONTEND_URL` are set correctly

### Cookies not being set (login works but refresh fails)
- Auth routes (`/api/auth/*`) must go through Next.js API route handlers, NOT the middleware edge rewrite
- Check `client/src/proxy.ts` — auth paths should be excluded from rewrite
- Check `client/src/app/api/auth/*/route.ts` — these must forward `Set-Cookie` headers

### Sign-up answers 503, or no verification email arrives
- The API will not start in production without `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`, so if it is running both are set. What a variable cannot prove is that SendGrid will send from that address
- SendGrid answers 403 for a sender whose domain is not authenticated (Settings > Sender Authentication). The API log then carries `Failed to send email` with `status: 403` and SendGrid's own reason in `detail` (for example "does not match a verified Sender Identity"), followed by `Required auth email was not accepted by the email provider`, and the member sees "Verification email could not be sent"
- After every deploy that changes either variable, register a throwaway address and confirm the verification email lands in the inbox, not spam. `GET /health/launch-readiness` reports the sender as configured, not as proven
- Note the half-finished account: registration creates the account before it sends, so a failed send leaves an unverified account that the member can finish from "resend verification" once mail works. The 503 carries `code: VERIFICATION_EMAIL_FAILED`, which is what makes the sign-up page show the resend form
- The API talks to SendGrid's HTTPS endpoint itself (there is no `@sendgrid/mail` package), tries up to three times, and repeats only a 429 or a 5xx or a timeout; a 400, 401 or 403 is refused at once and is the same next time. Every final outcome is counted: `athena_auth_email_total{kind,outcome}` in Prometheus (alert `AthenaAuthEmailFailing`, more than half failing across 15 minutes with at least three attempts) and `auth.email.*` under `/health/detailed`, which goes degraded while they fail
- A member who says she never got the email and the log shows `Email not sent: the address is on the suppression list`: SendGrid reported that address as bounced, invalid or spam-reported. Check the address for a typo first. If it is right, remove it from SendGrid's own suppression list (Suppressions) and then delete its row from `EmailSuppression`; neither list on its own is enough
- `/api/webhooks/sendgrid` answers 503 until `SENDGRID_WEBHOOK_PUBLIC_KEY` is set. `sendgrid_webhook.bad_signature` climbing under `/health/detailed` means the key no longer matches the one SendGrid signs with (it changes when the Event Webhook is re-created)

### Setting the ban-list key (`BANNED_IDENTITY_HASH_KEY`)
Banned people are stored as keyed hashes. With no dedicated key the hash key is derived from `JWT_SECRET`, so rotating `JWT_SECRET` would stop every existing ban matching and nothing would say so. The API logs a warning at boot while the key is unset.
1. Platform with no bans yet: set `BANNED_IDENTITY_HASH_KEY` to the output of `openssl rand -hex 32` and back it up with `DV_ENCRYPTION_KEY`.
2. Platform that already has bans: set it to the key the hashes were made with, so none of them stop matching. In the API host's shell, with the live `JWT_SECRET` in the environment, run `node -e "console.log(require('crypto').createHmac('sha256', process.env.JWT_SECRET).update('athena:banned-identity:v1').digest('hex'))"` and put that output in `BANNED_IDENTITY_HASH_KEY`. A different value is not safe: it orphans every ban already recorded.
3. After either, `JWT_SECRET` can be rotated without touching the ban list.

### Deploy / shutdown issues
- Server supports graceful shutdown (SIGTERM/SIGINT) with readiness draining
- During shutdown, `/readyz` returns `503` to drain traffic
- Migrations run automatically on deploy via `start.ts` → `prisma migrate deploy`, and again from the "Build and Deploy" workflow; both are idempotent

### A migration failed or is pending
`start.ts` runs `prisma migrate deploy` before it boots and boots anyway when it fails, so the API can still answer `/health` and the logs can be read. That means a failed migrate does not stop a deploy, and what shows it is `GET /health/launch-readiness` (needs `HEALTH_DIAGNOSTICS_TOKEN`): its `MIGRATIONS` check, required in production, reads `_prisma_migrations` and fails when a migration this build ships has not finished.
- **"N failed or stopped half way"**: the row has no finish time and no rollback. The API's boot log (`[ATHENA] Prisma migration failed`) has Prisma's error. Fix the cause, then mark it rolled back with the "Database migration rollback" command under "Rollback Procedures" below (`npx prisma migrate resolve --rolled-back <MIGRATION_NAME>`, `DIRECT_DATABASE_URL` set), then run `npx prisma migrate deploy`.
- **"N not applied yet"**: `migrate deploy` has not run against this database since the migration was added: it was skipped, or the host booted from an image older than the database. Run `npx prisma migrate deploy` with `DIRECT_DATABASE_URL` (the unpooled Neon host, not the `-pooler` one), or redeploy.
- **"could not be read"**: the migration table is missing or the database is unreachable. A database that was never migrated looks like this.
- Sign-in answering 500 with everything else green is the symptom this check exists for: a database missing the `Session.revokedAt` column (migration `20260211010000_add_session_revoked_updated`) breaks it.
- Migrations belonging to the other application that shares this database are ignored by the check. Only the ones in this repository's `prisma/migrations` are compared.

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
| Uptime workflow on `/readyz` (`.github/workflows/uptime.yml`) | **Present; runs once configured.** Every 15 minutes it asks `$API_URL/readyz` — the one that proves Neon is reachable; `/livez` only proves the process is up — and, if `PRODUCTION_SITE_URL` is set, the site's `/api/health`, which proves the web tier was built with the right `NEXT_PUBLIC_API_URL`. Three failures a minute apart open one issue titled "Production is down", which GitHub emails to the repository's watchers; the next passing run closes it. Until the variable is set every run shows as *skipped*. Once a day the same workflow also asks `$API_URL/health/launch-readiness` with the repository **secret** `HEALTH_DIAGNOSTICS_TOKEN` (the same value as the API's) and, when the answer is `not_ready`, opens one issue titled "Production configuration is incomplete" listing the required settings that are missing. It asks with `?probe=media`, which adds the `MEDIA_EXPOSURE` check: it proves from outside that a résumé cannot be read without signing in and an avatar can. Without the secret that job says so and passes. | Set the `PRODUCTION_API_URL` and `PRODUCTION_SITE_URL` repository **variables** (Settings → Secrets and variables → Actions → Variables) and make sure the people on call watch the repository. Know its limits: it is not a pager, GitHub runs schedules late under load, and a billing lock on Actions or sixty days without a commit stops it without a word. |
| External uptime service on `/readyz` | **Not configured.** | Still the recommendation, on top of the workflow: point Better Stack, Uptime Robot or Pingdom at `$API_URL/readyz` on a 1-minute interval with SMS or push alerts. A 503 there is a P0 and is invisible to Render's own check. |
| `scripts/send-incident-notification.js` | **Present, wired to nothing.** Posts to a webhook and/or emails via SendGrid. With neither `INCIDENT_WEBHOOK_URL` nor `INCIDENT_NOTIFY_EMAILS` set it now exits non-zero rather than reporting success for a notification it sent to nobody. | Set `INCIDENT_WEBHOOK_URL` (Slack/Teams incoming webhook) wherever it is invoked, and call it from the uptime service's webhook or from a deploy step. |
| GitHub issue on a failed production migration | **Live**, from `.github/workflows/build-and-deploy.yml`. | Nothing — but it is a GitHub notification, not a page, and it only covers migrations. |
| Sentry | **Reports errors once `SENTRY_DSN` is set in production.** The central error handler (`middleware/errorHandler.ts`) now sends every 5xx it answers, with the request id that matches the log line, and the process-level handlers send crashes. Not sent: refusals (4xx), the deliberate 503s that `/health/launch-readiness` already lists, any request body or query string, and any 5xx a handler writes itself with `res.status(...)` instead of passing the error to `next()`. Today that is the readiness probes, the maintenance gate and the metrics endpoint, on purpose — and the consent gate's 503 when its own lookup fails (`middleware/gdpr.middleware.ts`), which is logged at error level and does not reach Sentry. `start.ts` starts Sentry before `index.ts` loads (and `startServer` asks again once the secrets manager has been read), so tracing attaches to express and http. **The web host reports too**: page errors from `error.tsx` and `global-error.tsx`, and server-side request errors through `onRequestError` in `client/instrumentation.ts`, with cookies and bearer tokens stripped first (`client/src/lib/sentry-scrub.ts`). That needs `NEXT_PUBLIC_SENTRY_DSN` at build time; `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` on Netlify upload source maps, and the build warns when the DSN is set without them. The mobile app has no Sentry SDK: its JS crashes are posted to `POST /api/client-errors` and forwarded. | Set `SENTRY_DSN` on the API and the web variables on Netlify, then turn on an alert rule in each Sentry project ("a new issue is created" → email) — without one Sentry records errors and tells nobody. |
| Prometheus alert rules (`athena-platform/infrastructure/monitoring/`) | **Written and tested in CI; evaluated by nothing.** Ten rules — API down, its scrape missing, more than 5% server errors, slow, event loop blocked, crash-looping, memory near the 2 GB limit, sign-up and password-reset emails failing, the sign-in lockout and rate limits counting per instance because Redis is gone (`AthenaRedisFallbackActive`, a ticket), and requests refused with 429 at a sustained rate (`AthenaSustainedRateLimiting`, a ticket) — each over a metric the API emits, with a `page` or `ticket` severity. | Open a hosted metrics service that can page a phone (the owner's choice), then follow the README beside the rules: scrape `$API_URL/metrics` with `METRICS_TOKEN` as the bearer token under the job name `athena-api`, load `alerts.yml`, route `page` to a phone, and fire `AthenaApiDown` once on purpose to prove the path. |

## Logs: what is in them and how long they are kept

**What is in them.** In production the API writes one JSON object per line to stdout and nothing else (the log files under `athena-platform/server/logs/` are for development, and are capped at five 5 MB files each). The logger removes what must not be there whatever a caller passes it (`src/utils/logger.ts`, `src/utils/log-scrub.ts`):
- values under keys such as `password`, `token`, `authorization`, `email`, `phone`, `ip`, `content`, `query` and `body` are replaced by `[redacted]`, at any depth;
- in any text, including an error's message and stack: email addresses, bearer credentials, web tokens, long hex strings (how this API's one-time tokens look), secrets in a link's query string, provider keys and phone numbers are replaced, and the arguments a database error echoes back are dropped (the call and the reason are kept);
- a user agent is cut to 120 characters, and the request log names the route (`/api/wellness/share/:token`) and not the path, because some paths carry a credential;
- Sentry reports are cleaned by the same rules before they leave (`scrubEvent` in `src/utils/sentry.ts`; the web host's in `client/src/lib/sentry-scrub.ts`).

It works by shape, so it cannot see a name or a sentence somebody wrote. A line finds a row by its id (`userId`, `conversationId`, `referenceId`); nobody should log what a member said, searched for or typed. `src/utils/__tests__/logger.contract.test.ts` runs the real email sender, a refused sign-up email, a failed message write and a request with a token in its path with canary values, in the production format, and fails if any comes out. Add a case there when you add a log line near personal data.

**How long they are kept.** The API keeps no log of its own in production: the retention is whatever the host's plan keeps, or whatever the service the logs are streamed to keeps. The policy is 30 days (`docs/security/retention-and-deletion.md`). **Nobody has read the actual figure off the plan yet.** Read it, set it to the shortest period you can justify, and write it in that document: Render, Dashboard → the API service → Logs, and Settings → Log Streams if they are sent on (that destination has a retention of its own); Fly, `fly logs` is a short buffer and anything longer is a log shipper's retention.

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

**A report that is not an outage but cannot wait.** A critical report (an intimate image shared without consent, a threat to hurt someone, anything the Trust & Safety alert marks `[CRITICAL]`) has a target of **4 hours** for a person to open it, inside the 24 hours the reporter was promised. That is the safety team's, not the API's, and it has its own runbook: `TRUST-AND-SAFETY.md`, which also says who is on call for it. The same caveat applies: nothing wakes anyone yet, so the target holds only while `TRUST_SAFETY_EMAIL` is read.

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
from, work these in order before any row goes back into production or the
restored copy serves anyone:

1. **Keep production as it stands.** Before anything is overwritten, take a Neon
   branch of production as it is now (Branches → New branch → from production,
   at the current time) and name it for the incident. It is the only place the
   blocks, safety settings, bans and erasures made since the restore point still
   exist. `AuditLog` and `SafetyIncident` live in the same database, so after a
   restore over production the rows that said what was lost are gone with it.
   If production itself has to be restored in place, confirm in the Neon console
   that the restore leaves a backup branch of the state it replaced (the
   console's restore dialog says whether it does; do not assume), and do not go
   on until you have seen that branch.
2. **Compare.** Run the safety diff with that branch as `--live` and the
   restored copy as `--restored`. It reads both databases and writes to
   neither:

   ```bash
   cd athena-platform/server
   npm run restore:safety-diff -- \
     --live "$LIVE_BRANCH_DIRECT_URL" --restored "$RESTORE_DIRECT_URL" \
     --since 2026-10-01T04:30:00Z --emit-sql safety-patch.sql
   ```

   `--since` is the restore point. The report names members by id and nothing
   else (no names, addresses, numbers or ban hashes). The script is
   `restore-safety-diff.ts` beside the other scripts under `server/src/scripts`,
   and the comparison it makes is in the file of the same name under `server/src/utils`.
3. **Read the report.** It covers `UserSafetySettings` (blocks, muted words,
   visibility, who may message her, read receipts, online status, last seen,
   safety alerts), `DvSafetyProfile` (Safe Mode, hide-from-search, notification
   privacy, safe exit, panic button, emergency contacts, and its own block
   list), the three places a Safe Mode switch is mirrored (`Profile.isSafeMode`,
   `Profile.hideFromSearch`, `User.allowMessages`), `BannedIdentity`, accounts
   staff suspended or banned, and the `AuditLog` rows for `MODERATION_BAN`,
   `MODERATION_SUSPEND`, `MODERATION_REMOVE` and `ACCOUNT_DELETE` since the
   restore point. Each finding is one of:
   - **put back**: protection live has and the restored copy lacks, which the
     patch re-applies (a block, a switch turned to the safer side, a ban, a
     suspension, a panic contact);
   - **removed since**: a block, switch, contact or suspension the member or
     staff removed after the restore point. These are listed and **never**
     re-applied by the patch, because a restore that puts back a block she took
     off is its own harm. Unblocks are not logged anywhere, so this list is the
     only place they show up. Ask her, through support, before leaving any of
     them in place;
   - **erased since**: accounts erased after the restore point. Nothing of
     theirs is carried over. Run the erasure again for each id on the copy that
     will serve members, before it serves anyone, so a woman who asked to be
     erased is not resurrected. The route is `DELETE /api/admin/users/<id>?hard=true`,
     which runs the same erasure her own request runs and refuses under a legal
     hold;
   - **joined after**: accounts that did not exist at the restore point, which
     cannot be put back from this copy;
   - **decisions**: staff decisions since. A suspension or ban on an account is
     put back above; a content removal is not something the tool can redo, so
     run each removal again from its report using the audit row named.
4. **Read the patch, then run it** against the database that will serve
   members: the restored copy before it is promoted, or production after rows
   were copied back. It is idempotent (run it twice and the second run changes
   nothing) and it only adds protection: no `DELETE`, no `DROP`, nothing that
   clears a column. It holds ban hashes and emergency-contact details, so keep
   the file as private as the dump and `shred -u` it afterwards. The file opens
   its own transaction and commits at the end; `ON_ERROR_STOP` makes the first
   statement that fails stop the run, so nothing is half applied:

   ```bash
   psql "$TARGET_DIRECT_URL" -v ON_ERROR_STOP=1 -f safety-patch.sql
   ```
5. **What the tool does not cover.** Safe chats (`DvSafeChat`) and the panic
   alert history, reports filed since the restore point, and anything outside the
   safety tables. Copy those with the rest of the damaged rows, leaving out the
   members listed as erased. Blocks carry no per-block date, so the comparison
   is the set difference between the two copies, and it only works while the
   live branch from step 1 is intact: do not delete it until the report is
   settled and the patch has run.

**From Neon's history.** In the Neon console, create a new branch from the
production branch at a past time, work steps 1 to 5 above with that branch as
`--restored`, copy the damaged rows back from it, then delete both branches.

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

# 4. Run the safety diff and the patch (steps 1 to 5 above), copy back what is
#    needed, then remove the plaintext and drop the restore database.
shred -u athena.dump
```

**Rehearsing the Neon layer.** A restore nobody has tried is a hope. The drill,
which touches nothing in production: create a branch at a time about a day ago;
point a local server at its URLs (`DATABASE_URL` and `DIRECT_DATABASE_URL`);
run `npx prisma migrate status` and `SELECT count(*) FROM "User"` (and the same
for `"Post"` and `"Message"` — Prisma's table names are the model names,
quoted) against it; compare with production; then run the safety diff with
production as `--live` and the branch as `--restored` (it reads and writes
nothing). Row counts alone pass on a copy that has lost every block placed since
it was taken, so the drill is only done when the diff has run end to end and its
"put back" list matches what you would expect from a day of activity: members
who changed a safety setting in that time. Delete the branch. Record the date
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
| `JWT_SECRET` | The API refuses to start in production (no fallback of any kind; a placeholder or short value is refused too) |
| `DV_ENCRYPTION_KEY` | The API refuses to start in production. Safe chats, health records, members' safety plans and two-factor seeds are sealed under it, so losing it makes them unreadable: keep a backup. Changing it is a rotation with its own steps (a `_PREVIOUS` key, then `npm run rotate:encryption-keys`), not an edit: see `athena-platform/docs/runbooks/ENCRYPTION.md`. If a member's plan cannot be opened her page says so and shows nothing for that part; it is never shown as ciphertext |
| `BANNED_IDENTITY_HASH_KEY` | Starts, with a warning. The ban list is then keyed from `JWT_SECRET`, so rotating `JWT_SECRET` would silently unban everyone. See "Setting the ban-list key" above |
| `DATABASE_URL` | Server starts but all DB queries fail (503 on `/readyz`) |
| `DIRECT_DATABASE_URL` | Derived from `DATABASE_URL` with a warning; migrations may hang if the derivation is wrong |
| `CLIENT_URL` | CORS blocks all frontend requests |
| `ALLOWED_ORIGINS` | CORS blocks requests from non-primary origins |
| `NEXT_PUBLIC_API_URL` (Netlify) | Every `/api` request on the site fails |
| `SENDGRID_API_KEY` | The API refuses to start in production. No verification or password-reset email can be sent, so nobody can finish signing up |
| `SENDGRID_FROM_EMAIL` | The API refuses to start in production. There is no default sender; `athena.com` and `example.com` are refused |
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
