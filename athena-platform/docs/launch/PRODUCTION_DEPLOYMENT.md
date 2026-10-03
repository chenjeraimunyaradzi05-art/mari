# Athena Production Deployment Guide

> **Current deployment:** Netlify (web) + Neon (database) + an always-on Node host for the API.
> See [DEPLOY.md](../../../athena-platform/DEPLOY.md) for the quick-start guide.
> This document covers additional deployment options and production hardening.

## 🚀 Quick Deployment Checklist

### Step 1: Database Migration

```bash
# From the server directory
cd server

# Set production DATABASE_URL
# The Neon DIRECT (unpooled) endpoint — migrations cannot run through the pooler. See NEON_SETUP.md.
export DATABASE_URL="$DIRECT_DATABASE_URL"

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Step 2: DNS Configuration

Configure these DNS records in your DNS provider (Cloudflare, AWS Route53, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | athena.com | YOUR_SERVER_IP | Auto |
| A | www | YOUR_SERVER_IP | Auto |
| A | api | YOUR_API_SERVER_IP | Auto |
| CNAME | www | athena.com | Auto |

**If using Cloudflare:**
1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Enable "Proxied" (orange cloud) for DDoS protection
4. Set SSL/TLS to "Full (strict)"

### Step 3: SSL Certificates

**Option A: Cloudflare (Recommended)**
1. Enable Cloudflare proxy for your domain
2. SSL/TLS → Overview → Set to "Full (strict)"
3. SSL/TLS → Edge Certificates → Enable "Always Use HTTPS"
4. Cloudflare automatically handles certificates

**Option B: Let's Encrypt (Self-hosted)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d athena.com -d www.athena.com -d api.athena.com

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

### Step 4: Get API Keys

#### Stripe
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Live** Secret Key (sk_live_...)
3. Copy your **Live** Publishable Key (pk_live_...)
4. Set up webhook: Developers → Webhooks → Add endpoint
   - URL: `https://<your API host>/api/webhooks/stripe` (the API service's own host, not the web app's; ATHENA does not own athena.com)
   - Events: every one the server acts on, not only the subscription ones.
     Memberships: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.trial_will_end`
     (the reminder email before a trial's first charge), `invoice.paid`,
     `invoice.payment_failed`. Payments, holds and gifts: `payment_intent.succeeded`,
     `payment_intent.payment_failed`, `payment_intent.canceled`,
     `payment_intent.amount_capturable_updated`. Money going back: `charge.refunded`
     and all five dispute events, `charge.dispute.created`, `charge.dispute.updated`,
     `charge.dispute.closed`, `charge.dispute.funds_withdrawn` and
     `charge.dispute.funds_reinstated` (a dispute is recorded and acted on from
     whichever arrives first, so subscribing to only some of them leaves it half
     known). Creator payouts:
     `transfer.created`, `transfer.reversed`. Identity checks:
     `identity.verification_session.verified`,
     `identity.verification_session.requires_input`.
   - A second endpoint with "Listen to events on Connected accounts" ticked, for
     `account.updated`, `payout.paid` and `payout.failed`, signed with its own secret
     (`STRIPE_CONNECT_WEBHOOK_SECRET`).

#### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Set usage limits in Settings → Limits

#### AWS
1. Go to AWS IAM Console
2. Create new user with programmatic access
3. Attach a policy scoped to the one media bucket (`S3_BUCKET`): `s3:PutObject`,
   `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`, and
   `s3:ListBucket` on `arn:aws:s3:::<bucket>`, which the startup probe's
   HeadBucket needs. Add `rekognition:DetectModerationLabels` (resource `*`):
   the same key screens uploaded images (`moderation.service.ts`), and without
   that permission every image screening call fails. Add
   `secretsmanager:GetSecretValue` on the one secret only if `USE_AWS_SECRETS`
   is on. Not `AmazonS3FullAccess`, which this step used to name: it hands the
   API's key every bucket in the account. No SES policy either; email goes
   through SendGrid.
4. Save Access Key ID and Secret Access Key. In production the API checks both
   at boot and asks S3 whether the bucket answers; `/health/launch-readiness`
   fails while it does not.

#### Sentry (Error Tracking)
1. Go to https://sentry.io and create account
2. Create new project (Node.js for server, Next.js for client)
3. Copy DSN from Project Settings → Client Keys

#### Datadog (Monitoring)
1. Go to https://app.datadoghq.com
2. Organization Settings → API Keys
3. Create new API key and App key

### Step 5: Deploy

**Netlify + Neon + API host (what production runs)**
- Client: Deploy to Netlify (connect GitHub repo, base dir `athena-platform/client`). Set `PROXY_SHARED_SECRET` there with the Builds and Functions scopes, the same value as the API's: the build stops without it, and the web host refuses to serve without it.
- Server: Deploy to an always-on Node host (root dir `athena-platform/server`, Dockerfile or `npm ci && npm run build`, start `node dist/start.js`). `render.yaml` at the repository root and `athena-platform/server/fly.toml` are ready-made configurations; see `DEPLOYMENT_GUIDE.md` at the repository root.
- Database: Neon PostgreSQL — pooled `DATABASE_URL` at runtime, direct `DIRECT_DATABASE_URL` for migrations (see [NEON_SETUP.md](../../../NEON_SETUP.md))
- Migrations run automatically on deploy via `start.ts` → `prisma migrate deploy`, and from the "Build and Deploy" workflow

**Not for production: `athena-platform/docker-compose.yml`**

This guide used to offer `docker-compose -f docker-compose.yml up -d` as a
production option. That file is the development stack. It runs the ML service
from its development image with `DEBUG=true` and no shared key, so every
endpoint answers anything that can reach its port, and it publishes Postgres,
Redis, OpenSearch and the ML service on the host's ports for a developer's
convenience. Do not deploy it.

**The ML service, if you deploy it**

It is optional: without `ML_SERVICE_URL` the feed ranks by engagement alone
(`docs/runbooks/ML-SERVICE.md` has what turning it on would take). A production
deployment of `athena-platform/ml` must set:

- `ML_SERVICE_KEY`, a long random value (`openssl rand -hex 32`), set to the
  same value on the API, which sends it as `X-ML-Key`. The service refuses to
  start in production without it.
- `ENVIRONMENT=production` (or `ATHENA_ENV`, `APP_ENV` or `NODE_ENV`, read in
  that order). Without a production environment name the missing-key refusal
  does not apply and `DEBUG` is honoured, which returns exception text to
  callers.
- No published port. Put it on the API host's private network and point
  `ML_SERVICE_URL` at that address.

**Manual deployment (a single machine you run yourself)**
```bash
# Server: the build needs the dev dependencies (TypeScript), so install them,
# build, then drop them.
cd server
npm ci
npm run build
npm prune --omit=dev
pm2 start dist/start.js --name athena-api

# Client: PROXY_SHARED_SECRET must be in this process's environment, or it
# refuses to serve.
cd client
npm ci
npm run build
pm2 start npm --name athena-web -- start
```

### Step 6: Verify Deployment

```bash
# Check health endpoints
curl https://api.your-domain.com/health
curl https://api.your-domain.com/readyz

# These two answer 404 without the diagnostics token (HEALTH_DIAGNOSTICS_TOKEN).
# launch-readiness must say "ready": it lists every setting still missing.
curl -H "Authorization: Bearer $HEALTH_DIAGNOSTICS_TOKEN" https://api.your-domain.com/health/launch-readiness
curl -H "Authorization: Bearer $HEALTH_DIAGNOSTICS_TOKEN" https://api.your-domain.com/health/auth-diag

# Check frontend
curl https://athena-empress.netlify.app
```

---

## 🔐 Security Checklist

- [ ] All secrets are in environment variables (not in code)
- [ ] Database has strong password
- [ ] SSL/TLS enabled
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Helmet security headers active
- [ ] Stripe webhook secret configured
- [x] Error pages don't leak stack traces (the API answers a generic message and a request id in production; `debugMessage` and `debugStack` appear only with a valid `X-Debug-Auth` header. The web error pages show no error text outside development. The ML service answers a generic detail and logs the exception. `/health/ready` and the emergency start-up server carry no error text. Tested in `errorHandler.test.ts`, `health.probes.test.ts`, `error.test.tsx` and the ML `test_main.py`)

---

## 📊 Post-Launch Monitoring

1. **Sentry**: Check for errors at [sentry.io](https://sentry.io)
2. **API host logs**: View API logs in the host's dashboard; `start.ts` prints boot and migration output
3. **Netlify Deploys**: Check build logs in Netlify Dashboard → Deploys
4. **Stripe**: Monitor payments at [dashboard.stripe.com](https://dashboard.stripe.com)
5. **Database**: Monitor connections, compute and storage in the Neon console → Monitoring
6. **Auth Diagnostics**: `GET /health/auth-diag` (12-point auth flow check)

---

## 🆘 Rollback Procedure

```bash
# Revert database migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Rollback to previous deployment
# (depends on your hosting provider)
```
