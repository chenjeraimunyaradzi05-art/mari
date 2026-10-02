# 🚀 Athena Platform - Launch Checklist

**Last Updated:** February 11, 2026  
**Status:** Ready for Launch

> **See also:** [Launch Day Procedures](./docs/launch/LAUNCH_CHECKLIST.md) for the T-24h / T-1h / T-0
> launch sequence, monitoring checklist, rollback procedure, and success metrics.

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
  - Neon — see [NEON_SETUP.md](../NEON_SETUP.md) for the pooled and direct URLs
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

## 2. Backend Deployment (API host)

### 2.1 Environment Variables
Copy from `.env.production.template` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Default `5000` |
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `DIRECT_DATABASE_URL` | ✅ | Neon direct connection string (migrations) |
| `JWT_SECRET` | ✅ | 32+ random characters (`openssl rand -hex 32`). The API refuses to start in production without it, and refuses a placeholder or a repeating value. Render generates it from the blueprint |
| `BANNED_IDENTITY_HASH_KEY` | ⚠️ | `openssl rand -hex 32`, set once. Without it the ban list is keyed from `JWT_SECRET`, so rotating that would unban everyone. Steps in `docs/runbooks/ONCALL.md` |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | ➖ | Optional. The defaults are what `render.yaml` and `fly.toml` deploy: access token `15m`, refresh token `7d`, rotated on every use |
| `REDIS_URL` | ✅ | Redis connection string |
| `SENDGRID_API_KEY` | ✅ | The API refuses to start in production without it: nobody can verify an account without the email |
| `SENDGRID_FROM_EMAIL` | ✅ | An address on a domain you own and have authenticated in SendGrid. There is no default; `athena.com` and `example.com` are refused |
| `TRUST_SAFETY_EMAIL` | ⚠️ | A monitored mailbox. Reports marked critical or high, and every child-safety or terrorism report, email it. Unset, nobody is alerted and the report waits in the queue |
| `AUTHORITY_ESCALATION_EMAIL` | ➖ | Whoever holds the duty to refer child-safety and terrorism reports to the AFP and eSafety. Falls back to `TRUST_SAFETY_EMAIL`. Nothing is transmitted automatically: name a staff owner for the Authority referrals screen as well |
| `STRIPE_SECRET_KEY` | ⚠️ | Stripe live key (payments disabled if absent) |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | Webhook signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ⚠️ | Signing secret of the second Stripe endpoint, the one set to listen on connected accounts. Without it payout and connected-account events are refused and a failed payout is never heard about. `/health/launch-readiness` is not ready in production until it is set |
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
- **Publish Directory:** `.next` (auto-handled by `@netlify/plugin-nextjs`)
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
- [ ] **API Subdomain** (e.g., `api.<your-domain>`; records in `docs/launch/DNS_SSL_CONFIGURATION.md`)
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
- [ ] **Connect Webhook Endpoint** registered at the same URL with "Listen to events on Connected accounts" ticked (`payout.paid`, `payout.failed`, `account.updated`), its own signing secret set as `STRIPE_CONNECT_WEBHOOK_SECRET`
- [ ] **Stripe Connect walked end to end** before payouts are announced. The onboarding, hold, capture, refund and payout code has never been run against real Stripe. Follow `docs/runbooks/STRIPE-CONNECT.md` in test mode first (a mentor connects, a buyer's hold is authorised, released, withdrawn and paid; a failed payout; a refund; a creator gift and withdrawal; the reconciliation report clean), decide there whether new accounts are created on a manual payout schedule (`STRIPE_CONNECT_PAYOUT_SCHEDULE=manual`), fill in its record of the passes, then repeat once live with two real people at the smallest amount. `server/scripts/stripe-connect-smoke.js` checks Stripe's side of the loop in test mode. Keep payouts switched off (no live keys) until it has passed.
- [ ] **Products/Prices** created for subscription tiers
- [ ] **Tax: GST (Australia).** Create each membership Price in **AUD** with tax behaviour **Inclusive**, and set `ATHENA_LEGAL_NAME`, `ATHENA_ABN`, `ATHENA_BILLING_ADDRESS` (lines separated by `|`) and `ATHENA_BILLING_EMAIL` (a mailbox on a domain ATHENA owns) on the host: none has a default, and until all four are set no invoice document is produced (a member's download answers 503 and `/health/launch-readiness` fails). Set `ATHENA_GST_REGISTERED_FROM` (YYYY-MM-DD) only once ATHENA is registered for GST; until then an invoice says "Invoice", not "Tax invoice", and the pricing page says no GST is added. ATHENA works the GST out from the amount charged (one eleventh), which is only right if the Prices are tax-inclusive. Decide with your accountant whether to turn on Stripe Tax (Settings > Tax: head office in Queensland, Australia GST registration) and how to treat members outside Australia; ATHENA does not claim GST on a non-AUD sale.
- [ ] **Radar and failure alerts** (Stripe Dashboard, live mode): Radar > Rules, confirm the default rules are on and require 3D Secure when risk is elevated; decide whether to buy Radar for Fraud Teams (needed for custom velocity rules, such as repeated declines per card, email or IP). Settings > Notifications, turn on email for failed payments, early fraud warnings and disputes, to a monitored mailbox. ATHENA's own ceilings (payments started, gifts, withdrawals, repeated declines, holds per buyer) are built into the payment routes; the card number never reaches ATHENA, so per-card rules can only live in Stripe.
- [ ] **Customer portal and emails** (Stripe Dashboard): Settings > Billing > Customer portal, allow cancelling at the end of the billing period, updating the payment method and viewing invoices, and add links to the Terms. Settings > Emails, switch on successful-payment receipts, refund notifications and subscription cancellation emails; ATHENA sends none of its own.
- [ ] **Failed payments and plan changes** (Stripe Dashboard): Settings > Billing > Subscriptions and emails, switch on Smart Retries, set the retry schedule to finish within 7 days, and choose to cancel the subscription when every retry fails. A member keeps her paid plan for 7 days after a failed renewal (`PAST_DUE_GRACE_DAYS` in the server's price book, and the failed-payment email says so) and her paid tools pause after that until the payment goes through; a longer retry schedule leaves the subscription past due after her tools have paused. In the Customer portal also allow switching plan across the four membership Prices and keeping a membership that is set to end, because checkout refuses a second membership for someone who already has one. ATHENA's own `POST /api/subscriptions/change-plan` moves a live membership onto another tier's Price in the currency it is billed in.
- [ ] **Creator payout cadence** (owner decision, then the Terms reviewer signs off): today a creator is paid when she asks, once her balance reaches A$50, and Terms section 5.3 says exactly that. To pay every creator at or above the minimum on the 1st of each month (Queensland time) without being asked, set `CREATOR_AUTO_PAYOUTS=monthly` on the host AND change section 5.3, the Creator Terms Addendum and the sentences under the Request payout button on the creator dashboard ("only made when you ask") and in `docs/legal/TERMS_OF_SERVICE_DRAFT.md` to say so in the same release. It pays through the same checks as her own request (adult account, current Creator Terms Addendum, women-only check where switched on, verified Stripe account, no hold) and never pays twice in a month. Leave it unset to keep paying on request.
- [ ] **Practise the payments pause before launch.** In the admin console, Platform settings, Payments, press Pause payments, confirm a membership upgrade, a gift top-up and a formation fee all answer "Payments are paused" with nothing charged, then open payments again and confirm each works. The switch is the `payments_paused` feature flag and takes effect in about five seconds with no deploy; it stops every new charge, hold, capture, payout and transfer and leaves refunds, handing a hold back to a buyer and the Stripe webhooks open (`docs/security/incident-response.md`). Whoever is on call needs admin access with two-factor set up before they need it.
- [ ] **Free-plan limits** (owner decision): the server enforces exactly two plan differences today, the six AI tools (Pro only) and the AI chat window (20 messages a day on Free, 200 on Pro, from `AI_CHAT_FREE_MAX_REQUESTS` and `AI_CHAT_PREMIUM_MAX_REQUESTS`). Job applications, mentor requests, courses and company formation are the same for every member, and the pricing page says nothing else. If the owner decides a cap is part of the product, it is added to the entitlements table on the server first, enforced there, and only then named on a page; the recommended default for a women's employment platform is no cap on applications.
- [ ] **Business formation fee wording** (owner decision, in writing): the pages print the fee (A$49 sole trader, A$99 partnership, A$499 company, A$699 trust) and what the platform does for it today (a person reviews the registration, records the ABN or ACN, and a refused registration is refunded in full). Decide and sign off the price and whether it is GST inclusive, what the fee covers and leaves out (ATHENA's review against any fee a government register charges), the turnaround, who lodges with ASIC and the ABR (get legal advice on whether staff may lodge for a member), and the refund terms beyond a refusal; then the wording in `FORMATION_FEE_TERMS` (the server's price book) is changed in one place and every page follows. Confirm someone is rostered to work the admin formation queue before the fee is switched on.
- [ ] **Card holds longer than a week**: a hold on a card lasts about a week and a marketplace package can take longer. The buyer is asked to renew it in the last two days (nothing is taken by renewing), and the provider is not asked to deliver against a hold that has ended. Decide with the owner what happens for a car sale whose hold ends during the buyer's inspection period (it is settled by a person today), and ask Stripe support (https://support.stripe.com) whether extended authorisation is available to this account before turning on `ESCROW_REQUEST_EXTENDED_AUTHORISATION`. Until the car rule is decided, consider keeping car purchases switched off for launch.

### 5.2 SendGrid (Email)
- [ ] **Domain authenticated** for sending: the three CNAME records SendGrid prints, verified (`docs/launch/DNS_SSL_CONFIGURATION.md`, "Email records")
- [ ] **DMARC** published at `_dmarc.<your-domain>`, starting at `p=none` with a report mailbox someone reads
- [x] **Templates** for transactional emails are in the code (`server/src/utils/email.ts`)
- [ ] **API Key** with Mail Send permission only, set as `SENDGRID_API_KEY`
- [ ] **From address** on the authenticated domain, set as `SENDGRID_FROM_EMAIL`
- [ ] **Proved end to end**: a throwaway registration's verification email arrives and passes SPF, DKIM and DMARC in its headers

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
- [x] **Input Validation**: zod schemas (`src/middleware/validate.ts`, `src/utils/schemas.ts`), express-validator chains that are read through `validationResult`, and hand-written checks each named on their route with a `// validated:` note saying where the checking is. `npm run check:route-validation` (in CI) fails on a route that reads a request body or a list size and checks neither, and its baseline (`scripts/route-validation-baseline.json`) is empty, so any new offender fails. It is a floor: it finds a route with no check, not a weak one. A JSON body is limited to 256kb, with larger limits only on the named import and article routes (`src/config/body-limits.ts`) and only for a caller whose request carries a signed access token; every list clamps its page size
- [x] **SQL Injection Protection** via Prisma ORM
- [x] **XSS Protection** via React escaping

### 6.2 Secrets Management
- [ ] **JWT Secret** is cryptographically random (32+ chars). The API checks length and placeholders at boot and on `/health/launch-readiness`; it cannot tell a generated value from a typed one, so confirm on the host that it was not pasted from a local `.env`
- [ ] **`BANNED_IDENTITY_HASH_KEY`** is set (`openssl rand -hex 32`) so bans survive a `JWT_SECRET` rotation
- [ ] **No Secrets in Code** (all via env vars)
- [ ] **Secrets Rotation Plan** documented

### 6.3 Authentication
- [x] **Password Hashing** with bcrypt (12 rounds)
- [x] **JWT Expiry** configured: 15 minutes for the access token, 7 days for the rotating refresh token
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
- [ ] **Minimum age (18+)**: a date of birth is asked at every sign-up and writes are refused without an acceptable one (done), but the date is self-declared and is not "age verification". Counsel to confirm that is enough under Australia's social media minimum age rules and eSafety's "reasonable steps" before public launch (`athena-platform/docs/runbooks/UNDER-AGE-ACCOUNT.md`)
- [ ] **Staff accounts have a date of birth.** The administrator the seed script creates (`src/services/seed/admin.seed.ts`) and any staff account made before the date was asked have none, and an account with none is refused every write outside the short list in `src/middleware/account-standing.ts`. The admin console (`/api/admin/`) is on that list; the staff routes mounted elsewhere (housing safety checks, provider checks, impact programmes, payments and invoices) are not. Each staff member signs in once and gives hers under Settings, Profile, before launch, or those actions answer "Please add your date of birth".

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
