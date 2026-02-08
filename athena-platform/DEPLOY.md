# ATHENA Platform — Deployment Guide

## Architecture

- **Frontend (Netlify):** Next.js App Router → `https://athena-empress.netlify.app`
- **Backend (Railway):** Express + Prisma + PostgreSQL → `https://<your-railway-app>.up.railway.app`
- **Database:** PostgreSQL (Railway addon or external)
- **Cache:** Redis (Railway addon or external)

---

## 1. Railway — Backend API

### Setup

1. Create a new Railway project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** database service (or connect external)
3. Add a **Redis** service (or connect external)
4. Add a new service from your GitHub repo, set **Root Directory** to `server`

### Required Environment Variables

Set these in Railway → Service → Variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` (auto-set by Railway addon) |
| `REDIS_URL` | Redis connection string | `redis://...` (auto-set by Railway addon) |
| `JWT_SECRET` | 32+ char secret for auth tokens | `openssl rand -hex 32` |
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | Railway sets this automatically | `5000` |
| `CLIENT_URL` | Netlify frontend URL | `https://athena-empress.netlify.app` |
| `FRONTEND_URL` | Same as CLIENT_URL | `https://athena-empress.netlify.app` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://athena-empress.netlify.app` |
| `TRUST_PROXY` | Behind load balancer | `true` |

### Optional Environment Variables

| Variable | Service | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe | Starts with `sk_live_` or `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Starts with `whsec_` |
| `OPENAI_API_KEY` / `AI_OPENAI_API_KEY` | OpenAI | For AI features |
| `SENDGRID_API_KEY` | SendGrid | For transactional email |
| `SENDGRID_FROM_EMAIL` | SendGrid | e.g. `noreply@athena.com` |
| `AWS_ACCESS_KEY_ID` | AWS S3 | For file uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 | For file uploads |
| `AWS_REGION` | AWS S3 | e.g. `ap-southeast-2` |
| `S3_BUCKET` | AWS S3 | Upload bucket name |
| `SENTRY_DSN` | Sentry | Error tracking |
| `DV_ENCRYPTION_KEY` | DV-Safe | 64 hex char AES-256 key |
| `ENABLE_WORKERS` | BullMQ | Set `true` to enable background jobs |
| `METRICS_TOKEN` | Prometheus | Protect `/metrics` endpoint |

### Deploy

Railway auto-deploys from GitHub. The `railway.json` handles:
- **Build:** `npm install && npx prisma generate && npm run build`
- **Start:** `npx prisma migrate deploy && node dist/index.js`
- **Health check:** `/health`

### Verify

```
curl https://<your-railway-app>.up.railway.app/health
# Expected: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

---

## 2. Netlify — Frontend

### Already Live

Site: `https://athena-empress.netlify.app`

### Required Environment Variable

Set in **Netlify Dashboard → Site Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your Railway backend URL (e.g. `https://athena-api-production.up.railway.app`) |

> **This is critical.** Without this, all API calls return 503. The `netlify.toml` proxies `/api/*` and `/uploads/*` to this URL.

### Optional Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend error tracking |
| `SENTRY_ORG` | Sentry org for source map uploads |
| `SENTRY_PROJECT` | Sentry project name |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key |

### Redeploy

After setting env vars, trigger a redeploy:
**Netlify Dashboard → Deploys → Trigger Deploy → Deploy site**

---

## 3. Post-Deploy Checklist

- [ ] Railway health check passes (`/health` returns 200)
- [ ] `NEXT_PUBLIC_API_URL` set in Netlify pointing to Railway URL
- [ ] Netlify redeployed after setting env var
- [ ] Registration flow works (creates user in Railway DB)
- [ ] Login flow works (JWT issued, dashboard loads)
- [ ] CORS: no cross-origin errors in browser console
- [ ] Stripe webhook configured to `https://<railway>/api/webhooks/stripe`
- [ ] SendGrid sender verified for transactional email
- [ ] S3 bucket created and IAM credentials configured
- [ ] `DV_ENCRYPTION_KEY` set (64 hex chars) if DV-Safe features needed

---

## 4. Monitoring

- **Health:** `GET /health` — basic health
- **Readiness:** `GET /readyz` — checks DB connection
- **Liveness:** `GET /livez` — process alive
- **Metrics:** `GET /metrics` — Prometheus metrics (protected by `METRICS_TOKEN`)

---

## 5. Database

### Run Migrations (auto on deploy)
Migrations run automatically via `npx prisma migrate deploy` in the Railway start command.

### Seed Data (optional, manual)
```bash
# Connect to Railway shell
railway run npx ts-node prisma/seed.ts
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| API returns 503 on Netlify | Set `NEXT_PUBLIC_API_URL` in Netlify env vars |
| CORS errors | Add Netlify domain to `ALLOWED_ORIGINS` on Railway |
| DB connection fails | Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db` |
| Redis errors (non-fatal) | Redis is optional — app works without it (caching disabled) |
| Prisma migration fails | Check DB is accessible and `DATABASE_URL` is correct |
| Socket.IO not connecting | Ensure `ALLOWED_ORIGINS` includes the Netlify domain |
