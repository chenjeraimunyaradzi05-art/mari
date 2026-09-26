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

**There is no paging system, no metrics scraper, no dashboard and no alert
rule in this repository.** `/metrics` is produced and token-gated correctly and
nothing reads it. An earlier version of this runbook said "Page on-call" as if
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
| Prometheus / Grafana / Alertmanager | **None in this repository.** | `$API_URL/metrics` with `X-Metrics-Token` is a standard Prometheus exposition; any hosted scraper can read it. Nothing consumes it today. |

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

What exists today, stated plainly, because a runbook that implies more is how
a restore fails on the day it is needed:

- **Neon's point-in-time history is the only backup.** There is no scheduled
  export, nothing held off Neon, and no restore has been rehearsed. How far
  back the history reaches depends on the Neon plan and is set per project;
  read it in the Neon console (the project's settings, under the restore or
  history-retention window) and write the number here. Until someone has, treat
  it as unknown — the free plan's window is measured in hours, not days.
  `docs/security/retention-and-deletion.md` writes "35 days" against backups
  with a note that the founder has to confirm it; that figure is an assumption
  until the console says so, and the privacy policy should not quote it before.
- `S3_BACKUPS_BUCKET` appears in the env templates and nothing reads it. It is
  not a backup.
- The `pg_dump` under Useful Commands is a manual, one-off copy that someone has
  to remember to take. It is a plaintext copy of every member's record — profiles,
  locations, safety settings, messages that are not in DV safe-chat — so it
  must not sit on a laptop or in a shared drive: encrypt it, and delete it once
  the risky change is done.

**Restoring.** Prefer restoring *beside* production rather than over it. In the
Neon console, create a new branch from the production branch at a past time,
copy the damaged rows back from it, then delete the branch. Restoring the
production branch itself in place undoes **every** write since that moment, and
on this platform that includes blocks a member placed against someone, safety
settings she changed and erasures she asked for — a restore that quietly lifts
a block or resurrects a deleted account is a safety incident of its own. If an
in-place restore is the only option, list the blocks, safety-setting changes and
erasure requests made after the restore point from the API logs first, and
re-apply them before reopening the site.

**Rehearsing it.** A restore nobody has tried is a hope. The drill, which touches
nothing in production: create a branch at a time about a day ago; point a local
server at its URLs (`DATABASE_URL` and `DIRECT_DATABASE_URL`); run
`npx prisma migrate status` and `SELECT count(*) FROM "User"` (and the same
for `"Post"` and `"Message"` — Prisma's table names are the model names,
quoted) against it; compare with production; delete the branch. Record the date and the
result here, and repeat it after any change of Neon plan.

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
