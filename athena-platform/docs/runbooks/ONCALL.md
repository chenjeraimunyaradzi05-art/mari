# On-Call Runbook

**Backend:** `https://mari-production-5c60.up.railway.app`  
**Frontend:** `https://athena-empress.netlify.app`  
**Hosting:** Railway (API + DB) / Netlify (web client)

---

## Quick Health Checks

```bash
# Basic health
curl https://mari-production-5c60.up.railway.app/health

# Readiness (checks DB)
curl https://mari-production-5c60.up.railway.app/readyz

# Auth flow diagnostics (12 checks)
curl https://mari-production-5c60.up.railway.app/health/auth-diag

# Metrics (requires token)
curl -H "X-Metrics-Token: $METRICS_TOKEN" https://mari-production-5c60.up.railway.app/metrics
```

**Correlation:** Every request includes `X-Request-Id`. Error responses include `requestId` to correlate with server logs.

---

## Common Failure Modes

### Auth routes returning 500
1. Run `/health/auth-diag` — it tests all 12 auth dependencies
2. Common causes:
   - **Missing DB columns:** Schema/migration mismatch (check Prisma migration status)
   - **JWT_SECRET not set:** Server falls back to random secret that won't persist across restarts
   - **DB unreachable:** Check `DATABASE_URL` and Railway PostgreSQL status
3. Check Railway logs: **Railway Dashboard → Service → Logs**

### `/readyz` is 503
- DB connectivity failure. Check:
  - Railway PostgreSQL add-on status
  - `DATABASE_URL` environment variable
  - Connection pool exhaustion (check active connections)

### High 429 rate (rate limiting)
- Configurable via environment variables:
  - `RATE_LIMIT_ENABLED` (set to `false` to disable temporarily)
  - `RATE_LIMIT_MAX` (default: 100)
  - `RATE_LIMIT_WINDOW_MS` (default: 900000 = 15 min)

### CORS errors in browser console
- Verify `ALLOWED_ORIGINS` on Railway includes the Netlify URL
- Verify `CLIENT_URL` and `FRONTEND_URL` are set correctly

### Cookies not being set (login works but refresh fails)
- Auth routes (`/api/auth/*`) must go through Next.js API route handlers, NOT the middleware edge rewrite
- Check `client/src/middleware.ts` — auth paths should be excluded from rewrite
- Check `client/src/app/api/auth/*/route.ts` — these must forward `Set-Cookie` headers

### Deploy / shutdown issues
- Server supports graceful shutdown (SIGTERM/SIGINT) with readiness draining
- During shutdown, `/readyz` returns `503` to drain traffic
- Migrations run automatically on deploy via `start.ts` → `prisma migrate deploy`

---

## Escalation

| Severity | Response Time | Action |
|----------|--------------|--------|
| P0 — Site down | 15 min | Page on-call, rollback if needed |
| P1 — Auth broken | 30 min | Check `/health/auth-diag`, review Railway logs |
| P2 — Feature broken | 4 hours | Investigate, hotfix if straightforward |
| P3 — Cosmetic/minor | Next business day | Triage and schedule |

### Rollback Procedures

**Railway (backend):**
Railway Dashboard → Deployments → Click previous successful deploy → Redeploy

**Netlify (frontend):**
Netlify Dashboard → Deploys → Click previous deploy → Publish deploy

**Database migration rollback:**
```bash
# Via Railway CLI
railway run npx prisma migrate resolve --rolled-back <MIGRATION_NAME>
```

---

## Key Environment Variables

| Variable | Impact if Missing |
|----------|------------------|
| `JWT_SECRET` | Auth tokens use random fallback — won't persist across restarts |
| `DATABASE_URL` | Server starts but all DB queries fail (503 on `/readyz`) |
| `CLIENT_URL` | CORS blocks all frontend requests |
| `ALLOWED_ORIGINS` | CORS blocks requests from non-primary origins |
| `SENDGRID_API_KEY` | Emails logged to console instead of sent (non-blocking) |
| `STRIPE_SECRET_KEY` | Payment features disabled (non-blocking) |

---

## Useful Commands

```bash
# Check Railway service logs
railway logs --service athena-api

# Run Prisma migration status
railway run npx prisma migrate status

# Open Railway shell
railway shell

# Check DB connectivity
railway run npx prisma db execute --stdin <<< "SELECT 1;"
```
