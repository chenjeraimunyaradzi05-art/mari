# ATHENA Platform — Deployment Guide

## Architecture

```
┌──────────────────┐       ┌──────────────────────────────┐
│   Netlify CDN    │──────▶│  Railway (Express API)       │
│  (Next.js SSR)   │ /api  │  + PostgreSQL  + Redis       │
│  Port: 443       │ proxy │  Port: dynamic (Railway)     │
└──────────────────┘       └──────────────────────────────┘
athena-empress.netlify.app  mari-production-5c60.up.railway.app
```

- **Frontend (Netlify):** Next.js 14 App Router → `https://athena-empress.netlify.app`
- **Backend (Railway):** Express + Prisma + Socket.IO → `https://mari-production-5c60.up.railway.app`
- **Database:** PostgreSQL 16 (Railway add-on)
- **Cache/Queue:** Redis 7 (Railway add-on)

---

## 1. Railway — Backend API

### 1.1 Setup

1. Create a new Railway project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** database service (auto-provides `DATABASE_URL`)
3. Add a **Redis** service (auto-provides `REDIS_URL`)
4. Add a new service from your GitHub repo
5. Set **Root Directory** to `athena-platform/server`
6. Railway will auto-detect `railway.json` and `nixpacks.toml`

### 1.2 Required Environment Variables

Set these in **Railway → Service → Variables:**

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | *auto-set by Railway add-on* |
| `REDIS_URL` | Redis connection string | *auto-set by Railway add-on* |
| `JWT_SECRET` | 32+ char secret for auth tokens | Generate: `openssl rand -hex 32` |
| `NODE_ENV` | Must be `production` | `production` |
| `CLIENT_URL` | Netlify frontend URL | `https://athena-empress.netlify.app` |
| `FRONTEND_URL` | Same as CLIENT_URL | `https://athena-empress.netlify.app` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://athena-empress.netlify.app` |
| `TRUST_PROXY` | Behind Railway load balancer | `true` |
| `APP_URL` | This service's public URL | `https://mari-production-5c60.up.railway.app` |

> **Full template:** See `server/.env.railway` for all variables with descriptions.

### 1.3 Optional Environment Variables

| Variable | Service | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `whsec_...` |
| `OPENAI_API_KEY` | OpenAI | For AI features (career coach, resume optimizer) |
| `SENDGRID_API_KEY` | SendGrid | For transactional email |
| `SENDGRID_FROM_EMAIL` | SendGrid | e.g. `noreply@athena.com` |
| `AWS_ACCESS_KEY_ID` | AWS S3 | For file uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 | For file uploads |
| `AWS_REGION` | AWS S3 | e.g. `ap-southeast-2` |
| `S3_BUCKET` | AWS S3 | Upload bucket name |
| `SENTRY_DSN` | Sentry | Error tracking |
| `DV_ENCRYPTION_KEY` | DV-Safe | 64 hex chars: `openssl rand -hex 32` |
| `ENABLE_WORKERS` | BullMQ | Set `true` to enable background jobs |
| `METRICS_TOKEN` | Prometheus | Protect `/metrics` endpoint |

### 1.4 Build & Deploy

Railway auto-deploys from GitHub on every push to `main`. The pipeline:

1. **Build**: Dockerfile multi-stage (deps → builder → production)
2. **Start**: `node dist/start.js` (migrations run inside `start.ts` via `execSync`)
3. **Health check**: `GET /health` (300s timeout)
4. **Restart policy**: on failure, up to 10 retries

### 1.5 Verify

```bash
curl https://mari-production-5c60.up.railway.app/health
# ✅ {"status":"healthy","timestamp":"...","version":"1.0.0"}

curl https://mari-production-5c60.up.railway.app/readyz
# ✅ {"status":"ready","database":"connected"}
```

---

## 2. Netlify — Frontend

### 2.1 Setup

1. Connect your GitHub repo at [app.netlify.com](https://app.netlify.com)
2. Set **Base directory** to `athena-platform/client`
3. Build command and plugins are auto-detected from `netlify.toml`
4. The `@netlify/plugin-nextjs` handles SSR, ISR, middleware, and API routes

### 2.2 Required Environment Variables

Set in **Netlify Dashboard → Site Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://mari-production-5c60.up.railway.app` |
| `NEXT_PUBLIC_APP_URL` | This site's URL, e.g. `https://athena-empress.netlify.app` |

> **⚠️ Critical:** Without `NEXT_PUBLIC_API_URL`, all API calls return 503. The `netlify.toml` proxies `/api/*`, `/uploads/*`, and `/socket.io/*` to this URL.

### 2.3 Optional Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend error tracking |
| `SENTRY_ORG` | Sentry org for source map uploads |
| `SENTRY_PROJECT` | Sentry project name |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | Enable AI features (`true` / `false`) |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Enable maintenance page (`true` / `false`) |

> **Full template:** See `client/.env.netlify` for all variables with descriptions.

### 2.4 Deploy

After setting env vars, trigger a deploy:

**Netlify Dashboard → Deploys → Trigger Deploy → Deploy site**

Netlify auto-deploys on every push to `main`.

---

## 3. Pre-Flight Checklist

### Railway (Backend)
- [ ] PostgreSQL add-on attached (`DATABASE_URL` auto-set)
- [ ] Redis add-on attached (`REDIS_URL` auto-set)
- [ ] `NODE_ENV=production` set
- [ ] `JWT_SECRET` set (32+ chars, generated with `openssl rand -hex 32`)
- [ ] `CLIENT_URL` / `FRONTEND_URL` / `ALLOWED_ORIGINS` set to Netlify URL
- [ ] `TRUST_PROXY=true` set
- [ ] `APP_URL` set to `https://mari-production-5c60.up.railway.app`
- [ ] Deploy succeeds and `/health` returns 200

### Netlify (Frontend)
- [ ] `NEXT_PUBLIC_API_URL` set to `https://mari-production-5c60.up.railway.app`
- [ ] `NEXT_PUBLIC_APP_URL` set to this Netlify site's URL
- [ ] Deploy succeeds and site loads

### Integration
- [ ] Registration flow works (creates user in Railway DB)
- [ ] Login flow works (JWT issued, dashboard loads)
- [ ] No CORS errors in browser console
- [ ] API proxy works (`/api/health` returns Railway health response)

### Optional Services
- [ ] Stripe webhook: `https://mari-production-5c60.up.railway.app/api/webhooks/stripe` (events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`)
- [ ] SendGrid sender verified
- [ ] S3 bucket created + IAM credentials set
- [ ] Sentry DSN set (both Railway + Netlify)
- [ ] `DV_ENCRYPTION_KEY` set (64 hex chars) if DV-Safe features needed

---

## 4. Monitoring

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Basic health check | None |
| `GET /livez` | Kubernetes/Railway liveness probe | None |
| `GET /readyz` | Readiness probe (checks DB) | None |
| `GET /metrics` | Prometheus metrics | `METRICS_TOKEN` (Bearer or `X-Metrics-Token` header) |

---

## 5. Database

### Migrations (automatic)
Migrations run automatically on every deploy via `execSync` inside `start.ts` before the server boots.

### Seed Data (manual, optional)
```bash
# Via Railway CLI
railway run npx ts-node prisma/seed.ts

# Or via Railway shell
railway shell
npx ts-node prisma/seed.ts
```

### Backup
```bash
# Via Railway CLI
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## 6. Rollback

### Railway
Railway keeps previous deployments. To rollback:
**Railway Dashboard → Deployments → Click previous successful deploy → Redeploy**

### Netlify
**Netlify Dashboard → Deploys → Click previous deploy → Publish deploy**

---

## 7. Troubleshooting

| Issue | Solution |
|---|---|
| API returns 503 on Netlify | Set `NEXT_PUBLIC_API_URL` in Netlify env vars, then redeploy |
| CORS errors | Add Netlify domain to `ALLOWED_ORIGINS` on Railway |
| DB connection fails | Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db` |
| Redis errors (non-fatal) | Redis is optional — app works without it (caching disabled) |
| Prisma migration fails | Check DB is accessible and `DATABASE_URL` is correct |
| Socket.IO not connecting | Ensure `ALLOWED_ORIGINS` includes Netlify domain |
| Health check fails | Check Railway logs — `start.ts` logs boot errors visibly |
| Build timeout | Increase build timeout in Railway settings (default 15min) |
| `JWT_SECRET` warning | Set `JWT_SECRET` — random fallback won't persist across restarts |
