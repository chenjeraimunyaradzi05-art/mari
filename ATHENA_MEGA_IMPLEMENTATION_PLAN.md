# ATHENA Mega Implementation Plan

Date: 2026-06-28
Status: Late-stage beta; substantial implementation exists, but production launch is not complete.

This file replaces the scattered project markdown documents that previously mixed vision, plan, launch, compliance, deployment, and audit notes. Treat this as the single source of truth for implementation status.

Runtime legal markdown in `athena-platform/client/src/content/legal/*.md` is intentionally preserved because the app reads it for public legal pages.

## Current Verified State

- Server TypeScript build passes with `npm run build`.
- Client production build passes with `npm run build`.
- Server Jest passes with `npm test -- --runInBand --forceExit`: 26 suites, 120 tests.
- The platform includes real web, server, mobile, ML, compliance, auth, jobs, mentor, community, finance, formation, analytics, and deployment scaffolding.
- The product is not launch-complete because several integrations still use fallbacks, placeholders, disabled services, or external setup that cannot be completed from code alone.

## What Is Implemented

### Core Platform

- Next.js web app with large dashboard/public surface area.
- Express/TypeScript API with modular routes and services.
- Prisma schema and migration history.
- React Native/Expo mobile shell with auth, jobs, chat, notifications, profile, video, settings, and learning screens.
- FastAPI ML service structure with routers for career, mentor, safety, income, ranking, and feed use cases.
- Shared TypeScript package.

### Auth And Security

- Registration, login, refresh, logout, email verification, password reset, sessions, and current-user endpoints.
- JWT and refresh token handling.
- CORS, trusted-origin handling, request IDs, response timing, rate limiting, security headers, and metrics.
- Women-only self-attestation validation is present in registration tests.

### Compliance

- GDPR services, consent services, breach workflow scaffolding, data-retention scripts, GDPR routes, compliance routes, privacy center, cookie consent, reporting, safety/help pages, and legal content pages.
- Compliance is materially implemented but not legally complete for public launch because some appointments, addresses, and external registrations remain unresolved.

### Payments

- Stripe checkout/subscription service.
- Stripe Connect account, onboarding, escrow, capture/cancel, dashboard, and payout scaffolding.
- Regional payment orchestration exists for Stripe and local providers.
- Production guardrails have now started: simulated payment flows are no longer allowed to masquerade as production behavior.

### ML And AI

- ML API routers and model loader exist.
- Training folders and configs exist.
- Server-to-ML bridge exists.
- Production guardrails are in place: placeholder ML models are blocked in production-like environments unless explicitly allowed.

### Deployment And Operations

- Dockerfiles, docker-compose, health checks, metrics, smoke/load scripts, Netlify config, backend container deployment flow, Neon guidance, and launch runbooks exist.
- External production setup remains incomplete, but `/health/launch-readiness` now exposes missing production configuration.

## Missing Or Partial Work

### P0 Launch Blockers

1. Configure real production Stripe keys, webhook secret, products, prices, tax settings, and live card test results.
2. Complete Stripe Connect onboarding and payout verification for mentor/creator flows.
3. Replace or integrate regional payment providers currently represented as simulated handlers: PayPal, GrabPay, GCash, M-Pesa, Pix, UPI, Wise.
4. Provide production ML model artifacts for every served algorithm, or formally scope algorithms out of launch.
5. Complete DPO, UK representative, ICO/local-regulator, legal address, and legal sign-off details.
6. Provision production database, Redis, object storage, CDN, Sentry, and any OpenSearch dependency selected for launch.
7. Run production/staging migrations, smoke tests, E2E tests, payment tests, load tests, and security checks.
8. Verify DNS, SSL, HSTS, force HTTPS, email domain authentication, and monitoring alerts.

### P1 Product Completion

1. Replace any remaining mock/fallback authenticated dashboard data outside creator dashboard, learning detail, and opportunity radar.
2. Enable or formally remove OpenSearch initialization and sync.
3. Enable background workers with a production Redis strategy.
4. Finish livestream schema and route enablement, or remove livestream routes from launch scope.
5. Provide and operate the production video processor behind `VIDEO_PROCESSOR_URL`.
6. Finish production push notification setup.
7. Complete regional localization bundles and copy coverage.

### P2 Growth And Rollout

1. Complete Phase 7 localization, currencies, timezones, regional partners, tax/VAT/GST readiness, and rollout metrics.
2. Expand app-store assets, mobile store review flow, and screenshot automation.
3. Add CI checks that validate documentation references, API routes, and launch readiness.
4. Consolidate production dashboards and on-call escalation ownership.

## Implementation Log

### 2026-06-27

- Created this consolidated mega implementation plan.
- Preserved runtime legal markdown content used by the web app.
- Started production hardening:
  - `server/src/services/payment.service.ts` now refuses Stripe-dependent actions in production without `STRIPE_SECRET_KEY`.
  - `server/src/services/stripe-connect.service.ts` now refuses mock Connect accounts, mock escrow, and mock payouts in production.
  - `server/src/services/payments-orchestration.service.ts` now refuses unconfigured payment providers in production instead of returning simulated regional flows.
  - `ml/src/api/services/model_loader.py` now blocks placeholder models in production-like environments unless `ATHENA_ALLOW_PLACEHOLDER_MODELS=true` is explicitly set.

### 2026-06-28

- Live-wired authenticated UI areas that previously showed hardcoded examples:
  - `client/src/app/dashboard/creator/page.tsx` now loads creator analytics, profile, and received gifts from `/api/creator/*`.
  - `client/src/app/dashboard/learn/[id]/page.tsx` now renders only real course fields from `/api/courses/:id` and shows honest empty sections for unpublished curriculum/provider details.
  - `client/src/app/dashboard/ai/opportunity-radar/page.tsx` no longer falls back to sample opportunities on scan failure.
- Removed additional routed dashboard AI fallbacks:
  - `client/src/app/dashboard/ai/idea-validator/page.tsx` now shows the real AI analysis or a service error.
  - `client/src/app/dashboard/ai/content-generator/page.tsx` no longer fabricates posts/emails when generation fails.
  - `client/src/app/dashboard/ai/career-path/page.tsx` normalizes real milestones and no longer falls back to a fixed career ladder.
  - `client/src/app/dashboard/ai/interview-coach/page.tsx` now calls `/api/ai/interview-coach/feedback` instead of generating local canned feedback.
- Added `POST /api/ai/opportunity-radar`, preserving the existing `jobs` response and adding normalized `opportunities` for the scanner UI.
- Added `POST /api/ai/interview-coach/feedback` backed by `aiService.evaluateInterviewAnswer`.
- Added production video processor support:
  - `server/src/services/video-processing.service.ts` uses `VIDEO_PROCESSOR_URL` for `/process`, `/captions`, `/thumbnail`, and `/effects` in production.
  - `server/src/services/workers.service.ts` uses the same external processor for queued video processing jobs.
  - Local development simulation remains allowed; production simulation requires explicit opt-in.
- Removed unsafe production fallbacks:
  - `server/src/services/dv-safe.service.ts` now fails in production without a valid 64-character hex `DV_ENCRYPTION_KEY`.
  - `server/src/utils/env.ts` validates `DV_ENCRYPTION_KEY` for production.
  - `server/src/services/formation.service.ts` now refuses formation payment confirmation in production when Stripe is unavailable.
  - `server/src/routes/ai-algorithms.routes.ts` blocks placeholder Career Compass records in production unless `AI_ALGORITHMS_ALLOW_PLACEHOLDER=true`.
  - `server/src/utils/email.ts` no longer reports email success in production when `SENDGRID_API_KEY` is absent.
- Billing settings no longer displays a fake `4242` card when no real card metadata exists.
- Confirmed livestream remains de-scoped: `/api/livestream` is not mounted, and the Prisma schema still lacks the `StreamKey`/`LiveStream` models expected by the service.
- Added protected `/health/launch-readiness` to report missing required and recommended launch configuration.
- Re-verified:
  - Server TypeScript build passes with `npm run build`.
  - Client production build passes with `npm run build`.
  - Server Jest passes with `npm test -- --runInBand --forceExit`: 26 suites, 120 tests.
  - Local dev servers started successfully on backend `http://localhost:5000` and frontend `http://localhost:3000`.

## Launch Readiness Checklist

### Code

- [x] Server build passes.
- [x] Client build passes.
- [x] Server test suite passes with forced Jest exit.
- [x] Production guardrails started for payments.
- [x] Production guardrails in place for ML model loading.
- [x] Remove or live-wire creator dashboard mock data.
- [x] Remove or live-wire learning detail mock data.
- [x] Remove or live-wire opportunity radar mock data.
- [x] Add production video processor integration and block implicit production simulation.
- [x] Add launch readiness endpoint.
- [x] Remove routed dashboard AI client-side fake output fallbacks.
- [x] Block unsafe DV encryption fallback in production.
- [x] Block formation payment confirmation without Stripe in production.
- [x] Stop production email helper from returning success without SendGrid.
- [ ] Enable workers intentionally in production.
- [ ] Enable or de-scope OpenSearch.
- [x] De-scope livestream from launch by keeping routes unmounted until schema and streaming infrastructure are implemented.

### External Setup

- [ ] Production database provisioned.
- [ ] Direct and pooled database URLs configured.
- [ ] Redis provisioned.
- [ ] Object storage bucket and IAM credentials configured.
- [ ] CDN configured.
- [ ] Sentry DSNs configured.
- [ ] Stripe live mode configured.
- [ ] Stripe webhook endpoint registered.
- [ ] Stripe Connect verified.
- [ ] Email sender/domain verified.
- [ ] DNS records propagated.
- [ ] SSL certificates valid.
- [ ] HSTS and HTTPS redirects verified.

### Compliance And Legal

- [ ] DPO contact finalized.
- [ ] UK/EU representative details finalized where required.
- [ ] Legal addresses finalized.
- [ ] ICO/local regulator requirements completed where required.
- [ ] Privacy, terms, and cookie policies signed off.
- [ ] DSAR export load-tested.
- [ ] Breach notification workflow tested.
- [ ] Trust and Safety notification contacts configured.

### Verification

- [ ] Production migrations dry-run against staging replica.
- [ ] Launch smoke test passes.
- [ ] Critical E2E tests pass.
- [ ] Payment flows tested with real cards in the correct mode.
- [ ] Load test target met.
- [ ] Security audit complete.
- [ ] Monitoring alerts active.
- [ ] Rollback path tested.

## Protected Markdown

The following markdown files remain because they are app content rather than planning docs:

- `athena-platform/client/src/content/legal/cookies.md`
- `athena-platform/client/src/content/legal/cookies_eg.md`
- `athena-platform/client/src/content/legal/cookies_ksa.md`
- `athena-platform/client/src/content/legal/cookies_uae.md`
- `athena-platform/client/src/content/legal/cookies_za.md`
- `athena-platform/client/src/content/legal/privacy.md`
- `athena-platform/client/src/content/legal/privacy_eg.md`
- `athena-platform/client/src/content/legal/privacy_ksa.md`
- `athena-platform/client/src/content/legal/privacy_uae.md`
- `athena-platform/client/src/content/legal/privacy_za.md`
- `athena-platform/client/src/content/legal/terms.md`
- `athena-platform/client/src/content/legal/terms_eg.md`
- `athena-platform/client/src/content/legal/terms_ksa.md`
- `athena-platform/client/src/content/legal/terms_uae.md`
- `athena-platform/client/src/content/legal/terms_za.md`

## Deleted Documentation Replaced By This File

The previous markdown set contained stale and contradictory claims across planning, launch, deployment, compliance, hiring, investor, marketing, and audit docs. Those files were removed so this file can carry the implementation truth in one place.

If a deleted document contained information that needs to live on, add it here under a clearly labeled section and update the relevant checklist status.
