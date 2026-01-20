# Athena Production Deployment Guide

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
pm2 start dist/index.js --name athena-api

# Client
cd client
npm ci
npm run build
pm2 start npm --name athena-web -- start
```

**Option C: Vercel + Railway**
- Client: Deploy to Vercel (connect GitHub repo)
- Server: Deploy to Railway (connect GitHub repo)
- Database: Use Railway PostgreSQL or Supabase

### Step 6: Verify Deployment

```bash
# Check health endpoints
curl https://api.athena.com/health
curl https://api.athena.com/health/ready

# Check frontend
curl https://athena.com
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

1. **Sentry**: Check for errors at https://sentry.io
2. **Datadog**: View metrics at https://app.datadoghq.com
3. **Stripe**: Monitor payments at https://dashboard.stripe.com
4. **Database**: Monitor connections and slow queries

---

## 🆘 Rollback Procedure

```bash
# Revert database migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Rollback to previous deployment
# (depends on your hosting provider)
```
