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
- The product is not launch-complete because several integrations still use disabled services, explicit demo modes, placeholders, or external setup that cannot be completed from code alone.

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

1. Continue replacing remaining mock/fallback authenticated dashboard data; the largest routed examples have been converted, but some studio/demo components still need audit.
2. Operate OpenSearch if selected for launch; otherwise keep Prisma search fallback as the explicit launch scope.
3. Provision Redis and worker provider endpoints, then intentionally enable background workers in production.
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
- Hardened queue, worker, auth-email, and optional search behavior:
  - `server/src/utils/queue.ts` no longer silently defaults production BullMQ usage to localhost Redis.
  - `server/src/services/workers.service.ts` now waits for worker readiness, fails email jobs when the provider rejects a send, routes production push/data-export jobs through configured provider URLs unless simulation is explicitly allowed, and treats OpenSearch indexing as skipped only when OpenSearch is disabled.
  - `server/src/index.ts` starts workers during the real startup sequence and fails production startup if enabled workers cannot start.
  - `server/src/utils/opensearch.ts` makes OpenSearch opt-in, initializes it when configured, and exposes indexing success/failure.
  - `server/src/routes/auth.routes.ts` now requires verification email delivery during registration and cleans up unusable reset/resend tokens when email delivery is rejected.
  - `/health/launch-readiness` now distinguishes optional OpenSearch from required worker provider URLs.
- Re-verified after the worker/auth/search batch:
  - Server TypeScript build passes with `npm run build`.
  - Server Jest passes with `npm test -- --runInBand --forceExit`: 26 suites, 120 tests.
  - Backend `http://localhost:5000/health` returns healthy.
  - Frontend `http://localhost:3000` returns HTTP 200.
- Gated public fallback/demo data and removed another mock dashboard source:
  - `client/src/lib/runtime-config.ts` now exposes `arePublicFallbacksEnabled()`, defaulting public fallback data off unless `NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS=true`, `NEXT_PUBLIC_ENABLE_PUBLIC_FALLBACKS=true`, or server-side `ATHENA_ENABLE_PUBLIC_FALLBACKS=true` is set.
  - `client/src/app/api/[...path]/route.ts` no longer serves curated fallback jobs/feed/videos/search/health unless public fallbacks are explicitly enabled.
  - Public jobs, job details, feed, and video feed pages now show honest unavailable/empty states instead of automatically swapping in fallback jobs, posts, or sample videos.
  - `client/src/components/studios/formation/FormationDashboard.tsx` no longer initializes from fake TechVenture/cofounder/compliance data; it maps real formation registrations and marks cofounder/compliance sections as not connected.
- Re-verified after public fallback gating:
  - Client production build passes with `npm run build`.
  - Backend `http://localhost:5000/health` returns healthy.
  - Frontend `http://localhost:3000` returns HTTP 200.
  - Frontend proxy `http://localhost:3000/api/jobs?limit=1` returns live backend data without `x-athena-fallback`.

### 2026-06-29

- Continued removing studio/demo data from authenticated surfaces:
  - `client/src/lib/hooks/useMentor.ts` now reads mentor sessions from the live `/api/mentors/sessions?role=mentor` route, normalizes backend session statuses for the calendar UI, and routes confirm/cancel/complete actions through the current status endpoint.
  - `client/src/components/studios/mentor/MentorCalendar.tsx` no longer ships January 2026 sample sessions or default availability slots; it starts from the current date and shows live loading, empty, and error states.
  - `client/src/components/studios/formation/CofounderMatching.tsx` no longer ships invented co-founder profiles, random match simulation, or fake connection/view counts; it now reports that matching is not connected until a live endpoint exists.
  - `client/src/components/studios/mentor/SessionManagement.tsx` no longer defaults to a fabricated mentor session and now requires a real session prop.
  - `client/src/components/studios/events/EventsCalendar.tsx` now loads from `/api/events`, maps live registration/save state, and no longer ships hardcoded January/March 2026 event examples.
  - `client/src/components/studios/mentor/EarningsDashboard.tsx` no longer ships fake revenue charts, payout methods, transaction history, withdrawal balances, or tax profile documents; unconnected earnings/payout/tax areas now show disabled controls and honest empty states.
  - `client/src/components/studios/employer/JobsManagerKanban.tsx` no longer initializes to a fake job or fabricated applicant pipeline; it now starts empty with disabled controls until live jobs/applications are connected.
  - `client/src/components/studios/employer/CandidateProfileViewer.tsx` no longer defaults to a fabricated candidate, sample resume/interview history, canned AI insights, or sample job requirements; it now requires live candidate data and shows an honest no-profile state otherwise.
  - `client/src/components/studios/organization/OrganizationPage.tsx` no longer initializes a fake organization, generated team, sample jobs, company posts, or similar organizations; it now renders from passed live data and shows empty states when none is connected.
  - `client/src/components/studios/community/CommunityGroupHome.tsx` no longer initializes a fake community, members, discussion posts, or events; it now renders from passed live data and shows disconnected states for posting, membership, messaging, and events.
  - `client/src/components/studios/learner/BadgeWallet.tsx` no longer initializes fake earned credentials, issuer names, verification links, or 2025/2026 badge dates; it now accepts live badges and defaults to an honest no-credentials state with disconnected share/download/visibility controls.
- Re-verified after the mentor/formation/events/earnings/employer/organization/community/badge-wallet studio cleanup:
  - Client production build passes with `npm run build`.

### 2026-06-30

- Continued the learner studio cleanup:
  - `client/src/components/studios/learner/StudentClassroomView.tsx` no longer bundles a Product Management sample course, named fake learners/instructors, canned Q&A, saved notes, or transcript copy; it now accepts live classroom data and renders loading, error, and no-course states when no course is connected.
  - `client/src/components/studios/learner/SkillsAssessmentUI.tsx` no longer ships a JavaScript/React/Python/SQL demo catalog, canned quiz questions, fabricated topic scores, fake recommendations, or automatic badge claims; it now requires caller-provided skills/questions and only computes results from those live questions unless a submit handler returns a server result.
- Re-verified after the learner classroom/assessment cleanup:
  - Client production build passes with `npm run build`.
- Continued the educator/settings studio cleanup:
  - `client/src/components/studios/educator/CourseBuilderPortal.tsx` no longer ships a Product Management course, sample modules, sample lessons, fake pricing, fabricated outcomes, or canned AI suggestions; it now accepts a live initial course or starts from an empty draft with disconnected save/publish/suggestion states.
  - `client/src/components/studios/settings/PrivacyCenterDashboard.tsx` no longer ships fake privacy scores, enabled profile/communication preferences, connected OAuth apps, export sizes, or simulated data export progress; it now renders from live props and shows empty/disconnected states when account privacy data is absent.
  - `client/src/components/studios/settings/SafetyCenterAccess.tsx` no longer ships fake security checks, active sessions, login activity, password age, 2FA QR secrets, manual setup codes, or backup codes; it now renders from live props and shows empty/disconnected states when security data is absent.
  - `client/src/app/dashboard/community/page.tsx` had a stale duplicated tail with hardcoded events and leaderboard members after the component close; that dead JSX was removed and the live-wired community sidebar remains.
- Re-verified after the educator/settings/community cleanup:
  - Client production build passes with `npm run build`.
- Continued dashboard/auth cleanup:
  - `client/src/app/dashboard/events/page.tsx` no longer anchors the calendar strip to a stale January 2026 fallback week before hydration; it now shows a loading strip until the current week is available.
  - `client/src/app/dashboard/settings/security/page.tsx` no longer locally toggles 2FA, fabricates a current session when the backend returns none, calls nonexistent session routes, or leaves account deletion as a decorative button.
  - `server/src/routes/auth.routes.ts` now provides `POST /api/auth/change-password` and `DELETE /api/auth/sessions/:sessionId`, including password verification, password policy enforcement, session ownership checks, and revocation of other active sessions after a password change.
  - `client/src/app/dashboard/page.tsx` no longer displays fake profile views, search appearances, saved-job counts, growth deltas, hardcoded opportunity signal counts, or invented intelligence-signal copy; visible dashboard metrics now come from existing recommendations, applications, saved jobs, feed, and profile data.
- Re-verified after the dashboard/auth cleanup:
  - Server TypeScript build passes with `npm run build`.
  - Client production build passes with `npm run build`.
  - Targeted server auth Jest suites pass with `npm test -- --runInBand --forceExit src/__tests__/auth.test.ts src/__tests__/auth.happy.test.ts`: 2 suites, 12 tests.
- Added CI-friendly validation hooks for launch readiness and auth/session flows so the server can enforce those gates locally and in automation.
- Validation scripts now execute as real CLI gates:
  - `server/src/scripts/validate-launch-readiness.ts` reports launch-readiness and worker configuration checks and exits non-zero on failure.
  - `server/src/scripts/validate-auth-session-routes.ts` reports change-password and session-revocation route checks and exits non-zero on failure.
  - Root `validate:server` and `ci:launch` scripts run those gates, and GitHub Actions runs them after the server test suite.
  - `server/.env.example` now documents `VIDEO_ALLOW_SIMULATION` plus the production worker provider URL and simulation toggles.
- Re-verified after the CI validation batch:
  - `npm run validate:server` passes.
  - Targeted server Jest suites pass with `npm test -- --runInBand --forceExit src/__tests__/worker-config.test.ts src/__tests__/launch-readiness-ci.test.ts src/__tests__/auth-session-gate.test.ts src/__tests__/auth.test.ts src/__tests__/auth.happy.test.ts`: 5 suites, 17 tests.
  - Server TypeScript build passes with `npm run build`.
  - Client production build passes with `npm run build`.
  - Full server Jest passes with `npm test -- --runInBand --forceExit`: 29 suites, 125 tests.
- Continued authenticated dashboard cleanup:
  - `client/src/app/dashboard/learn/page.tsx` no longer shows fixed 12.5K student, 95% completion, 4.8 rating, default 5.0 rating, 2h 30m duration, 12-lesson, placeholder image, or unsupported category/level/sort metadata. Course filters now use the live course API fields, and catalog stats come from the current response.
  - `client/src/app/dashboard/learn/my-courses/page.tsx` no longer shows a fabricated 7-day learning streak, fake hours watched/certificate counts, placeholder thumbnails, or nonexistent `/continue` and `/certificate` routes. It now renders live enrollment progress and provider/course metadata only.
  - `client/src/app/dashboard/settings/notifications/page.tsx` now renders the persisted notification preference object from `/api/notifications/preferences`, saves the backend-supported `email`/`push`/`inApp` shape, and removes unsaved digest toggles plus local-only preference defaults.
- Re-verified after the learning/notification cleanup:
  - Client production build passes with `npm run build`.

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
- [x] Harden worker startup and queue Redis requirements for production.
- [x] Make OpenSearch optional launch scope explicit and initialize it when configured.
- [x] Tighten auth email failure handling for registration, reset, and resend flows.
- [x] Gate public fallback data behind explicit demo flags.
- [x] Remove hardcoded formation studio mock business/cofounder/compliance data.
- [x] Remove hardcoded mentor calendar, co-founder matching, and mentor session-room demo data.
- [x] Remove hardcoded events studio demo calendar data.
- [x] Remove hardcoded mentor earnings, payout, and tax dashboard demo data.
- [x] Remove hardcoded employer applicant kanban job/candidate demo data.
- [x] Remove hardcoded employer candidate profile demo data.
- [x] Remove hardcoded organization profile/team/jobs/posts demo data.
- [x] Remove hardcoded community group/member/post/event demo data.
- [x] Remove hardcoded learner badge wallet credential demo data.
- [x] Remove hardcoded learner classroom course/Q&A/notes/transcript demo data.
- [x] Remove hardcoded learner skills assessment catalog/question/result demo data.
- [x] Remove hardcoded educator course-builder course/curriculum/AI suggestion demo data.
- [x] Remove hardcoded privacy center score/preferences/apps/export demo data.
- [x] Remove hardcoded safety center security/session/activity/2FA/password demo data.
- [x] Remove stale hardcoded community dashboard event/leaderboard JSX tail.
- [x] Remove hardcoded dashboard home metric/signal counts.
- [x] Remove stale dashboard events fallback week.
- [x] Add real change-password and session-revoke auth routes for security settings.
- [x] Align dashboard security settings with live session/auth routes.
- [x] Add CI validation gates for launch readiness and auth/session route coverage.
- [x] Remove hardcoded learning catalog/course-progress stats, ratings, durations, lessons, streaks, and certificate fallbacks.
- [x] Align notification settings with persisted backend preferences instead of local-only defaults.
- [ ] Provision Redis and provider URLs, then enable workers intentionally in production.
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
