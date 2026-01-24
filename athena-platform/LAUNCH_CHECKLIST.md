# 🚀 Athena Platform - Launch Checklist

**Last Updated:** January 21, 2026  
**Status:** Ready for Launch

---

## Pre-Launch Summary

| Category | Status | Notes |
|----------|--------|-------|
| Server Build | ✅ Pass | 22 test suites, 99 tests |
| Client Build | ✅ Pass | 173 pages generated |
| Security | ✅ Configured | Helmet, CORS, Rate limiting |
| GDPR/UK Compliance | ✅ Complete | See Phase 4 docs |
| Infrastructure | ✅ Terraform ready | Multi-region AWS |

---

## 1. Infrastructure Setup

### 1.1 Database (PostgreSQL)
- [ ] **Production Database Provisioned**
  - Recommended: Neon, Supabase, or AWS RDS
  - Ensure `sslmode=require` in connection string
- [ ] **Run Prisma Migrations**
  ```bash
  cd server
  npx prisma migrate deploy
  ```
- [ ] **Seed Initial Data** (if needed)
  ```bash
  npx prisma db seed
  ```

### 1.2 Redis (Caching & Queues)
- [ ] **Redis Instance Provisioned**
  - Recommended: Upstash, Redis Cloud, or AWS ElastiCache
  - Set `REDIS_URL` in environment

### 1.3 Object Storage (S3)
- [ ] **S3 Bucket Created** for uploads
- [ ] **CORS Policy Configured** for client uploads
- [ ] **IAM Credentials** with minimal permissions

---

## 2. Backend Deployment (Render/Railway)

### 2.1 Environment Variables
Copy from `.env.production.example` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Default `5000` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 random chars |
| `JWT_EXPIRES_IN` | ✅ | e.g., `7d` |
| `REDIS_URL` | ✅ | Redis connection string |
| `SENDGRID_API_KEY` | ✅ | For transactional emails |
| `STRIPE_SECRET_KEY` | ✅ | Stripe live key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook signing secret |
| `OPENAI_API_KEY` | ⚠️ | For AI features |
| `AWS_ACCESS_KEY_ID` | ⚠️ | For file uploads |
| `AWS_SECRET_ACCESS_KEY` | ⚠️ | For file uploads |
| `CLIENT_URL` | ✅ | Frontend URL for CORS |
| `TRUST_PROXY` | ✅ | Set to `true` behind LB |

### 2.2 Health Checks
- [ ] Configure health check endpoint: `GET /health`
- [ ] Readiness check: `GET /readyz`
- [ ] Liveness check: `GET /livez`

### 2.3 Build & Start Commands
```bash
# Build
npm run build

# Start
npm start
```

---

## 3. Frontend Deployment (Netlify/Vercel)

### 3.1 Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |
| `NEXT_PUBLIC_APP_URL` | ✅ | This app's URL |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES` | ⚠️ | `true`/`false` |

### 3.2 Build Settings
- **Build Command:** `npm run build`
- **Publish Directory:** `.next` (Vercel) or `out` (static)
- **Node Version:** `20.x`

### 3.3 Redirects & Headers
Ensure `netlify.toml` or `vercel.json` includes:
- HTTPS redirects
- Security headers
- API proxy rules (if needed)

---

## 4. DNS & SSL

### 4.1 DNS Configuration
- [ ] **A/CNAME Records** pointing to hosting provider
- [ ] **API Subdomain** (e.g., `api.athena.com`)
- [ ] **TXT Records** for domain verification

### 4.2 SSL/TLS
- [ ] **Wildcard Certificate** or per-subdomain certs
- [ ] **Auto-Renewal** configured
- [ ] **HSTS Header** enabled
- [ ] **Force HTTPS** redirects

---

## 5. Third-Party Services

### 5.1 Stripe (Payments)
- [ ] **Live API Keys** configured
- [ ] **Webhook Endpoint** registered: `POST /api/webhooks/stripe`
- [ ] **Products/Prices** created for subscription tiers
- [ ] **Tax Settings** for UK/EU VAT

### 5.2 SendGrid (Email)
- [ ] **Domain Verified** for sending
- [x] **Templates Created** for transactional emails
- [ ] **API Key** with send permissions

### 5.3 OpenAI (AI Features)
- [ ] **API Key** configured
- [ ] **Rate Limits** understood
- [ ] **Cost Alerts** set up

### 5.4 AWS (Storage)
- [ ] **S3 Bucket** created
- [ ] **CloudFront CDN** (optional, recommended)
- [ ] **IAM User** with minimal permissions

---

## 6. Security Hardening

### 6.1 Application Security
- [x] **Helmet.js** enabled (security headers)
- [x] **CORS** configured with allowed origins
- [x] **Rate Limiting** enabled
- [x] **Input Validation** via Zod schemas
- [x] **SQL Injection Protection** via Prisma ORM
- [x] **XSS Protection** via React escaping

### 6.2 Secrets Management
- [ ] **JWT Secret** is cryptographically random (32+ chars)
- [ ] **No Secrets in Code** (all via env vars)
- [ ] **Secrets Rotation Plan** documented

### 6.3 Authentication
- [x] **Password Hashing** with bcrypt (12 rounds)
- [x] **JWT Expiry** configured
- [x] **Refresh Token Rotation** implemented

---

## 7. Monitoring & Observability

### 7.1 Logging
- [x] **Structured Logging** with Winston
- [x] **Request IDs** for traceability
- [ ] **Log Aggregation** service (Datadog, LogDNA, etc.)

### 7.2 Metrics
- [x] **Prometheus Metrics** endpoint at `/metrics`
- [ ] **Dashboard** for key metrics
- [ ] **Alerts** configured for errors, latency

### 7.3 Error Tracking
- [ ] **Sentry** or similar configured
- [ ] **Source Maps** uploaded for stack traces

---

## 8. Performance

### 8.1 Caching
- [x] **Redis Caching** for sessions, rate limits
- [x] **Database Query Optimization** via Prisma
- [ ] **CDN** for static assets

### 8.2 Load Testing
- [ ] Run `scripts/loadtest-auth.js` against staging
- [ ] Verify 100+ concurrent users supported
- [ ] Check response times under load

---

## 9. Compliance (GDPR/UK)

### 9.1 Privacy
- [x] **Privacy Policy** published
- [x] **Terms of Service** published
- [x] **Cookie Consent** banner implemented
- [x] **Data Export** (DSAR) functional
- [x] **Account Deletion** functional

### 9.2 UK-Specific
- [x] **UK Privacy Addendum** ready
- [x] **ICO Registration** planned
- [x] **Age Verification** for restricted content

---

## 10. Go-Live Sequence

### Day Before Launch
1. [ ] Final staging environment test
2. [ ] Database backup configured
3. [ ] Monitoring alerts active
4. [ ] Support team briefed

### Launch Day
1. [ ] Deploy backend to production
2. [ ] Run database migrations
3. [ ] Deploy frontend to production
4. [ ] Update DNS (if switching domains)
5. [ ] Verify all health checks pass
6. [ ] Smoke test critical flows:
   - [ ] Registration
   - [ ] Login
   - [ ] Profile creation
   - [ ] Job search
   - [ ] Payment flow

### Post-Launch
1. [ ] Monitor error rates
2. [ ] Watch for performance issues
3. [ ] Respond to user feedback
4. [ ] Daily standup for first week

---

## Quick Reference Commands

```bash
# Server - Local Development
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Server - Production Build
npm run build
npm start

# Client - Local Development
cd client
npm install
npm run dev

# Client - Production Build
npm run build
npm start

# Run Tests
cd server && npm test
cd client && npm run build  # Type checking

# Database Migrations
npx prisma migrate deploy  # Production
npx prisma migrate dev     # Development
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | oncall@athena-platform.com |
| Database Admin | dba@athena-platform.com |
| AWS Support | https://console.aws.amazon.com/support |
| Stripe Support | https://support.stripe.com |

---

**🎉 Good luck with the launch!**
