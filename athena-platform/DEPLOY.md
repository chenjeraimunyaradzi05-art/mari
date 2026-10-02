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
| `CLAMAV_HOST` | Malware scanning | Private address of the ClamAV scanner. Without it a résumé or a document cannot be uploaded in production, and `/health/launch-readiness` answers not_ready. See section 2.6 |
| `SENTRY_DSN` | Sentry | Error tracking |
| `DV_ENCRYPTION_KEY` | DV-Safe, safety plans | 64 hex chars: `openssl rand -hex 32`. Safe chats, health records, safety plans and two-factor seeds are sealed under it. Back it up before anything is sealed: without this exact value they cannot be read again. Changing it is a rotation (`docs/runbooks/ENCRYPTION.md`), not an edit |
| `ENABLE_WORKERS` | BullMQ | Set `true` to enable background jobs (needs `REDIS_URL`) |
| `METRICS_TOKEN` | Prometheus | Protect `/metrics` endpoint |
| `PROXY_SHARED_SECRET` | Web proxy | 32+ chars, same value on Netlify. The web app's route handlers forward each visitor's address with it, so rate limits, the login lockout and new-device alerts see the visitor, not the proxy |

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

### 2.6 Malware scanning

Every upload is looked inside by ClamAV before it is kept. ClamAV is a service of
its own, not part of the API container: its signature database needs about
1.5 GB of memory, and a scanner is a program that opens hostile files, so it
belongs behind a network boundary. The API talks to it over TCP
(`CLAMAV_HOST`, `CLAMAV_PORT`, default 3310).

What happens when a file cannot be scanned is `MALWARE_SCAN_REQUIRED`:

| Value | Effect |
|---|---|
| unset (the default in production) | Résumés and documents are refused with a 503 until a scanner answers. Pictures are stored: they are rewritten on the way in, and so are videos and sounds, which removes what they can carry |
| `all` | Every upload is refused when it cannot be scanned |
| `off` | Nothing is refused for want of a scanner. Only choose this on purpose; a scanner that is there is still used |

A file the scanner finds a virus in is refused with a 422 whatever this says.

Running it:

- **Render:** create a Private Service from the Docker image
  `docker.io/clamav/clamav:stable` in the same region as the API (2 GB plan,
  port 3310), then set `CLAMAV_HOST` on the API to its internal address. It is
  not in `render.yaml` because it is a second paid instance.
- **Fly:** a second app on the private network, with the commands in the footer of
  `server/fly.toml`; `CLAMAV_HOST=athena-clamav.internal`.
- Its first start downloads the signature database and takes a few minutes; until
  it answers, résumé uploads are refused. The scanner keeps the database up to
  date on its own.
- The scanner takes files up to 25 MB as shipped, which covers every résumé
  and document. To scan larger files (reels), raise clamd's `StreamMaxLength` and
  set `MALWARE_SCAN_MAX_BYTES` on the API to the same figure.
- Check it: `GET /health/launch-readiness` (with the diagnostics token) lists a
  `MALWARE_SCANNER` check that asks the scanner and reports its version, and
  `/health/detailed` shows `malware-scan.unreachable`.

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
| `PROXY_SHARED_SECRET` | Same value as the API's `PROXY_SHARED_SECRET`. The route handlers forward each visitor's address with it; without it the API sees every visitor as this host and rate limits and the login lockout are shared by everyone |

> **Critical:** Without `NEXT_PUBLIC_API_URL` the in-app proxy falls back to
> `localhost:5000` and every `/api/*` and `/uploads/*` request fails. The
> route handlers under `client/src/app/api` and `client/src/app/uploads` read it
> at request time; Socket.IO connects to `NEXT_PUBLIC_SOCKET_URL`, falling back
> to the same value.

### 3.3 Optional Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | Realtime origin if it differs from the API URL |
| `NEXT_PUBLIC_MEDIA_HOST` | The host the API's `CDN_URL` points at (for example `cdn.your-domain.com`), so `next/image` will load avatars and logos from it. Read at build time, so deploy again after setting it |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for the web app's error tracking. Read at build time, so set it and then deploy again |
| `SENTRY_ORG` | Sentry organisation slug, for source map uploads at build time |
| `SENTRY_PROJECT` | Sentry project name, for source map uploads at build time |
| `SENTRY_AUTH_TOKEN` | A Sentry organisation token (Settings > Auth Tokens), Builds scope, **secret**. Without it the build cannot upload source maps and errors point at minified code; the build warns when the DSN is set without it |
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
- [ ] Stripe webhook: `https://api.your-domain.com/api/webhooks/stripe` (events: `checkout.session.completed`, `customer.subscription.*` including `customer.subscription.trial_will_end`, `invoice.*`, `payment_intent.*`, `charge.refunded`, `charge.dispute.*`, `transfer.*` and `identity.verification_session.*`; the full list is in DEPLOYMENT_GUIDE.md)
- [ ] SendGrid sender verified
- [ ] S3 bucket created + IAM credentials set
- [ ] Sentry DSN set (both API host + Netlify)
- [ ] `DV_ENCRYPTION_KEY` set (64 hex chars) and backed up in a password manager. Safety plans are sealed under it. After the first deploy with it set, run `npm run seal:safety-plans -- --dry-run` then `npm run seal:safety-plans` once from `athena-platform/server` (with `DATABASE_URL` set to the production database, the value the API host uses, because that is the connection the script opens, and `DV_ENCRYPTION_KEY` set to the same key) to seal plans saved before sealing existed; it prints counts only and is safe to run twice

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
Only two seeds are meant for the production database:

```bash
# From athena-platform/server, with the Neon URLs in the environment
npm run db:seed:admin   # the administrator account (ADMIN_EMAIL, ADMIN_PASSWORD)
npm run db:seed:real    # events, reels and stories that were each checked against a public source
```

`npm run db:seed:demo` writes invented people, organisations and content, and
`npm run db:seed:content` writes sample posts and reels under whichever members
already exist. Both are for a local or throwaway database only and **must never
be run against production**. The demo seed refuses to run when `NODE_ENV` is
`production` or the database host is not local, unless `ALLOW_DEMO_SEED=true` is
set for a throwaway demo database. There is no plain `db:seed` script.

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
| `JWT_SECRET` error at start | In production the API refuses to start without a real `JWT_SECRET` (32+ random characters; `openssl rand -hex 32`), and refuses a placeholder such as the one in `.env.example`. There is no random fallback: tokens are never signed with an invented key, and a staging or preview deployment (any `NODE_ENV` other than `development` and `test`) refuses to start without a secret too. On Render the blueprint generates it; on Fly use `fly secrets set` |
| `SENDGRID_FROM_EMAIL` error at start | Set it to an address on a domain you own and have authenticated in SendGrid. There is no default sender; `athena.com` and `example.com` are refused |
