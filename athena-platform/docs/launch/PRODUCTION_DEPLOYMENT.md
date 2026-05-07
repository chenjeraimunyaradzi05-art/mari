# Athena Production Deployment Guide

> **Current deployment:** Backend API + Netlify (frontend).
> See [DEPLOY.md](../../../athena-platform/DEPLOY.md) for the quick-start guide.
> This document covers additional deployment options and production hardening.

## 🚀 Quick Deployment Checklist

### Step 1: Database Migration

```bash
# From the server directory
cd server

# Set production DATABASE_URL
export DATABASE_URL="postgresql://username:password@your-host:5432/athena_production?schema=public&sslmode=require"

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
   - URL: `https://api.athena.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

#### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Set usage limits in Settings → Limits

#### AWS
1. Go to AWS IAM Console
2. Create new user with programmatic access
3. Attach policies: `AmazonS3FullAccess`, `AmazonSESFullAccess`
4. Save Access Key ID and Secret Access Key

#### Sentry (Error Tracking)
1. Go to https://sentry.io and create account
2. Create new project (Node.js for server, Next.js for client)
3. Copy DSN from Project Settings → Client Keys

#### Datadog (Monitoring)
1. Go to https://app.datadoghq.com
2. Organization Settings → API Keys
3. Create new API key and App key

### Step 5: Deploy

**Option A: Docker**
```bash
# Build and run
docker-compose -f docker-compose.yml up -d

# Check logs
docker-compose logs -f
```

**Option B: Manual Deployment**
```bash
# Server
cd server
npm ci --production
npm run build
pm2 start dist/start.js --name athena-api

# Client
cd client
npm ci
npm run build
pm2 start npm --name athena-web -- start
```

**Option C: Netlify + Neon + container backend (Current)**
- Client: Deploy to Netlify (connect GitHub repo, base dir `athena-platform/client`)
- Server: Deploy to any Node 20 container host using the bundled `Dockerfile`
  (Render, Fly.io, AWS App Runner, etc.); root dir `athena-platform/server`
- Database: Neon PostgreSQL — set `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` (unpooled)
- Migrations run automatically on deploy via `start.ts` → `prisma migrate deploy`

### Step 6: Verify Deployment

```bash
# Check health endpoints
curl https://api.your-domain.com/health
curl https://api.your-domain.com/readyz
curl https://api.your-domain.com/health/auth-diag

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
- [ ] Error pages don't leak stack traces

---

## 📊 Post-Launch Monitoring

1. **Sentry**: Check for errors at [sentry.io](https://sentry.io)
2. **Backend host**: View API logs in your provider's dashboard (Render/Fly.io/etc.) → Service → Logs
3. **Netlify Deploys**: Check build logs in Netlify Dashboard → Deploys
4. **Stripe**: Monitor payments at [dashboard.stripe.com](https://dashboard.stripe.com)
5. **Database**: Monitor connections at [console.neon.tech](https://console.neon.tech)
6. **Auth Diagnostics**: `GET /health/auth-diag` (12-point auth flow check)

---

## 🆘 Rollback Procedure

```bash
# Revert database migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Rollback to previous deployment
# (depends on your hosting provider)
```
