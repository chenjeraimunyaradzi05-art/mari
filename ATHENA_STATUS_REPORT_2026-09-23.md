# ATHENA — Platform Status Report

**Date:** 23 September 2026
**Method:** 64 independent audit agents read the code directly across 14 areas — 10 product domains plus deployment, test quality, security, and plan-vs-reality. Each domain was audited twice: one agent catalogued what exists, a second went back into the code independently to find what was missing. 83 claimed blockers were produced; 40 were then handed to adversarial verifiers instructed to *refute* them. 37 survived. 2,780 tool calls, ~7.4M tokens, 51 minutes.
**Independent verification:** every headline claim in the "Cannot launch today" section below was re-checked by hand after the audit.

---

## Bottom line

ATHENA is a genuinely large, genuinely built platform — far more real than its own planning documents claim. The craft is high: both packages typecheck clean under `strict`, 1,263 server tests pass, code duplication is ~1%, and there are **zero** TODO/FIXME markers in 122,000 lines of server source. Several domains (housing, automotive, social, accounting, admin/compliance) are the work of someone who finishes things.

It is also, today, **not running**. The API server is deployed nowhere, so the live site has no backend at all. And CI has never once executed — 200 of 200 runs failed before a job started, billing-locked since early September. Those two facts sit above every other finding in this report.

Beneath them sit 37 verified blockers, concentrated in three places that matter most for this particular product: **money that can move twice or go missing**, **safety switches that are wired to nothing**, and **tenant data readable by any signed-in account**.

The honest summary: *the building is built, the power is off, and some of the locks are painted on.*

---

## 1. Scale of what exists

| Measure | Value |
|---|---|
| TypeScript / TSX | ~262,000 lines |
| Client pages (Next.js App Router) | 301 |
| API route modules | 84, all mounted |
| API endpoints | ~1,126 |
| Server services | 65 |
| Prisma models | 222 (7,121-line schema) |
| Database migrations | 62, hand-written SQL |
| Test files | 164 server (1,263 tests) + 28 client (154 tests) |
| Mobile screens (Expo/React Native) | 34 |
| Commits | 384, since 21 January 2026 |
| Capabilities catalogued by this audit | **467** |

**Capability maturity, as verified chain-by-chain (UI → API → service → database):**

| Maturity | Count | Share |
|---|---|---|
| Production-ready (full chain, guarded, tested) | 116 | 25% |
| Functional (full chain, thin) | 209 | 45% |
| Partial (chain breaks somewhere) | 86 | 18% |
| Scaffold-only (exists, does nothing useful) | 39 | 8% |
| Fake data (renders invented records) | 17 | 4% |

**70% of catalogued capabilities are real, working chains.** That is a high number for a platform this broad, and it is the single most important finding in ATHENA's favour.

---

## 2. What the platform can actually do

### Strongest areas

**Housing & DV safety (52%)** — the best-designed domain in the codebase. Confidential DV-safe listings are hidden from anonymous visitors and from members who are neither woman-verified nor in Safe Mode. Street addresses are withheld until the lister answers an inquiry. A DV-safe claim is held at PENDING until staff verify it. The asker appears to the lister only as "Applicant 4F2A" until she chooses to share. Safe chats are AES-256-GCM encrypted, PINs are scrypt-hashed, and the panic button genuinely emails emergency contacts and honestly reports who it could not reach. 19 housing tests, 9 DV-safe tests.

**Automotive (62%)** — the most *complete* vertical. ~95 endpoints, 16 Prisma models with a real applied migration, 28 pages, and a client API module in which every method maps to a real handler that queries Postgres. Not one TODO, mock array or stub in the entire domain. Members can value a car, run finance and insurance estimates, keep a garage with odometer and service history, list and sell a car, make an offer, pay into escrow, and book a mechanic with quote and review.

**Social, feed & messaging (55%)** — not scaffolding. Posts with six reaction types, polls, threaded comments, reposts, saved collections, drafts, per-post insights, stories with close-friends audiences, story highlights, DMs with attachments/replies/reactions/edit/unsend/message-requests/disappearing timers, groups with full moderation (roles, mute, ban, join requests), broadcast channels, hashtag topics, reusable sounds, an ffmpeg video pipeline, and livestreams with paid gifts. Websockets are wired end to end on web. ~40 Jest suites.

**Admin, moderation & compliance (58%)** — authorisation is enforced server-side in middleware with a hard staff-2FA gate, not by hiding UI. The moderation queue, appeals with genuine enforcement reversal, a breach register running the correct Australian NDB 30-day clock alongside the GDPR 72-hour clock, and DSAR export/erasure that walks a 60+ table personal-data register inside one transaction and honours legal holds. The Australian framing is legally accurate — correct APPs, s 26WH/26WK/26WL, OAIC, 30-day response periods. ~3,000 lines of tests.

**Money infrastructure (42%)** — four rails can move real money today: Stripe Checkout subscriptions, Stripe Connect escrow, the business-formation fee, and creator payouts. Behind them: a properly built webhook endpoint with signature verification, an idempotency row released on handler failure, amount cross-checking against signed metadata, dispute alerts, refund propagation, and a locked escrow-expiry sweeper with ops metrics. The accounting stack is a real double-entry ledger with Basiq open-banking import and a BAS worksheet computed against correct 2025-26 ATO rates.

**Learning (58%)** — the course chain is complete and tested: a provider's team builds modules and lessons, learners enrol, work through a classroom, and the final lesson issues a certificate with a unique code anyone can verify at a public page. The accelerator runs cohorts that auto-seed twelve weeks of sessions, takes payment through a signature-verified Stripe webhook, and graduates founders into a completion certificate.

**Server runtime (52%)** — production-grade. Crash-safe bootstrap that runs `prisma migrate deploy` and falls back to an emergency 503 health server, CORS allow-listing, Redis-backed shared rate limits, trusted-proxy IP resolution, request IDs, token-gated Prometheus metrics, a maintenance gate, secret-redacting structured logging, five health endpoints, graceful shutdown, an authenticated Socket.IO service, real Expo+FCM push, 8 BullMQ workers and nine Redis-locked sweepers.

**Authentication (52%)** — registration, email verification, login with per-account lockout and bcrypt-timing enumeration defence, JWT access/refresh with rotation and reuse detection, DB-backed session listing and revocation, new-device alerts, password reset, and TOTP 2FA — all real, all chained, several tested.

### Honest areas worth noting

The `/api/algorithms/*` features (career compass, mentor match, opportunity scan, salary equity) compute real numbers from live Job/Course/UserSkill rows, and **the UI says so plainly** rather than calling it AI. The audit called this "the most honest code in the repo." Similarly, the impact and community-support catalogues ship deliberately empty — "every list starts empty and stays honest."

---

## 3. Readiness scorecard

| Area | Ready | Gaps | Blockers |
|---|---|---|---|
| Deployment & operability | **28%** | 19 | 7 |
| Money, payments, tax & accounting | 42% | 31 | 10 |
| AI features & ML | 44% | 31 | 4 |
| Jobs, employers, mentorship | 45% | 33 | 10 |
| Test coverage & quality | 45% | 16 | 6 |
| Identity, auth & women-gate | 52% | 22 | 3 |
| Housing, safety, DV-safe, impact | 52% | 31 | 6 |
| Mobile & runtime plumbing | 52% | 32 | 7 |
| Social, feed & messaging | 55% | 33 | 11 |
| Learning & events | 58% | 32 | 5 |
| Admin, moderation & compliance | 58% | 33 | 3 |
| Plan vs. reality | 58% | 17 | 4 |
| Automotive | 62% | 25 | 5 |
| Security & data protection | 62% | 12 | 2 |

**367 gaps total** — 178 hours-sized, 150 days-sized, 39 weeks-sized.

---

## 4. Cannot launch today — two facts

### 4.1 The API is deployed nowhere

Verified by hand this session:

```
curl https://athena-empress.netlify.app/         → 200
curl https://athena-empress.netlify.app/api/health → 500
   "error sending request for url (http://localhost:5000/api/health):
    Connection refused (os error 111)"
```

The public site renders as a shell. Every dynamic feature — auth, feed, jobs, money, safety — is unreachable. The old Railway service was deleted and nothing replaced it: there is no `render.yaml`, `fly.toml`, `Procfile` or ECS task definition anywhere in the tracked tree. A `server/Dockerfile` exists and is ready to use.

Worse, when `NEXT_PUBLIC_API_URL` is unset — **which is the current state of the live site** — the client falls back to `https://api.athena.app`, a domain ATHENA does not own, which resolves to live third-party AWS IPs. The login and register route handlers will POST member credentials there. This fallback is in `client/src/lib/runtime-config.ts` and `mobile/eas.json` and should be deleted regardless of anything else in this report.

### 4.2 CI has never run

Verified by hand: **200 of the last 200 workflow runs failed**, every one in 3–4 seconds before a job started, with no logs retained — the signature of an account-level billing lock, in place since at least 6 September.

The pipeline itself is well designed: Postgres service, `tsc`, jest, Playwright, plus three bespoke static checks. None of it has ever executed. And `build-and-deploy.yml` — which runs `prisma migrate deploy` against production Neon — triggers on the same push event as CI with no `needs` or `workflow_run` dependency, so it *races* the tests rather than waiting for them. `main` has no branch protection.

Two compounding details: all 62 migrations are hand-written SQL, but CI applies the schema with `prisma db push` and so **never executes the migration SQL**; and the production Neon database contains roughly 56 tables and 42 enum types this repo does not model, brought by 9 migrations that exist nowhere in the repository — **it is shared with an unknown third application.**

---

## 5. The 37 verified blockers, by theme

### Money — can pay twice, can go missing (10)

- **Creator payout can pay twice.** The Stripe transfer is created *before* the balance is reset, with no idempotency key and no lock. A double-click, a flaky mobile connection or a replayed request wires the same balance twice out of ATHENA's own funds.
- **Zero Stripe idempotency keys on any outbound money call, anywhere in the codebase.**
- **Payout resets `pendingPayout` to 0 rather than decrementing by the amount paid** — earnings accrued mid-flight are silently erased.
- **Gift balance check sits outside its transaction** — concurrent spends drive the balance negative. Gift points are bought with real money, so this is a direct cash-loss path.
- **Nothing anywhere calls `prisma.payment.create`.** The Payment table is permanently empty, so the invoice pipeline is dead for every sale except subscriptions.
- **Business formation takes A$49–A$699 with no code path to fulfil or refund it.** She pays, gets two emails and a green tick, and nothing can ever happen next.
- **Three separate Stripe Connect account fields for the same person**, and the earnings dashboard reads the wrong one.
- **Mentor sessions run a parallel escrow that writes no `EscrowPayment` row** — invisible to the expiry sweeper. A session booked more than seven days out has its authorisation lapse, the capture fails, and the mentor is never paid.
- **"Tax invoices" carry zero GST** — `taxTotal: 0` hardcoded, no ABN, on an Australian platform charging AUD.
- **No reconciliation job** against Stripe balance transactions.

### Safety — switches wired to nothing (6)

This is the category that matters most for this product, and the one the audit weighted most heavily.

- **"Hide me from search" is enforced nowhere.** The toggle saves, the settings page reads it back so it looks like it works, and `search.service.ts` never consults it. `GET /api/search` uses `optionalAuth`, so a signed-out abuser can type her name and find her.
- **"Keep notifications vague" is enforced nowhere.** Lock-screen pushes carry the sender's real name and message text. `getSafeNotificationContent` exists but is wired only to a preview endpoint — no notification sender calls it.
- **"Closes your messages" is enforced nowhere.** Messaging is gated by a *third* settings table that `DvSafetyProfile.allowMessages` never touches.
- **Two independent `isSafeMode` columns** (`Profile` and `DvSafetyProfile`) written by two different endpoints. Housing reads only the second — so a woman who enables Safe Mode from `/safety-center` still cannot see DV-safe listings.
- **The safety plan says "private and encrypted. Only you can access it."** It is written to Postgres as plain JSON with no encryption in the chain — in a codebase that already has AES-256-GCM available two files away.
- **Search returns private posts to signed-out strangers**; **stories bypass blocking entirely**; **live-stream chat has no moderation, no block enforcement and no host controls**; and **group chat, channel messages, reel comments and story captions skip the moderation gate** that posts and DMs already pass through.

Of everything in this report, these are the findings to fix first. A survivor who works through the Safety Centre will reasonably conclude she is hidden when she is not — which converts a security gap into a physical-safety one. The fixes are small and obvious: single choke points in `push.service.ts` and `search.service.ts`. The audit sized this work in **days, not weeks**.

### Privacy & tenant isolation (5)

- **Every inventory endpoint returns every tenant's rows to every signed-in user** — SKUs, unit cost, sell price, therefore margins. The model has no owner field at all.
- **Journal entries can be posted into any organisation's books.** `GET /api/organizations` is unauthenticated and hands out every organisation UUID.
- **Any signed-in user can read any organisation's full BAS worksheet** by appending `?organizationId=<id>`.
- **Anonymous callers get every accelerator enrollee's identity**, payment status, deliverables and mentor notes — from a page linked off the public marketing site.
- **An education applicant can mark her own application ACCEPTED**, and providers have no decision route at all.

### Broken chains — built but unreachable (11)

- **Web login has no two-factor field.** The server requires a code; `authApi.login` is typed `{email, password}`. Staff 2FA is mandatory in production, so **no ADMIN or MODERATOR can sign in on the web at all** once they enrol.
- **Mentor booking cannot complete for anybody.** Nothing calls `POST /api/mentors/enable`, so `stripeAccountId` is never set and booking hard-fails 400. The mentor dashboard promises a "connect payouts" control that does not exist. This is the flagship paid flow, and it has escrow, timezone-aware slots and its own passing test suite behind it.
- **`/dashboard/jobs` is permanently empty** and its filters are wired to nothing.
- **Employer job list is always empty**, so pause/close/publish is unreachable — even though the job row really is in the database.
- **Employer analytics throws an uncaught TypeError on every successful response.**
- **No endpoint can accept an apprenticeship application**, which strands the entire milestone/evidence/certificate stack.
- **Skills marketplace has no seller UI**, so nobody can ever list a service — on a page advertised in three places.
- **`POST /api/mentoring/book` is live and lets any authenticated caller book a paid mentor for free**, bypassing escrow.
- **Car purchase strands the buyer**: closing the card form marks the purchase PAID_HELD and tells the seller she paid.
- **`/dashboard/ai/creator` throws on render for every user** — it reads six fields that do not exist on the model.
- **Member-hosted events publish instantly** — unattributable, unreportable, with the join link public before RSVP.

### Fabricated data attributed to real organisations (2)

- **`prisma/seed.ts` publishes 32–34 ACTIVE job ads under Qantas, CBA, BHP, Telstra, Canva, Atlassian and Rio Tinto** — invented descriptions, invented salary bands, links to the companies' real websites, random view counts and random safety scores. No production guard.
- **The same seed fabricates course outcome statistics attributed to real Australian institutions** — "UNSW Sydney … 97% of graduates … $110,000, as the provider reports" — plus five invented events with padded attendee counts.

Following the repo's own deploy runbook puts both live. This is legal exposure, not a data-quality issue, and it is the single cheapest serious item on this list to fix.

---

## 6. What is hollow

**39 scaffold-only and 17 fake-data capabilities.** The largest concentrations:

- **The Python ML service is not a working ML system.** No trained artifacts exist anywhere in the tree; the shipped docker-compose mounts an empty volume, so the model loader falls back to a RandomForest fitted on `np.random.rand` noise. `/mentor-match` returns invented `mentor_1..mentor_5`. The "heavy ranker" is the light ranker × 1.05. Meanwhile `health.routes.ts` makes `ML_SERVICE_URL` a *required* production launch-readiness check, and the loader raises in production when artifacts are missing — a self-contradicting gate. Either commit artifacts or scope the service out and drop the check.
- **The one place Node consumes ML — feed re-ranking — is broken by a type mismatch.** Lowercased Prisma PostType values go into a pydantic enum that does not accept them, so every non-video batch 422s, the ranker silently never applies, and it costs ~3s of retry latency per feed load.
- **The entire multi-provider payment layer** (PayPal, GCash, GrabPay, M-Pesa, Pix, UPI, Wise) is simulation that fabricates redirect URLs. FX reads a hardcoded 12-entry table and silently returns rate 1 for unknown pairs.
- **Billing settings renders hardcoded $0/$29/$99 plans** matching neither the Stripe price tiers nor each other; the Enterprise button sends a tier the server rejects.
- **All mobile real-time is dead** — `socketService.connect()` is never called. Chat bubbles compare `senderId === 'me'`, so your own messages render as the other person's. No `eas.projectId`, so push tokens cannot resolve in a real build. ~4,670 lines of mobile hooks and stores are self-declared dead code.
- **`@athena/shared` is entirely unused** — zero imports from anywhere, three empty source directories.
- **Nine of eleven admin routers write nothing to the AuditLog.**
- **Anonymous content reports** — the case the Online Safety Act most cares about — are written to a table no route or screen ever reads.

---

## 7. The women-gate

Worth separating out, because it is the product's premise.

As shipped, **"women-only" is a claim, not a control.** It is a self-attestation checkbox at signup. The "request verification" endpoint collects no evidence whatsoever — it flips a status to PENDING and requires a paid subscription. The admin reviewer sees only a name, email and subscription tier. And `womanVerificationStatus` is enforced in **exactly one place across all 84 route files**: housing.

Anyone who ticks one checkbox becomes a full member — community, groups, messaging, events, careers, learning, money. Separately, **there is no age verification anywhere**: no date of birth is collected or stored, so a minor can complete registration in under a minute, or in one click via Google, and land in an adult network with a public feed, stories, DMs and a DV surface. Australia's minimum-age regime applies here.

The encouraging part: a working Stripe Identity document-and-selfie flow already exists in the codebase for verification badges. Connecting it to `womanVerificationStatus` is the shortest path to making the premise real.

---

## 8. Testing — strong craft, no safety net, wrong holes

Everything run locally is green, and I confirmed it this session: server typecheck clean, client typecheck clean, 1,263 server tests passing, 154 client tests, lint 0 errors, and the three bespoke checks (`api-contract`, `doc-reference`, `dead-interaction`) all clean. The best tests are genuinely excellent — real ATO brackets, BAS G1/G10/G11 figures, GDPR Article 18 restriction actually gating consent, DV safe-chat PIN hashing.

But:

- **Not one of the 164 suites touches a database.** Every suite mocks Prisma, so no migration, constraint, transaction, cascade or index is ever exercised.
- **The missing coverage is concentrated exactly where a bug costs money, an account or a regulator**: `payments-orchestration.service.ts` (831 lines) and `stripe-connect.service.ts` (712 lines) have no behavioural coverage at all. Password reset, email verification, change-password and refresh-token reuse detection are untested — two of them are "tested" by grepping source text.
- **Right-to-erasure is never executed by a test**, and its model map misses **53 person-linked tables**, including `DvSafeMessage`, `HealthEntry`, `Medication`, `BankConnection` and `NetWorthSnapshot`.
- When CI is unblocked it will **OOM immediately**: 4 jest workers hold ~3.5 GB each against a 7 GB runner. Cap the workers in the same change.

---

## 9. Plan vs. reality

The built product is in far better shape than the planning documents say, and the plan is in far worse shape than the product. Unreachable routes have fallen from 151 (6 Sep) → 107 (14 Sep) → **49 today**; broken doc citations from 30 → 10.

The divergences run both ways:

- **Two large pillars exist with no blueprint coverage at all** — automotive (15 models, 1,828-line router, 28 pages) and wellness (11+ models, 1,642-line router, 21 pages).
- **The blueprint's Advertising Platform has zero models, routes or pages.**
- **The ENTERPRISE tier exists in the enum but has no Stripe price ID in any of the seven currency maps** — so the blueprint's AU$800k Year 1 enterprise target cannot be billed.
- 27 locales each hold a single ~607-byte file.

The first decision to make is not technical: **decide in writing whether the blueprint or the repo is the plan of record.** Every other prioritisation argument is downstream of that.

---

## 10. Recommended sequence

**Week 1 — make it exist and make it safe**

1. Deploy the Express API (the `server/Dockerfile` is ready; Render or Fly is a day's work), set `NEXT_PUBLIC_API_URL` on Netlify, rebuild.
2. **Delete the `https://api.athena.app` fallback** from `runtime-config.ts` and `mobile/eas.json`. Do this first — it is a five-minute change that stops credentials going to a domain you do not own.
3. Clear the GitHub Actions billing lock; cap jest workers; make `build-and-deploy.yml` depend on CI; turn on branch protection.
4. Enforce `notificationsSafe` in `push.service.ts` and `hideFromSearch` + block filtering in `search.service.ts`. Reconcile the two `isSafeMode` columns. Encrypt `SafetyPlan`.
5. Guard `prisma/seed.ts` against production and delete the fabricated listings attributed to real companies and universities.
6. Add the `twoFactorCode` field to the web login form — otherwise you cannot administer your own platform.

**Week 2–3 — stop the money bleeding**

7. Idempotency keys on every outbound Stripe call; fix the payout ordering; atomic conditional decrement for gift balance.
8. Unify the three Stripe Connect fields onto one; fold mentor sessions into the single escrow path.
9. Either build formation fulfilment or stop taking the fee.
10. Put `payments-orchestration` and `stripe-connect` under behavioural test.

**Week 3–4 — close the tenant-isolation holes and reconnect the broken chains**

11. Owner scoping on inventory, accounting journals and BAS; authenticate the accelerator roster endpoint; remove the applicant's ability to self-accept.
12. Fix the four response-shape mismatches (employer jobs, team, analytics, `/dashboard/jobs`).
13. Wire the mentor payout control so the flagship paid flow can complete.

**Then — the premise**

14. Connect the existing Stripe Identity flow to `womanVerificationStatus`, collect evidence at request time, and enforce the gate on more than housing.
15. Add date-of-birth and a minimum-age check at registration and OAuth signup.

---

## Closing note

The gap between ATHENA's best code and its weakest is unusually wide, and the pattern is consistent: **what was built carefully was built very well, and what breaks is almost always the last connection** — a field the UI does not send, a toggle nothing reads, a route nothing calls, a server nothing deploys to.

That is a much better problem to have than the alternative. Most of the 37 blockers are hours or days of work against code that already exists, not features that need building. The 178 hours-sized gaps outnumber the 39 weeks-sized ones by more than four to one.

Fix the deployment, fix the safety switches, fix the money ordering — in that order — and this becomes a platform you can put in front of real women.
