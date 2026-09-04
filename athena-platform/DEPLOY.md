# ATHENA Platform — Deployment Guide

## Architecture

```
┌──────────────────┐        ┌──────────────────────────┐        ┌────────────────┐
│   Netlify CDN    │──────> │  API host (Express)      │──────> │  Neon          │
│  (Next.js SSR)   │  /api  │  + Socket.IO + workers   │  SQL   │  (PostgreSQL)  │
│  Port: 443       │  proxy │  Port: PORT (5000)       │        │  pooled+direct │
└──────────────────┘        └──────────────────────────┘        └────────────────┘
athena-empress.netlify.app   https://api.your-domain.com         ep-xxxx.neon.tech
```

- **Frontend (Netlify):** Next.js 14 App Router at `https://athena-empress.netlify.app`
- **Backend (API host):** Express + Prisma + Socket.IO on any always-on Node 20 host at `https://api.your-domain.com`
- **Database (Neon):** PostgreSQL 16. Pooled endpoint for runtime, direct endpoint for migrations.
- **Cache/Queue:** Redis 7, optional. Any hosted Redis (Upstash, Redis Cloud) via `REDIS_URL`.

Railway is not part of this topology any more. The old Railway API service was
deleted and its URL no longer resolves to an application.

---

## 1. Neon — Database

Follow [NEON_SETUP.md](../NEON_SETUP.md). In short:

1. Create a project in `ap-southeast-2`.
2. Copy the **pooled** connection string into `DATABASE_URL` and the **direct**
   one into `DIRECT_DATABASE_URL`, both with `sslmode=require&channel_binding=require`.
3. Add the direct string to the GitHub secret `NEON_DIRECT_DATABASE_URL` so the
   "Build and Deploy" workflow can migrate on every push to `main`.
4. Apply the schema once by hand: `npm run db:migrate:deploy` from `server/`.

Never run `db:migrate` or `db:push` against this database; see
[docs/runbooks/SHARED-DATABASE-HAZARD.md](docs/runbooks/SHARED-DATABASE-HAZARD.md).

---

## 2. API host — Backend

### 2.1 Setup

1. Create a web service on your host from this GitHub repository.
2. Set the **root directory** to `athena-platform/server`.
3. Build: the `Dockerfile` (multi-stage: deps, builder, production), or
   `npm ci && npm run build` on a Node 20 image.
4. Start: `node dist/start.js`. It runs `prisma migrate deploy` first, then
   boots the server.
5. Health check: `GET /health`. Readiness (checks Neon): `GET /readyz`.
6. Expose it on HTTPS and note the URL. It is `https://api.your-domain.com`
   throughout this document.

### 2.2 Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | `postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `DIRECT_DATABASE_URL` | Neon direct connection string (migrations) | `postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `JWT_SECRET` | 32+ char secret for auth tokens | Generate: `openssl rand -hex 32` |
| `NODE_ENV` | Must be `production` | `production` |
| `CLIENT_URL` | Netlify frontend URL | `https://athena-empress.netlify.app` |
| `FRONTEND_URL` | Same as CLIENT_URL | `https://athena-empress.netlify.app` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://athena-empress.netlify.app` |
| `TRUST_PROXY` | Behind the host's load balancer | `true` |
| `APP_URL` / `API_URL` | This service's public URL | `https://api.your-domain.com` |

> **Full template:** `server/.env.production.template` lists every variable with a description.

### 2.3 Optional Environment Variables

| Variable | Service | Notes |
|---|---|---|
| `REDIS_URL` | Redis | Enables BullMQ workers and caching |
| `STRIPE_SECRET_KEY` | Stripe | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `whsec_...` |
| `OPENAI_API_KEY` | OpenAI | For AI features (career coach, resume optimizer) |
| `SENDGRID_API_KEY` | SendGrid | For transactional email |
| `SENDGRID_FROM_EMAIL` | SendGrid | e.g. `noreply@your-domain.com` |
| `AWS_ACCESS_KEY_ID` | AWS S3 | For file uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 | For file uploads |
| `AWS_REGION` | AWS S3 | e.g. `ap-southeast-2` |
| `S3_BUCKET` | AWS S3 | Upload bucket name |
| `SENTRY_DSN` | Sentry | Error tracking |
| `DV_ENCRYPTION_KEY` | DV-Safe | 64 hex chars: `openssl rand -hex 32` |
| `ENABLE_WORKERS` | BullMQ | Set `true` to enable background jobs (needs `REDIS_URL`) |
| `METRICS_TOKEN` | Prometheus | Protect `/metrics` endpoint |

### 2.4 Build & Deploy

A host connected to GitHub redeploys on every push to `main`. The pipeline:

1. **Build**: Dockerfile multi-stage, or `npm ci && npm run build`
2. **Start**: `node dist/start.js` (migrations run inside `start.ts` via `execSync`)
3. **Health check**: `GET /health`
4. **Restart policy**: on failure

### 2.5 Verify

```bash
curl https://api.your-domain.com/health
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

curl https://api.your-domain.com/readyz
# {"status":"ready","database":"connected"}
```

---

## 3. Netlify — Frontend

### 3.1 Setup

1. Connect your GitHub repo at [app.netlify.com](https://app.netlify.com)
2. Set **Base directory** to `athena-platform/client`
3. Build command, publish directory and plugins come from `netlify.toml`
4. `@netlify/plugin-nextjs` handles SSR, ISR, middleware, and route handlers

### 3.2 Required Environment Variables

Set in **Netlify Dashboard, Site Settings, Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.your-domain.com` |
| `NEXT_PUBLIC_APP_URL` | This site's URL, e.g. `https://athena-empress.netlify.app` |

> **Critical:** Without `NEXT_PUBLIC_API_URL` the in-app proxy falls back to
> `localhost:5000` and every `/api/*` and `/uploads/*` request fails. The
> route handlers under `client/src/app/api` and `client/src/app/uploads` read it
> at request time; Socket.IO connects to `NEXT_PUBLIC_SOCKET_URL`, falling back
> to the same value.

### 3.3 Optional Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | Realtime origin if it differs from the API URL |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend error tracking |
| `SENTRY_ORG` | Sentry org for source map uploads |
| `SENTRY_PROJECT` | Sentry project name |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | Enable AI features (`true` / `false`) |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Enable maintenance page (`true` / `false`) |

> **Full template:** `client/.env.netlify` lists every variable with a description.

### 3.4 Deploy

Netlify auto-deploys on every push to `main`. To redeploy without a commit:

**Netlify Dashboard, Deploys, Trigger Deploy, Deploy site**

---

## 4. Pre-Flight Checklist

### Neon (database)
- [ ] Project created in `ap-southeast-2`
- [ ] `NEON_DIRECT_DATABASE_URL` added to GitHub secrets
- [ ] `npx prisma migrate status` reports no pending migrations

### API host (backend)
- [ ] `DATABASE_URL` set to the Neon **pooled** URL
- [ ] `DIRECT_DATABASE_URL` set to the Neon **direct** URL
- [ ] `NODE_ENV=production` set
- [ ] `JWT_SECRET` set (32+ chars, generated with `openssl rand -hex 32`)
- [ ] `CLIENT_URL` / `FRONTEND_URL` / `ALLOWED_ORIGINS` set to the Netlify URL
- [ ] `TRUST_PROXY=true` set
- [ ] `APP_URL` set to the host's public URL
- [ ] Deploy succeeds and `/health` and `/readyz` return 200

### Netlify (frontend)
- [ ] `NEXT_PUBLIC_API_URL` set to the API host's public URL
- [ ] `NEXT_PUBLIC_APP_URL` set to this Netlify site's URL
- [ ] Deploy succeeds and site loads

### Integration
- [ ] Registration flow works (creates a user in Neon)
- [ ] Login flow works (JWT issued, dashboard loads)
- [ ] No CORS errors in browser console
- [ ] API proxy works (`/api/health` on the Netlify site returns the API's health response)

### Optional Services
- [ ] Stripe webhook: `https://api.your-domain.com/api/webhooks/stripe` (events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`)
- [ ] SendGrid sender verified
- [ ] S3 bucket created + IAM credentials set
- [ ] Sentry DSN set (both API host + Netlify)
- [ ] `DV_ENCRYPTION_KEY` set (64 hex chars) if DV-Safe features needed

---

## 5. Monitoring

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Basic health check | None |
| `GET /livez` | Liveness probe | None |
| `GET /readyz` | Readiness probe (checks Neon) | None |
| `GET /metrics` | Prometheus metrics | `METRICS_TOKEN` (Bearer or `X-Metrics-Token` header) |

Database metrics (connections, compute, storage) are in the Neon console under
**Monitoring**.

---

## 6. Database

### Migrations (automatic)
Migrations run twice per release, and both paths are idempotent:

1. The "Build and Deploy" workflow runs `prisma migrate deploy` through
   `NEON_DIRECT_DATABASE_URL` as soon as `main` is pushed.
2. `start.ts` runs it again through `DIRECT_DATABASE_URL` when the API boots,
   so a host that deploys before the workflow finishes still comes up on the
   right schema.

### Seed Data (manual, optional)
```bash
# From athena-platform/server, with the Neon URLs in the environment
npm run db:seed
```

### Backup
```bash
pg_dump "$DIRECT_DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

Neon also keeps point-in-time history per branch; restore from the console.

---

## 7. Rollback

### API host
Redeploy the previous successful build from the host's dashboard. Migrations
are additive, so an older build runs against the newer schema.

### Netlify
**Netlify Dashboard, Deploys, Click previous deploy, Publish deploy**

### Database
Restore the branch to a point in time from the Neon console, or
`psql "$DIRECT_DATABASE_URL" < backup.sql`.

---

## 8. Troubleshooting

| Issue | Solution |
|---|---|
| API returns 500/503 on Netlify | Set `NEXT_PUBLIC_API_URL` in Netlify env vars, then redeploy |
| CORS errors | Add the Netlify domain to `ALLOWED_ORIGINS` on the API host |
| DB connection fails | Check the Neon URLs carry `sslmode=require`; see the troubleshooting table in `NEON_SETUP.md` |
| Migrations hang on deploy | `DIRECT_DATABASE_URL` is the pooled URL; use the direct hostname |
| Redis errors (non-fatal) | Redis is optional. The app works without it (caching and workers disabled) |
| Socket.IO not connecting | Ensure `ALLOWED_ORIGINS` includes the Netlify domain |
| Health check fails | Read the host's logs. `start.ts` logs boot errors visibly |
| `JWT_SECRET` warning | Set `JWT_SECRET`. The random fallback won't persist across restarts |
