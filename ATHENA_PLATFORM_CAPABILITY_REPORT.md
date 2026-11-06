# ATHENA Platform Atlas

**Capability map, gap register and enhancement roadmap, read from the code as of 6 September 2026.**

Scope: `athena-platform/` (Express + Prisma API, Next.js web app, Expo mobile app, FastAPI ML service, Terraform, CI). Every statement below is grounded in a file, a route, a model or a check that exists in the repository today. Where something only works under a simulation flag or needs an external service that is not in this repository, it is labelled as such.

---

## 1. The platform by the numbers

| Layer | Size | Notes |
|---|---|---|
| API | 746 route handlers in 74 route files | Express, TypeScript, Prisma 6 on Neon Postgres |
| Data model | 166 Prisma models, 84 enums, 44 migrations | Additive migrations applied by `prisma migrate deploy` on push |
| Web app | 205 pages, 129 components, ~110k lines | Next.js 16, React 18, React Query, Zustand, Tailwind |
| Server tests | 90 Jest suites, 617 tests, ~13.6k lines | Route suites use supertest against a mocked Prisma |
| Web tests | 3 unit suites (21 tests), 5 Playwright specs (~1,170 lines) | Smoke spec runs in CI |
| Mobile app | 21 screens, ~13.8k lines, 0 tests | Expo, React Navigation, React Query v4 |
| ML service | 6 FastAPI routers, ~2.8k lines Python | No trained model artefacts in the repository |
| Infrastructure | Terraform: 4 regional VPCs, RDS, ElastiCache, 4 S3 buckets, 4 ECS clusters; docker-compose with 11 services | Web deploys to Netlify; API via GitHub Actions |
| Health of the surface | 151 API routes with no web caller; 25 built components never mounted (~15k lines); ~50 pages with no data call; 13 known dead buttons; 30 known broken doc citations | All four are tracked by committed scripts so they can only shrink |

How to read the status labels used throughout:

- **Working** — server route, web UI and (usually) tests all exist.
- **API only** — the server does it; nothing in the web or mobile app calls it.
- **UI only** — a component or page exists but is either unmounted or static (no data call).
- **Simulated** — works in development through a fallback; production refuses it unless an `*_ALLOW_SIMULATION` flag is set.
- **External** — the code is a client for a service that must be provisioned outside this repository.

---

## 2. Executive summary

1. **The core social-career product is real and deep.** Identity and sessions, the community feed and post model, direct messaging, reels and live streaming, jobs and applications, safety and moderation, GDPR tooling and the admin console are all implemented end to end with server tests. This is the part of ATHENA a member can use today.
2. **The verticals have their first step and not their second.** Grants, investors, vendors, housing and insurance each have apply, introduction, review, inquiry and application routes wired to their pages (an earlier draft of this report said otherwise; it had missed multi-line route declarations). What is missing is the other side of each: nobody answers a grant application, an insurance application or a housing inquiry inside the platform, vendors cannot respond to an RFP because a vendor is a directory entry rather than an account, and accelerator payment and progress have no screen.
3. **A large amount of finished work is invisible.** 151 API routes have no caller: mentor booking (11), DV Safe Mode (15), group chat (10), reference checks (8), gamification (8), analytics (8). 25 substantial components (a formation wizard, a course builder, a classroom, a mentor calendar, an ATS kanban) are never rendered. Wiring these up is the cheapest way to grow the product.
4. **Production readiness hinges on services that are not in this repository.** Video transcoding, push delivery and DSAR export all call an external processor URL. Without those services, in production reels do not publish, push never sends and data exports never arrive. The `launch-readiness` endpoint will report `not_ready` until they exist.
5. **Configuration has drifted.** The production env file in the working tree names keys the code no longer reads (`STRIPE_PRICE_STARTER/PRO/ENTERPRISE`, `OPENSEARCH_URL`, SES email settings) and omits ones it requires (`STRIPE_PRICE_CAREER…CREATOR`, `SENDGRID_API_KEY`, `OPENSEARCH_NODE`, `S3_BUCKET`, `ML_SERVICE_URL`, `DV_ENCRYPTION_KEY`, `METRICS_TOKEN`, the three processor URLs).
6. **The mission-critical safety feature has no front door.** DV Safe Mode (encrypted safe chats with access codes, panic, clear traces, emergency contacts) is fully built on the server and has no screen anywhere.
7. **The ML service is a sidecar, not a dependency.** Only the health check and the worker reference it. Feed ranking, mentor match, career compass and trust scores are computed heuristically in Node. The Python service, its configs and its six routers are unused by product code.
8. **Mobile lags the web by a wide margin.** Feed, reels, jobs, channels, DMs, notifications and profile exist; posting, comments on posts, stories, groups, events, mentors, learning, finance and safety do not. Declared versions (Expo SDK 54 with React Native 0.73.6 and React Query 4) are inconsistent and need verifying before a build is attempted. There are no tests.
9. **Internationalisation is declared, not delivered.** 26 locales are registered; each translation file is 0.4–1 KB. The product is English.
10. **The security documentation set is written but uncommitted.** Threat model, authorisation matrix, incident response, PIA, data inventory, retention, AI system card, trust-claims register and `SECURITY.md` exist only in the working tree.

---

## 3. Capability map by domain

Each domain lists what works today (with the evidence), the gaps, and the enhancements worth making.

### 3.1 Identity, accounts and account security — Working

**Today.** Registration requires a women self-attestation and accepts invite and referral codes. Login supports email/password with TOTP two-factor and recovery codes, plus Google and Facebook OAuth. Access tokens are short-lived JWTs; refresh tokens rotate in an HttpOnly cookie with reuse detection that revokes every session on replay. Members can list sessions, end one, or end all; the list now marks the caller's own device correctly. Password change, email verification, forgot/reset, failed-login tracking and lockout, suspended-account handling and new-device sign-in alerts (in-app and email, added 6 Sep) are in place. The Socket.IO handshake now honours the same session store and suspension rules as HTTP. Woman verification is a self-request that an admin approves; verification badges exist for identity, employer, educator, mentor and creator.

**Gaps.** Woman and identity verification are manual admin reviews with no document or liveness provider. No passkeys or WebAuthn. `LINKEDIN_CLIENT_ID` is in the env template but there is no LinkedIn route. Admin accounts are not required to enable two-factor. Sessions show a raw user-agent and IP rather than a device name and place.

**Enhance.** Add an identity-verification provider (Stripe Identity or Onfido) behind the existing `VerificationRequest` shape; enforce two-factor for `ADMIN`; add passkeys; resolve IP to city for the sessions list and sign-in alerts; add step-up authentication for payouts and data export.

### 3.2 Community and social — Working

**Today.** Posts of eight types (text, image, video, article, job share, course share, poll, win) with media and alt text, five reaction types, threaded comments with likes, pinning, editing, reporting and author controls (comments off), reposts and quotes, `@` mentions and `#` topics with follow and trending, link preview cards, scheduled posts, drafts, a sensitive-content gate, saved posts with collections, a pinned profile post, per-post insights with impressions and reach milestones, and "who reacted". Stories have audiences, close friends, view lists and highlights. Follows, follow requests and profile visibility (public / connections / private) gate every list. Blocks are symmetric and sever ties; muted words filter posts and comments. The feed has chronological, engagement and personalised modes with "why this" reasons, a member-set follow/discovery mix, "see fewer from", topic suggestions for cold start and a live "new posts" pill. Groups have privacy, roles, join requests and moderation, and group posts are real posts. Events support registration and saving.

**Gaps.** Audience is per profile, not per post (a single `isPublic` flag). Group join requests can be approved or denied only through the API; no screen calls those five routes, so a private group cannot admit anyone from the app. Group chat (10 routes) has no UI. Gamification (XP, streaks, check-ins, leaderboards) is API only apart from an achievements panel. Comment threads are flattened to one level on screen. No "restrict" (soft block), no edit history, no hashtag-following pages beyond the topic page.

**Enhance.** Per-post audience picker (public / followers / close friends). Join-request inbox for group admins and a group chat tab. Surface streaks, XP and leaderboards on the community page. Restrict mode. A post analytics timeline for authors. Comment depth to two levels with "view replies".

### 3.3 Messaging — Working

**Today.** One-to-one conversations with attachments, voice notes, quoted replies, emoji reactions, delivered and read receipts, typing indicators, disappearing messages with four TTLs and a sweep, in-thread search, unsend and 15-minute edit with live delivery (added 6 Sep), "who can message me", block enforcement and rate limits on both HTTP and socket paths. Channels (24 routes) offer discovery, membership, pinned messages, search and read state. Group chat exists on the server.

**Gaps.** Mute, archive and pin of a conversation exist only in client state; there is no API or persistence. No message requests inbox for strangers. No group direct messages (conversations are strictly two people). No forwarding, no per-thread media gallery, no link previews in messages. Push delivery is absent (see 3.14), so a closed tab misses messages.

**Enhance.** Persist mute/archive/pin on `ConversationParticipant`. Message requests for non-connections. Group conversations by generalising the participant model. Forward and media gallery. Push.

### 3.4 Video, reels, sounds and live — Working with external dependencies

**Today.** Upload with an ffmpeg pipeline (thumbnail, probe, formats) that runs locally in development and calls `VIDEO_PROCESSOR_URL` in production; processing status; feed, trending, category and per-user browsing; likes, comments with pinning, saves, duets, a sounds library, viewer state, sensitive posts, "send this reel" and "see fewer from". Live streams have create/start/end, RTMP key validation and an RTMP webhook, chat over sockets, gifts, wallet, leaderboard and a live viewer count.

**Gaps.** The production video processor is external and not in this repository. Captions are simulated in development and require the processor in production. RTMP ingest needs an external media server. No recording of lives to VOD, no scheduled lives, no trimming or filters, limited video analytics.

**Enhance.** Adopt a managed pipeline (Mux or Cloudflare Stream) for transcoding, HLS and captions, and Mux Live or LiveKit for ingest with automatic VOD. Add a reel scheduler and creator analytics per reel.

### 3.5 Creator economy and payments — Working, partly simulated

**Today.** Stripe subscriptions with checkout, portal and cancel; a webhook that handles checkout completion, subscription updates and deletion, and payment-intent lifecycle. Creator profiles, tiers, gift balance purchases and gift transactions, payout requests and history, Stripe Connect accounts with onboarding, status, escrow create/capture/cancel, earnings and payout methods. Invoices with PDF. A payments orchestration layer routes by region.

**Gaps.** Regional providers (PayPal, Wise, GCash, GrabPay, M-Pesa, Pix, UPI) are stubs that return a simulation outside production. The escrow, gift-send and generic payout routes have no caller, so marketplace orders are not actually escrowed from the app. Subscription price IDs in the production env file do not match the tiers the code reads. No refund, dispute or dunning handling beyond a `past_due` status. No GST-compliant tax invoice fields. No in-app purchase path for mobile.

**Enhance.** Wire skills-marketplace orders through escrow; finish Connect payout UX; handle `charge.refunded` and `charge.dispute.*`; dunning emails; AU GST invoices; Apple and Google IAP for mobile subscriptions; retire simulated providers from production pricing pages.

### 3.6 Jobs, employers and careers — Working, ATS unmounted

**Today.** Job search, detail, apply, save, recommendations, application tracking and updates, job publishing, employer organisations with team, jobs, applications, analytics and education outcomes, organisation pages, salary equity submission and analysis (the older simulated salary API is deliberately disabled), and apprenticeships with featured, categories, recommendations, bookmarks, applications, milestones, progress and certificates.

**Gaps.** Reference checks (request, batch, send, submit, decline, summary: 8 routes) have no UI. Apprenticeship providers cannot create, edit or publish from the app (3 routes unreachable). The ATS pieces `JobsManagerKanban` (784 lines) and `CandidateProfileViewer` (833) are built and never mounted. No job alerts, no resume upload and parsing, no interview scheduling.

**Enhance.** Mount the kanban and candidate viewer; build the reference-check screens for applicants and referees; saved-search alerts by email; resume parsing to prefill applications; interview slots on the mentor-scheduling engine.

### 3.7 Learning, mentorship and the skills marketplace — Working, booking API only

**Today.** Courses (list, detail, enrol, my courses, recommendations), education providers with applications, learn pages, mentor profiles with Stripe onboarding, mentor matching scores, a complete scheduling engine (availability, timezones, book, respond, cancel, complete, rate), and a skills marketplace with services, categories, favourites, orders (accept/complete), requests with proposals, bookings and reviews.

**Gaps.** All 11 mentor-scheduling routes are unreachable from the web: a mentee cannot book a session. Marketplace bookings and reviews (4 routes) have no UI. No course authoring, lesson player or classroom, although `CourseBuilderPortal` (979 lines), `StudentClassroomView` (798), `SkillsAssessmentUI` (826), `BadgeWallet` (585), `MentorCalendar` (854), `SessionManagement` (909) and `EarningsDashboard` (700) exist unmounted. No video-call integration. Course certificates do not exist (apprenticeship ones do).

**Enhance.** A booking calendar for mentees and a session manager for mentors on the existing engine; video sessions via Daily or Twilio; mount and finish the builder and classroom; course certificates; skills assessments.

### 3.8 Business: formation, capital and back office — Mostly catalogues

**Today.** Business registration with a state machine, submission and Stripe payment intents; accelerator cohorts and enrolment; grants, investors, vendors and RFPs as list and detail; accounting with accounts, journals (post and void) and a trial balance; tax rates and returns; inventory items, locations, transactions and stock levels; money transactions; invoices.

**Gaps.** Grant applications, investor introductions, vendor reviews and RFP creation all work from their pages, but each stops at submission: no provider, investor or agent side exists in the platform to answer, so statuses only change by hand. Vendors cannot respond to an RFP: `RfpResponse` has no create route, and a `Vendor` is a directory entry, not an account, so there is nobody to respond as. Formation has no registry integration (no ASIC or ABR call) and its payment routes have no caller. Accelerator payment and progress routes are unreachable. Accounting has no profit and loss or balance sheet, no bank feeds, no BAS. Tax returns cannot be lodged. `IncorporationWizard` (1,111 lines), `FormationDashboard` (649) and `CofounderMatching` (648) are unmounted.

**Enhance.** A provider side for grants and a vendor account type so RFPs can be answered; ABR/ABN lookup and ASIC Connect for formation; bank feeds (Basiq) with reconciliation; P&L, balance sheet and BAS reports; mount the wizard and dashboard.

### 3.9 Finance and housing — Catalogues

**Today.** Savings goals with contributions, insurance products, superannuation accounts, a financial health score, housing listings.

**Gaps.** Insurance applications and housing inquiries can be submitted, and nothing happens next: no insurer or agent side exists to answer them. No open banking, no insurer or super fund integration. `dashboard/finance` and `dashboard/earnings` pages make no data calls.

**Enhance.** An agent side for housing inquiries with a safety-aware contact flow; insurance applications handed to partners; open banking for balances and spending; a real earnings page from Connect and gift data.

### 3.10 Impact and community support — Working with a missing front door

**Today.** Support programs with enrolment and milestones, Indigenous community pages with join and resources, language profiles, international credentials, bridging programs, impact metrics, reports and partners, DV support services, safety plans, accessibility profiles and disability-friendly employers. DV Safe Mode on the server: encrypted safe chats with access codes, panic, clear traces, emergency contacts, safe notifications and per-viewer visibility, keyed by `DV_ENCRYPTION_KEY`.

**Gaps.** DV Safe Mode has no screen: all 15 routes are unreachable. `SafetyCenterAccess` (727 lines) is unmounted. The public impact page is static (correctly, it makes no numeric claims). No SMS provider despite an SMS channel being declared.

**Enhance.** Build the safe-mode experience with quick exit, disguised entry and no-trace navigation, reviewed with a DV specialist; connect 1800RESPECT-style directories through partner APIs; generate impact reports from `UserOutcome` and `ProviderOutcome` rather than by hand.

### 3.11 AI and ML — Working with OpenAI, ML service unwired

**Today.** Resume optimiser, career path, interview coach with feedback, content generator, idea validator, opportunity radar, an AI chat with usage quotas, social content enrichment and text moderation, all on OpenAI when a key is present. Career compass, opportunity scan, salary equity, mentor match, trust score, creator analytics and projections and feed preferences run as Node heuristics. A concierge with an FAQ knowledge base and OpenAI fallback (5 routes, no caller).

**Gaps.** The FastAPI ML service (career compass, feed generation, income stream, mentor match, rankers, safety score) is referenced only by the health check and the worker; no product path calls it and no model artefacts are committed. Without an OpenAI key, production AI routes fail unless `AI_ALLOW_SIMULATION` is set. No evaluation harness, no prompt-injection defences or retrieval isolation documented, no provider abstraction, no streaming.

**Enhance.** Route the personalised feed through the ranker with an offline evaluation set; ship model artefacts or drop the service; add a guardrail layer and an AI system card to the committed docs; abstract the provider so Anthropic or OpenAI can be swapped; stream chat responses; surface the concierge as onboarding help.

### 3.12 Safety, trust and moderation — Working

**Today.** Reports on posts, comments, videos, users, messages and channels; auto-hide at report thresholds; a UK Online Safety Act-shaped report service with priorities, moderation actions and authority escalation; moderation logs; appeals; trust scores; blocks that sever follows, requests and close-friend ties; muted words; the sensitive gate; image moderation via Rekognition and text via OpenAI moderation; an admin queue with claim and action; a transparency report; safety centre and report pages.

**Gaps.** Appeal review routes are admin-only and unreachable from the admin UI. There is no moderator role between `USER` and `ADMIN`. No SLA tracking on the queue. No hash matching for known abuse imagery. Spam detection is rate limits only.

**Enhance.** A `MODERATOR` role and queue SLAs; appeals screen; PhotoDNA or similar hash matching; a spam classifier on links and repeated text; a "restrict" option for members.

### 3.13 Compliance and privacy — Working, UK-first

**Today.** Cookie consent, granular consents, DSAR export, delete, rectify and restrict with download tokens, records of processing, DPIAs, retention policies, data categories, region configuration and pricing, subprocessors, data transfers, legal documents and agreements, breach register with deadlines, legal holds, privacy centre, audit logs and an admin GDPR summary.

**Gaps.** DSAR export runs through a worker that needs `DATA_EXPORT_PROCESSOR_URL` in production or the request never completes. The code is written to UK GDPR and the Online Safety Act; the venture is in Queensland and Australian Privacy Principles and the Notifiable Data Breaches scheme are not modelled. Legal documents are drafts. The security documentation set is uncommitted.

**Enhance.** Produce exports in-process from the existing `gdpr.service`; add an APP-aligned privacy notice and a 30-day NDB assessment flow to the breach register; commit and CI-check `docs/security`; version consents.

### 3.14 Notifications, search, engagement and referrals — Mixed

**Today.** In-app notifications with per-kind preferences, grouping and socket delivery; SendGrid email; unified and per-type search with suggestions and trending on OpenSearch with a Prisma fallback; referral codes, tracking, completion, leaderboard and share links.

**Gaps.** Push requires `firebase-admin` (not installed) or an external `PUSH_NOTIFICATION_PROVIDER_URL`; today nothing is pushed. No web push, no digests. SMS has no provider. The fallback search is substring matching. Gamification is API only.

**Enhance.** Expo push for mobile and Web Push for the browser through the existing `PushToken` model; daily and weekly digests; OpenSearch in production; a streak and leaderboard surface.

### 3.15 Admin and operations — Working, marketing suite static

**Today.** Users, content, moderation queue, jobs, subscriptions and grants, invite codes, woman verification, groups and events, engagement and revenue analytics, audit logs, GDPR summary, breaches, legal holds, maintenance mode, an ops summary and a feature-flag API.

**Gaps.** The ten admin marketing and GTM pages, the developer console and API reference, the public status page and the persona dashboards make no data calls. Feature flags have no admin screen. Eight analytics routes are unreachable.

**Enhance.** Either wire the marketing suite to real tables (waitlist, referrals, campaigns) or remove it; a feature-flag switchboard; a status page fed by `/api/health/detailed`; API keys if the developer console is to be real.

### 3.16 Mobile app — Partial

**Today.** Login, register, forgot and reset with social sign-in; a posts feed with likes; the reels feed with comments; jobs with detail, saved jobs and applications; channels; direct messages over sockets; notifications; profile view and edit; settings; apprenticeships; skills marketplace; help; push registration; offline sync; analytics.

**Gaps.** No composer, no post comments, stories, groups, events, mentors, learning, finance, safety or two-factor prompt. Declared versions are inconsistent (Expo SDK 54 expects React Native 0.81; the app pins 0.73.6 and React Query 4). No tests. Push depends on the server side that does not send.

**Enhance.** Align the Expo SDK and dependencies and get a green EAS build; add a parity roadmap starting with the composer, comments, stories and notifications deep links; a Detox or Maestro smoke suite.

### 3.17 Platform engineering — Solid foundations

**Today.** CI runs typecheck, build, the API-contract check, doc-reference check, dead-interaction check and the full Jest suite for the server, plus typecheck, unit tests, build and Playwright for the web; deploys apply migrations. Sentry, a token-protected Prometheus `/metrics`, `health`, `live`, `ready`, `detailed`, `launch-readiness` and `version` endpoints, request IDs and response-time headers. Redis sliding-window rate limiting with social ceilings per member, Helmet plus a custom CSP and security headers, a destructive-migration guard for the shared database, a Terraform multi-region skeleton and a full docker-compose stack.

**Gaps.** Rate limiting fails open when Redis is absent. Three pre-existing ESLint errors. 30 known broken documentation references. Web unit tests are three files. No accessibility test pass. Translation coverage is nominal. The Terraform is a skeleton without task definitions, load balancers or DNS.

**Enhance.** Fail closed on auth routes when Redis is down; burn down the lint, doc and dead-interaction baselines; add Testing Library coverage for the post card, chat window and comment section; axe checks in Playwright; either translate the top 300 strings for the launch locales or trim the locale list.

---

## 4. Gap register

| # | Gap | Severity | Evidence |
|---|---|---|---|
| 1 | DV Safe Mode has no UI | Critical | 15 unreachable routes under `/api/safety/dv`; `SafetyCenterAccess` unmounted |
| 2 | Video processing, push and DSAR export need processors that are not in the repo | Critical | `VIDEO_PROCESSOR_URL`, `PUSH_NOTIFICATION_PROVIDER_URL`, `DATA_EXPORT_PROCESSOR_URL` in `worker-config.ts`; `firebase-admin` not installed |
| 3 | Production config drift | Critical | `launch-readiness` expects `STRIPE_PRICE_CAREER…CREATOR`, `SENDGRID_API_KEY`, `OPENSEARCH_NODE`, `S3_BUCKET`, `ML_SERVICE_URL`, `DV_ENCRYPTION_KEY`, `METRICS_TOKEN`; the production env file names others |
| 4 | Mobile dependency versions inconsistent; zero tests | Critical | `mobile/package.json` |
| 5 | Security documentation uncommitted | Critical | `docs/security/*`, `SECURITY.md` untracked |
| 6 | Mentor booking API only | High | 11 unreachable `/api/mentoring` routes |
| 7 | Reference checks API only | High | 8 unreachable `/api/references` routes |
| 8 | Group join-request moderation and group chat API only | High | 5 + 10 unreachable `/api/groups` routes |
| 9 | Vertical flows stop at submission: no provider side for grants, insurance or housing; vendors cannot answer RFPs | Medium | `RfpResponse` has no create route and `Vendor` is not an account; applications and inquiries have no responder |
| 10 | 25 finished components unmounted (~15k lines) | High | `docs/UNREFERENCED-UI-COMPONENTS.md` |
| 11 | Admin marketing suite, developer console, status page, persona dashboards static | High | Zero data calls in those pages |
| 12 | ML service unwired | High | Only `health.routes.ts` and `workers.service.ts` import `ml.service` |
| 13 | Regional payment providers simulated; escrow and gift-send unreachable | High | `payments-orchestration.service.ts`; 3 `/api/connect/escrow*` and `/api/creator/gifts/send` unreachable |
| 14 | i18n nominal | High | Locale files 0.4–1 KB each |
| 15 | Web and mobile test coverage thin | High | 3 web unit suites; 0 mobile |
| 16 | Gamification API only | Medium | 8 unreachable `/api/engagement` routes |
| 17 | Conversation mute/archive/pin not persisted | Medium | Client store only |
| 18 | No message requests, group DMs, forwarding | Medium | Conversation model is two participants |
| 19 | Appeals review unreachable; no moderator role | Medium | `/api/appeals` admin routes; `UserRole` enum |
| 20 | Woman/identity verification manual | Medium | `user.routes.ts` self-request; no provider |
| 21 | Rate limiting fails open without Redis | Medium | `rateLimiter.ts` |
| 22 | Formation has no registry integration; accounting lacks P&L/BS; tax cannot lodge | Medium | `formation.service.ts`, `accounting.routes.ts`, `tax.routes.ts` |
| 23 | AU privacy law not modelled | Medium | UK/EU-first compliance code |
| 24 | Concierge and analytics routes unreachable | Low | 5 + 8 routes |
| 25 | Feature flags have no admin UI | Low | 6 unreachable routes |
| 26 | 13 dead buttons, 30 broken doc citations, 3 lint errors | Low | Baselines in `client/scripts`, `server/scripts`; ESLint |

---

## 5. Enhancement roadmap

### Now (weeks 1–6): make what exists reachable and production-true

1. Provision or replace the three processors: managed video (Mux/Cloudflare Stream), Expo and Web Push through `PushToken`, in-process DSAR export. Re-run `launch-readiness` until it reports `ready`.
2. Reconcile production configuration with the readiness checks; rotate anything that has lived in a working tree.
3. DV Safe Mode UI, designed with a specialist, on the 15 existing routes.
4. Mentor booking calendar and session manager on the scheduling engine; mount `MentorCalendar` and `SessionManagement` where they fit.
5. Group join-request inbox and group chat tab.
6. Commit `docs/security` and `SECURITY.md`; add them to the doc-reference check.
7. Align the mobile SDK and get a green EAS build.

### Next (weeks 6–12): finish the verticals and the money

1. A provider side for grants, insurance and housing so applications get answered in the platform, and vendor accounts so RFPs can be responded to.
2. Escrow-backed marketplace orders, refunds and disputes, dunning, GST invoices.
3. ATS: mount the kanban and candidate viewer; reference-check screens; job alerts.
4. Course builder and classroom on the unmounted components; course certificates.
5. Gamification surfaces; per-post audience; restrict mode; persisted conversation settings and message requests.
6. Moderator role, queue SLAs, appeals screen.

### Later (months 3–6): differentiate

1. Wire the ranker and mentor-match models with an offline evaluation set, or retire the ML service.
2. AU privacy alignment (APPs, NDB) and an AI system card in the committed docs.
3. Identity verification provider and passkeys.
4. Open banking, BAS and P&L for the back office; ABR/ASIC for formation.
5. Live-to-VOD, scheduled lives, reel scheduling and creator analytics.
6. Mobile parity: composer, comments, stories, groups, safety; IAP.
7. Real translation for two or three launch locales; accessibility testing in CI.

---

## 6. Suggested measures of done

- `GET /api/health/launch-readiness` returns `ready` in production.
- `check-api-contract --unreachable` below 60 routes (from 151), with each remaining route justified.
- `UNREFERENCED-UI-COMPONENTS.md` below 10 entries (from 25).
- Dead-interaction and doc-reference baselines at zero.
- A member can: book a mentor, enter safe mode, join a private group, be pushed a message, apply for a grant, and receive a data export, all from the app.
- Mobile builds on EAS and runs a smoke suite in CI.

---

*Method: route handlers counted from `router.<verb>(` declarations (a first pass missed multi-line declarations and overstated gap 9; corrected 6 September); models from `schema.prisma`; pages from `app/**/page.tsx`; reachability from `server/scripts/check-api-contract.js --unreachable`; unmounted components from `docs/UNREFERENCED-UI-COMPONENTS.md`; static pages from the absence of any API or query call; simulation behaviour from `*_ALLOW_SIMULATION` guards in the services named. The 6 September 2026 work (socket hardening, link-preview redirect checks, unified post visibility, comment editing, who reacted, DM unsend/edit, sign-in alerts) is included as shipped.*
