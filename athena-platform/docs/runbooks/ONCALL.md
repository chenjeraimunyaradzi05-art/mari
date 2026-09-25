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
- `NEXT_PUBLIC_API_URL` is unset or stale on Netlify. Unset, the proxy talks to `localhost:5000` and every call fails.
- Set it in Netlify → Site Settings → Environment Variables and redeploy; the value is read at request time by the route handlers, not baked into the build.

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
the current answer is that a member reports it.

What does exist, and what to turn on before relying on any of the numbers
below:

| Signal | State | What it takes |
|---|---|---|
| Render health check on `/livez` | **Live** — Render restarts an instance that stops answering, and emails the service's notification address on failed deploys and health-check failures. | Set the notification email in Render → Settings → Notifications. This is the only thing today that tells a human unprompted. |
| External uptime check on `/readyz` | **Not configured.** `/readyz` is the one that proves Neon is reachable; `/livez` only proves the process is up. | Point any uptime service (Better Stack, Uptime Robot, Pingdom) at `$API_URL/readyz` on a 1-minute interval. A 503 there is a P0 and is invisible to Render's own check. |
| `scripts/send-incident-notification.js` | **Present, wired to nothing.** Posts to a webhook and/or emails via SendGrid. With neither `INCIDENT_WEBHOOK_URL` nor `INCIDENT_NOTIFY_EMAILS` set it now exits non-zero rather than reporting success for a notification it sent to nobody. | Set `INCIDENT_WEBHOOK_URL` (Slack/Teams incoming webhook) wherever it is invoked, and call it from the uptime service's webhook or from a deploy step. |
| GitHub issue on a failed production migration | **Live**, from `.github/workflows/build-and-deploy.yml`. | Nothing — but it is a GitHub notification, not a page, and it only covers migrations. |
| Sentry | Configured, and reporting almost nothing: `initSentry()` runs too late in `src/index.ts` for the Express instrumentation to attach and the central error handler never calls it, so only process-level crashes arrive. | Tracked separately; do not treat an empty Sentry as a quiet night. |
| Prometheus / Grafana / Alertmanager | **None in this repository.** | `$API_URL/metrics` with `X-Metrics-Token` is a standard Prometheus exposition; any hosted scraper can read it. Nothing consumes it today. |

## Escalation

The response times below are targets for a human who has *already* been told.
Until an external check on `/readyz` exists, treat detection as manual: nothing
in the list above will wake anyone for a P0 that is not a failed deploy.

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

# Data: restore the branch to a point in time from the Neon console
```

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

# Off-platform backup before a risky change
pg_dump "$DIRECT_DATABASE_URL" > backup_$(date +%Y%m%d).sql

# API host logs: use the host's dashboard or CLI; the process logs to stdout
```
