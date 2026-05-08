# ATHENA Platform — Deployment Guide

This is the canonical deployment guide for the ATHENA Platform. The current
production stack is:

- **Frontend:** [Netlify](https://www.netlify.com) (Next.js 14 via `@netlify/plugin-nextjs`)
- **Database:** [Neon](https://neon.tech) Serverless Postgres
  (provisionable directly from the Netlify Neon integration)
- **Backend API:** the Express server in `athena-platform/server/` ships with a
  multi-stage `Dockerfile` and runs on any Node 20 container host (Render,
  Fly.io, AWS App Runner, your own VM, etc.)
- **Realtime:** Socket.IO is hosted alongside the backend API
- **Cache / queues:** Redis (managed: Upstash, Redis Cloud) — optional
- **Object storage:** S3-compatible bucket — optional, only needed for uploads

```text
┌──────────────────────────┐       ┌────────────────────────────────────┐
│ Netlify CDN + Functions  │──────▶│  Backend API (Express + Socket.IO) │
│ Next.js 14 SSR / ISR     │ /api  │  + optional Redis + optional S3    │
│ athena-empress.netlify.  │ proxy │  Container host (Render/Fly.io/…)  │
│ app                      │       └────────────────┬───────────────────┘
└──────────────────────────┘                        │
                                                    ▼
                                       ┌──────────────────────────┐
                                       │  Neon Serverless Postgres │
                                       │  (pooled + direct URLs)   │
                                       └──────────────────────────┘
```

> Socket.IO and `/uploads/*` are served by the backend host — Netlify does
> not proxy them. The client uses `NEXT_PUBLIC_SOCKET_URL` (defaults to
> `NEXT_PUBLIC_API_URL`).

---

## 1. Database — Neon

1. Create a project at [console.neon.tech](https://console.neon.tech) (or
   provision Neon from your Netlify site's **Integrations** tab).
2. Copy both connection strings from the Neon dashboard:
   - **Pooled** (hostname includes `-pooler`) — used at runtime
   - **Direct** (no pooler) — used by Prisma migrations
3. Set the env vars on the backend host:

   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15"
   DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15"
   ```

4. Migrations run automatically on every deploy from `start.ts` (`prisma migrate deploy`).

> If you used the Netlify Neon integration, a `NETLIFY_DATABASE_URL` is also
> exposed to the frontend; you do **not** need to forward it to the backend —
> the backend always reads `DATABASE_URL`/`DIRECT_DATABASE_URL` from its own
> host's environment.

---

## 2. Backend API — Container host

The `athena-platform/server/Dockerfile` is the source of truth. Any host that
can build a Dockerfile and inject env vars will work. Two concrete examples:

### 2.1 Render (Docker Web Service)

1. Create a new **Web Service** at [dashboard.render.com](https://dashboard.render.com).
2. Connect the repo, select **Docker** as the runtime.
3. Set **Root Directory** to `athena-platform/server`.
4. Health check path: `/health`.
5. Add the env vars listed in §2.3 below.

### 2.2 Fly.io (`fly launch` from `athena-platform/server`)

```bash
cd athena-platform/server
flyctl launch --copy-config --no-deploy   # generates fly.toml
flyctl secrets set DATABASE_URL='...' DIRECT_DATABASE_URL='...' \
                   JWT_SECRET='...' CLIENT_URL='...' ALLOWED_ORIGINS='...'
flyctl deploy
```

### 2.3 Required env vars

Full template: [`server/.env.production.example`](./server/.env.production.example)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | see §1 |
| `DIRECT_DATABASE_URL` | Neon direct URL (Prisma migrations) | see §1 |
| `JWT_SECRET` | 32+ char random secret | `openssl rand -hex 32` |
| `NODE_ENV` | `production` | `production` |
| `CLIENT_URL` | Netlify frontend URL | `https://athena-empress.netlify.app` |
| `FRONTEND_URL` | Same as `CLIENT_URL` | `https://athena-empress.netlify.app` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `https://athena-empress.netlify.app` |
| `TRUST_PROXY` | Behind a load balancer | `true` |
| `APP_URL` | This service's public URL | `https://api.your-domain.com` |

### 2.4 Optional env vars

| Variable | Service | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `whsec_...` |
| `OPENAI_API_KEY` | OpenAI | AI features (career coach, resume optimizer) |
| `SENDGRID_API_KEY` | SendGrid | Transactional email |
| `SENDGRID_FROM_EMAIL` | SendGrid | e.g. `noreply@athena.com` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS S3 | File uploads |
| `AWS_REGION` / `S3_BUCKET` | AWS S3 | File uploads |
| `REDIS_URL` | Upstash / Redis Cloud | Caching / sessions / queues |
| `SENTRY_DSN` | Sentry | Backend error tracking |
| `DV_ENCRYPTION_KEY` | DV-Safe | 64 hex chars: `openssl rand -hex 32` |
| `ENABLE_WORKERS` | BullMQ | Set `true` to enable background jobs |
| `METRICS_TOKEN` | Prometheus | Protect `/metrics` endpoint |
| `GOOGLE_CLIENT_ID` | Google Sign-In | Web OAuth client ID (must match `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) |
| `FACEBOOK_APP_ID` | Facebook Sign-In | App ID (must match `NEXT_PUBLIC_FACEBOOK_APP_ID`) |
| `FACEBOOK_APP_SECRET` | Facebook Sign-In | App secret — server builds the app access token and validates tokens via `debug_token` |

### 2.5 Verify

```bash
curl https://api.your-domain.com/health
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

curl https://api.your-domain.com/readyz
# {"status":"ready","database":"connected"}

curl https://api.your-domain.com/health/auth-diag
# 12-point auth dependency check
```

---

## 3. Frontend — Netlify

### 3.1 Setup

1. At [app.netlify.com](https://app.netlify.com) connect the GitHub repo.
2. Set **Base directory** to `athena-platform/client`.
3. Build command and plugins are auto-detected from `client/netlify.toml`.
4. The `@netlify/plugin-nextjs` plugin handles SSR, ISR, middleware, and route handlers.

### 3.2 Required env vars

Set in **Netlify Dashboard → Site Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.your-domain.com` |
| `NEXT_PUBLIC_APP_URL` | This site's URL, e.g. `https://athena-empress.netlify.app` |
| `NEXT_PUBLIC_SOCKET_URL` | Defaults to `NEXT_PUBLIC_API_URL` if unset |

> ⚠️ Without `NEXT_PUBLIC_API_URL`, all API calls will fail. The middleware
> rewrites non-auth `/api/*` to this URL; auth and uploads use Next.js route
> handlers so cookies/streams are forwarded correctly.

### 3.3 Optional env vars

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend Sentry DSN |
| `SENTRY_ORG` / `SENTRY_PROJECT` | For source-map upload during build |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Identity Services client ID (must match `GOOGLE_CLIENT_ID` on the backend) |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Facebook App ID (must match `FACEBOOK_APP_ID` on the backend) |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | `true` / `false` |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | `true` / `false` |

> Full template: [`client/.env.netlify`](./client/.env.netlify).

### 3.4 Deploy

Netlify auto-deploys on every push to `main`. To trigger manually: **Deploys
→ Trigger Deploy → Deploy site**. There is also an opt-in
`.github/workflows/netlify-deploy.yml` workflow if you'd rather drive the
deploy from GitHub Actions (requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`).

---

## 4. Pre-flight checklist

### Neon
- [ ] Project created, both pooled + direct URLs captured
- [ ] `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` set on backend host

### Backend host (Render / Fly.io / your VM)
- [ ] `JWT_SECRET` set (32+ chars from `openssl rand -hex 32`)
- [ ] `NODE_ENV=production`, `TRUST_PROXY=true`
- [ ] `CLIENT_URL` / `FRONTEND_URL` / `ALLOWED_ORIGINS` set to the Netlify URL
- [ ] `APP_URL` set to the backend's public URL
- [ ] `/health` returns 200
- [ ] `/readyz` returns 200 and `database: connected`

### Netlify
- [ ] `NEXT_PUBLIC_API_URL` set to the backend's public URL
- [ ] `NEXT_PUBLIC_APP_URL` set to this Netlify site's URL
- [ ] Site builds and loads

### Integration smoke test
- [ ] Registration creates a user in Neon
- [ ] Verification email link works (or check `pending` state on `/verify-email`)
- [ ] Login issues a JWT and the dashboard loads
- [ ] No CORS errors in the browser console
- [ ] `/api/health` from the Netlify site returns the backend's health JSON

### Optional
- [ ] Stripe webhook: `https://api.your-domain.com/api/webhooks/stripe`
      (events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`)
- [ ] SendGrid sender verified
- [ ] S3 bucket + IAM credentials configured
- [ ] Sentry DSNs set on both backend host and Netlify
- [ ] `DV_ENCRYPTION_KEY` set if DV-Safe features are needed

---

## 5. Monitoring

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Basic health check | None |
| `GET /livez` | Liveness probe | None |
| `GET /readyz` | Readiness (checks DB) | None |
| `GET /health/auth-diag` | 12-point auth dependency check | None |
| `GET /metrics` | Prometheus metrics | `METRICS_TOKEN` (Bearer or `X-Metrics-Token`) |

---

## 6. Database operations

### Migrations (automatic)
`start.ts` runs `prisma migrate deploy` before booting the server, using
`DIRECT_DATABASE_URL` if available, otherwise `DATABASE_URL`.

### Seed data (manual, optional)
```bash
npx ts-node prisma/seed.ts
```

### Backup
```bash
pg_dump $DIRECT_DATABASE_URL > backup_$(date +%Y%m%d).sql
```

> Neon also provides point-in-time restore from the console — prefer that
> over manual `pg_dump` for production.

---

## 7. Rollback

### Backend host
Most container hosts retain previous deployments — redeploy the previous
successful image from the host's dashboard (Render → **Deploys**, Fly.io →
`flyctl releases` + `flyctl deploy --image <previous>`).

### Netlify
**Netlify Dashboard → Deploys → Click previous deploy → Publish deploy.**

### Database migration
```bash
# Locally with DIRECT_DATABASE_URL set, or via the host's shell
npx prisma migrate resolve --rolled-back <MIGRATION_NAME>
```

---

## 8. Troubleshooting

| Issue | Fix |
|---|---|
| Frontend API calls return 503 | `NEXT_PUBLIC_API_URL` is unset or wrong on Netlify; redeploy after fixing |
| CORS errors in browser console | Add the Netlify domain to `ALLOWED_ORIGINS` on the backend host |
| `/readyz` returns 503 | Check `DATABASE_URL` and Neon project status; check pool exhaustion |
| Redis errors (non-fatal) | Redis is optional — caching/queues are skipped when `REDIS_URL` is unset |
| Prisma migration fails | Use `DIRECT_DATABASE_URL` (unpooled) for migrations, not the pooled URL |
| Socket.IO not connecting | Set `NEXT_PUBLIC_SOCKET_URL` to the backend's public URL |
| Health check fails on first deploy | Inspect backend host logs — `start.ts` prints the failing step |
| `JWT_SECRET` warning at boot | Set `JWT_SECRET`; the random fallback won't survive restarts |
| Auth flow returns 500 | Hit `GET /health/auth-diag` — it identifies which of the 12 auth dependencies failed |
