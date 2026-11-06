# ATHENA codebase audit — 14 September 2026

> **Status, 15 September.** The security findings were patched the next day. S1 and S4 (dependencies): `next` 16.3.5, `sharp` 0.35.4 on both tiers, `socket.io-parser` 4.2.7, `axios` 1.20 and the rest of the non-breaking fixes; still open are `prisma` (the advisory is in its config package and the only fix is a major upgrade), Tiptap (moderate, breaking) and the Expo/Metro chain on mobile (major upgrade). S2: `httpUrl` on the server at all 14 sites plus the six express-validator sites, and `safeHref()` on the client at 51 sites. S3: a per-request nonce policy set in the middleware, with `'strict-dynamic'`; the static header is gone and `connect-src` no longer allows `http:` in production. S5: access tokens default to one hour. S6: `MODERATOR`, `ADMIN` and `SUPER_ADMIN` are refused by both role middlewares until two-factor is enrolled (always in production; `STAFF_TWO_FACTOR_REQUIRED=false` outside it); the client sends them to the security settings. S8: `safeRedirect()` on the login and register pages. S9: already mitigated by an origin check on refresh that the audit missed; the same-site deployment is still the better shape. S10: the four confirmed inputs are validated (community-support goals, AI chat message and context, feature flags, and the typing route was a false positive). S11: a shared `ML_SERVICE_KEY` on both sides. S12: the rate-limit switch is ignored in production and a missing `REDIS_URL` is logged as an error at boot. S13: every sweeper runs under a Redis lock through `runExclusively`, unlocked with a warning when there is no Redis. S14: one `utils/stripe.ts` client. Still yours to do: S7 (a development database branch) and S16 (GitHub billing).

**Scope.** The whole repository as of commit `56c67eea0`: the Express API (363 files, 105,878 lines, 80 route files, 1,057 routes, 222 Prisma models), the Next.js client (494 files, 109,063 lines, 299 pages), the Expo mobile app (59 files) and the FastAPI ML service (24 files).

**Method.** Every route declaration was parsed and classified (auth, role, validation); the API-contract checker was run in `--unreachable` mode; `npm audit` was run on all three packages; the authentication, session, cookie, rate-limit, CORS, webhook, upload and file-serving code was read in full; the rest was swept with targeted searches and then confirmed by reading the code at each hit. Where a signal is a heuristic rather than a verified fact, it says so.

**Headline.** The platform's security foundations are better than most at this stage: sessions are revocable per request, passwords are hashed at cost 12 with a 12-character minimum, two-factor exists, the web client never writes the access token to storage, webhooks verify signatures, uploads are type-checked and served only to their owner. The serious problems are at the edges: one critical framework advisory, user-supplied links that can carry `javascript:` into the pages, a content security policy that permits any script, admins without mandatory two-factor, week-long access tokens, and a developer laptop wired to the production database. Functionally, 107 API routes have no caller in the app, the mobile app covers about a third of the platform, and production is 16 migrations behind because CI is blocked.

---

## 1. What to do first

| # | Action | Why | Effort |
|---|--------|-----|--------|
| 1 | Upgrade `next`, `sharp`, `socket.io`, `prisma`, `axios`; run `npm audit fix` in all three packages | One critical (Next image-optimisation RCE) and 28 high advisories | Hours |
| 2 | One `httpUrl` schema on the server and a `safeHref()` on the client | 14 input sites accept `javascript:` URLs that 44 places render as links | Hours |
| 3 | Require two-factor for `ADMIN` and `MODERATOR` | Nothing enforces it today | Half a day |
| 4 | Access tokens from 7 days to 1 hour | A leaked bearer token stays live for a week | Minutes, plus a refresh-flow test |
| 5 | Nonce-based content security policy; drop `http:` from `connect-src` | `script-src 'unsafe-inline' https:` stops nothing | Half a day |
| 6 | Reject `//host` in the login `redirect` parameter | Open redirect after sign-in | Minutes |
| 7 | A Neon branch for development; production URL only in deploy secrets | The laptop's `.env` points at production | Minutes |
| 8 | Fix GitHub billing, then run the migrate job | CI, the weekly audit and migrations have not run since 6 September | Account setting |

---

## 2. Security

### 2.1 What is already sound

Listed so nobody re-does it.

- **Sessions.** Every request re-checks the session behind the JWT (`server/src/middleware/auth.ts:33`), so logout and revocation take effect immediately; the Socket.IO handshake applies the same rules (`services/socket.service.ts:54-69`). Suspended accounts get one neutral message everywhere.
- **Credentials.** bcrypt at cost 12 (`utils/password.ts:4`), a 12-character minimum (`routes/auth.routes.ts:35`), a dummy hash so login timing does not reveal whether an email exists, account lockout, TOTP with recovery codes (`auth.routes.ts:1685-1960`), sign-in alerts.
- **Token handling.** The web client keeps the access token in memory only (`client/src/lib/tokenStore.ts`); the mobile app uses SecureStore. The refresh token is an `httpOnly`, `Secure` cookie. Refresh, login, register and password-reset endpoints have their own limiters (`server/src/index.ts:333-341`).
- **Perimeter.** Helmet, HSTS with preload, `X-Frame-Options`, `Permissions-Policy` and a CSP on the client (`client/next.config.js:29-41`); a CORS allowlist that logs rejections; `trust proxy` set; JSON bodies capped at 10 MB; uploads capped at 500 MB and content-sniffed (`utils/file-signature`).
- **Money and hooks.** Stripe webhooks verify the signature against the raw body (`routes/webhook.routes.ts:59-84`); RTMP hooks need a shared secret; the seed routes need `ALLOW_DB_SEEDING` and a timing-safe token.
- **Files.** Locally served uploads are validated against the owner's key space and a private-folder allowlist before `sendFile` (`routes/media.routes.ts:555-575`); no `fs` or `path` call takes request input anywhere else.
- **Injection.** No `$queryRawUnsafe`, no `eval`, no shell with user input (the only `spawn` is the ffmpeg pipeline with fixed arguments). Rendered HTML goes through DOMPurify (`client/src/lib/utils/sanitize.ts`); Markdown is tested against `javascript:` links; email templates escape their inputs.
- **Boot checks.** `JWT_SECRET` must be 32 characters, `DV_ENCRYPTION_KEY` and both database URLs are required (`utils/env.ts:35-56`); the Docker image runs as a non-root user.

### 2.2 Findings

Severity reflects likelihood and impact together. Every item has the file and line where it was verified.

**S1 · Critical · Next.js advisories.** `npm audit` on the client reports two critical advisories against the installed `next` (`^16.2.6`): unauthenticated remote code execution in the Image Optimization API via AVIF files, and RCE on Windows-hosted servers. The site optimises remote images (`client/next.config.js:48`, `remotePatterns`), so the AVIF path is live on Netlify; the Windows one only touches local development. Fix: upgrade to the patched release and redeploy.

**S2 · High · Links that run code.** `z.string().url()` accepts any scheme (`new URL('javascript:alert(1)')` is valid). It is used at 14 input sites: `routes/automotive.routes.ts` lines 342 (review video), 579 (listing photos and video), 610 and 612 (PPSR certificate, report), 801 (inspection report), 881, 1262 (workshop website and booking page), 1338 (dealership website), 1485; `routes/dv-safe.routes.ts:47`; `routes/wellness.routes.ts` lines 841, 974, 1122, 1168. The client renders these values as `href` in 44 places ("Website", "Watch her video", "Open their booking page", "The report file"). React 18 renders a `javascript:` href with only a console warning, so one member's profile can run script in another member's session on a click. Fix: a shared `httpUrl` zod schema (`.url()` plus a refinement to `http:`/`https:`), used everywhere a URL is accepted; a `safeHref()` on the client that returns `undefined` for anything else; photos additionally restricted to the platform's media host.

**S3 · High · A content security policy that permits any script.** `client/next.config.js:11`: `script-src 'self' 'unsafe-inline' https:` (plus `'unsafe-eval'` outside production), and `connect-src 'self' http: https: ws: wss:`. Any injected inline script, and any script from any HTTPS host, is allowed, so the policy cannot contain an XSS such as S2. Fix: a per-request nonce set in the middleware and threaded into the script tags; an explicit list of the script hosts actually used (Sentry, Stripe, Google sign-in); `connect-src` limited to the API origin, Sentry and Stripe in production.

**S4 · High · Vulnerable dependencies.** `npm audit` on 14 September: server 8 high (`sharp` direct, libvips and libheif CVEs; `socket.io-parser` memory exhaustion; `prisma` via `deepmerge-ts`; `js-yaml`, `brace-expansion`, `browserslist`); client 1 critical and 3 high (S1, `sharp`, `js-yaml`, `browserslist`); mobile 17 high (`axios` direct, prototype pollution into request construction; the `expo`/`metro` chain; `form-data` CRLF injection; `image-size` infinite loops). The weekly `security-audit.yml` job that would have raised these has not run since the account was locked (S16). Fix: bump the direct dependencies, `npm audit fix` for the rest, and restore the schedule.

**S5 · High · Seven-day access tokens.** `server/src/utils/jwt.ts:16-17`: `JWT_EXPIRES_IN || '7d'`, refresh `30d`. Sessions are checked per request, which bounds the damage, but a bearer token copied from a log, a proxy or a device stays valid for a week. The client already refreshes on 401, so short tokens cost nothing. Fix: 15 minutes to 1 hour for access tokens; keep the 30-day refresh with rotation.

**S6 · High · Administrators without mandatory two-factor.** TOTP is built, but neither `middleware/auth.ts` nor the admin router (`routes/admin.routes.ts:21-31`) requires an enrolled factor for `ADMIN` or `MODERATOR`. One phished admin password opens the moderation queue, user records, billing and the referral ledger. Fix: refuse elevated routes unless `twoFactorEnabled` is true, and force enrolment on the next admin sign-in.

**S7 · High · Development runs against production.** `server/.env` (untracked, on the laptop) sets `DATABASE_URL` to the Neon production pooler. `npm run dev`, seeds and `db push` from the laptop act on live data; the destructive-migration guard covers migrations but not seeds or the running app. Fix: a Neon branch or local Postgres for development; the production URL exists only in Netlify and Actions secrets.

**S8 · Medium · Open redirect after sign-in.** `client/src/app/login/page.tsx` lines 56, 77, 235 and 248 accept `?redirect=` when it starts with `/`; `//evil.example/x` passes and is protocol-relative. Fix: reject a second leading `/` or `\` (the check at `client/src/lib/runtime-config.ts:28` is the pattern), or resolve against the app origin and require it to match.

**S9 · Medium · Cross-site refresh cookie.** In production the refresh cookie is `SameSite=None` (`routes/auth.routes.ts:304-312`) because the app on Netlify and the API are different sites. Any page on the web can POST to `/api/auth/refresh` with the victim's cookie. CORS stops it reading the reply, but the call still rotates the session and can be used to keep a session alive. Fix: put the API on a subdomain of the app (`api.<domain>`) and use `Lax`, or require a double-submit CSRF header on refresh.

**S10 · Medium · Three validation styles, and gaps between them.** zod `parse()`, express-validator chains and hand-rolled `typeof` checks coexist across the 80 route files (heuristic: 131 mutating routes show no validation signal near the handler; many are false positives where the validator is a named array). Confirmed unvalidated inputs: `routes/community-support.routes.ts:73` (`goalsSet` written straight to the enrolment), `routes/ai.routes.ts:512` (`message` and `context` only checked for truthiness), `routes/feature-flags.routes.ts:76` and `:100` (`metadata` passed through to the database), `routes/channel.routes.ts:670`. Fix: one layer (zod) with shared schemas for money, ids, states and URLs; validate query strings too.

**S11 · Medium · The ML service is unauthenticated.** `services/ml.service.ts:14` calls `ML_SERVICE_URL` with no key, and `ml/src` has no auth dependency. Nothing in a product path calls it yet, so the exposure is nil today; before it is deployed it needs a shared key or a private network.

**S12 · Medium · Rate limits that can vanish.** Without Redis the limiter falls back to an in-process window (`middleware/rateLimiter.ts`, documented), so two API instances give an attacker two budgets; `RATE_LIMIT_ENABLED=false` (`index.ts:281`) switches every limiter off. Fix: refuse to start in production without Redis; remove the kill switch or restrict it to tests.

**S13 · Medium · Eight schedulers with no lock.** `index.ts:747-758` starts `setInterval` sweepers for message expiry, grant reminders, wealth nudges, wellness, automotive and scheduled posts on every instance. None uses `withLock` (`utils/redis.ts:224`), so a second instance sends every reminder twice and can publish a scheduled post twice. Fix: wrap each run in `withLock`, or move them onto the BullMQ queues that already exist.

**S14 · Low · Placeholder Stripe keys in four modules.** `routes/subscription.routes.ts:16`, `routes/webhook.routes.ts:27`, `services/creator.service.ts:12`, `services/mentor.service.ts:14` construct clients with `'sk_test_not_configured'`. The `canUseMockStripe` guard (10 sites) fails closed in production, but a fifth module without it would call Stripe with a bogus key. Fix: one `stripe.ts` that exports the client or throws.

**S15 · Low · Housekeeping with security weight.** 26 `console.log` calls in server code, 23 `.catch(() => null)` that swallow errors (some around audit entries and notifications), 222 `as any`. Fix: `no-console` and `no-explicit-any` as lint errors; swallowed errors at least logged.

**S16 · Low · Security automation is switched off.** `.github/workflows/security-audit.yml` (weekly `npm audit --audit-level=high`), `ci.yml` and the migrate job in `build-and-deploy.yml` have not run since the GitHub account's billing lock. Netlify still builds on push, so code ships without its checks.

---

## 3. Functional gaps

**G1 · 107 API routes nothing in the app calls.** From `scripts/check-api-contract.js --unreachable` (webhooks, admin, compliance and GDPR excluded). The ones that matter:

- **Mentor scheduling, 11 routes.** A mentee still cannot book, cancel, rate or respond to a session from the app; the 6 September report raised it and it is unchanged.
- **Skills-marketplace bookings and reviews, 4.** Booking a service and reviewing it exist only as an API.
- **Invoices, 4.** The invoice list, detail, PDF and payment endpoints never surface.
- **Apprenticeship provider tooling, 4.** Providers cannot create, edit or publish from the app.
- **Engagement, 5.** XP, streaks and leaderboards are API-only; gamification has no screen beyond achievements.
- **Formation, 5.** The ABN and ACN lookups built on the server (commit `3fddc266d`) and the formation payment routes have no page.
- **Salary, 6, and search, 6.** The salary-insights page and global search use other endpoints; these are either dead or waiting for a UI.
- **Analytics, 8, and algorithms, 6.** The admin analytics and algorithm demonstration pages do not call them.
- **Business accelerator, 3.** Enrolment payment and progress.
- **Creator balance and gifts, 3; mentor onboarding, 3; concierge, 3; DV safe mode, 3** (viewer visibility, block, safe notification); **accounting journal detail and trial balance, 2; group member management, 2**; singles: `appeals/me`, `trust-score`, `sounds`, `regions`, `posts/video-feed`, post view counting, `video PATCH`, `media/download-url`, `payments/payout`.
- Fine as they are: the livestream hooks (called by the media server), push-token routes (mobile), the generic escrow routes (the pillars call the service directly), `POST /auth/verify-email` (the GET form is used).

**G2 · Pages that render fixed content.** 61 of 299 `page.tsx` files import no data hook (heuristic). The public ones are legitimately static. Among signed-in and admin pages: `admin/marketing/influencers`, `partnerships`, `press`, `waitlist`; `admin/settings`; `dashboard/persona`.

**G3 · Mobile parity.** 24 screens cover the feed, jobs, mentors, learning, groups, messages, safety and the profile. Nothing for wellness, cars, the strategy plans, finance, formation or the marketplace, all of which the blueprint puts under the "More" tab. Two test files.

**G4 · Production database drift.** Neon is behind the repository by every migration since 6 September, now 16 including the automotive tables and the referral ledger, because the Actions migrate job is blocked. `npm run db:migrate:deploy` from `athena-platform/server` applies them; none is destructive.

**G5 · Integrations still simulated or absent.** Guards found in code: video processing (`VIDEO_PROCESSING_ALLOW_SIMULATION`), push (`PUSH_NOTIFICATION_ALLOW_SIMULATION`; `firebase-admin` not installed), data export processor (`DATA_EXPORT_ALLOW_SIMULATION`), AI without a key (`AI_ALLOW_SIMULATION`), workers (`WORKER_ALLOW_SIMULATION`), Stripe (`canUseMockStripe`). Absent: an SMS provider, the regional payment providers (stubs), OpenSearch in production (substring fallback), the ML service in any product path.

**G6 · Directories begin empty.** Mechanics, dealerships, health practitioners, mentors, housing, grants and RFPs fill only as partners join or an admin seeds them; the pages handle the empty state honestly, but until then the areas read as empty. This is a content-operations gap, not a code one.

**G7 · Compliance is modelled for the wrong jurisdiction.** `routes/gdpr.routes.ts` (1,321 lines) implements UK GDPR and Online Safety Act flows; the venture is in Queensland. The Australian Privacy Principles, the Notifiable Data Breaches scheme and the ACL consumer guarantees appear in copy but not in the data model or the admin flows.

**G8 · Documentation debt.** 25 known broken references in `docs/` (baselined), a 100-step plan that cites deleted files as evidence, and three overlapping plans at the repository root.

**G9 · Blueprint items still open after the pillar passes.** Mentee booking UI, marketplace bookings UI, apprenticeship provider tooling, group chat UI, gamification UI, the last three DV safe-mode routes, invoices UI, mobile parity.

---

## 4. Areas of improvement

**I1 · Structure.** Eight route files over 1,300 lines (`admin` 2,326; `auth` 2,320; `business` 1,837; `automotive` 1,751; `user` 1,514; `wellness` 1,497; `skills-marketplace` 1,407; `gdpr` 1,321); `index.ts` mounts about a hundred routers and starts eight schedulers; `schema.prisma` is 7,087 lines and 222 models in one file. Fix: a folder per domain under `routes/` (the automotive services already follow this pattern), Prisma's multi-file schema (`prismaSchemaFolder`), and a `registerRoutes()` module so `index.ts` reads as a boot sequence.

**I2 · Data access.** List endpoints with no page size: `business` (11 `findMany`, 1 `take`), `finance` (10, 1), `job` (9, 1), `strategy` (10, 2), `skills-marketplace` (12, 3), `wellness` (44, 11). Per-row queries inside `Promise.all(rows.map(async …))` at `routes/automotive.routes.ts:1104` (one bookings query per workshop on every directory page) and `routes/ai.routes.ts:158`. Fix: a cursor-pagination helper used by every list; batch the booking lookup with one `findMany({ where: { mechanicId: { in } } })`.

**I3 · Payments under load.** The automotive and marketplace escrows hold a card authorisation for up to 14 days; Stripe authorisations lapse after about seven (the routes say so in their header comment) and nothing re-authorises. Before real money moves through buyer protection the hold needs a capture-to-balance step or a re-authorisation job.

**I4 · Tests.** Server: 126 files, 914 tests, strong; the default 5-second per-test timeout makes the suite flaky on a busy machine (13 timeouts in a full run today, all passing in isolation). Client: 10 unit-test files for 494 source files and 5 Playwright specs. Mobile: 2. No accessibility checks anywhere. Fix: raise the server timeout or pin `--maxWorkers`; component tests for the money-moving pages (purchase, payment hold, pre-approval); an axe pass in the Playwright smoke; a smoke run against each Netlify preview.

**I5 · Tooling.** No `.gitattributes`, so every commit prints CRLF warnings and mixed endings enter the repository (`* text=auto eol=lf` fixes it). `client/next-env.d.ts` drifts on every dev run. Next 16 deprecates `src/middleware.ts` in favour of `proxy` (dev log). Browserslist data is nine months old. CI installs the client with `--legacy-peer-deps`, which hides a peer conflict.

**I6 · Operations.** Redis-backed features (limits, locks, cache, queues) degrade silently; add a "degraded" state to `/health/detailed` and refuse production boot without Redis. Sentry and Prometheus are wired on both tiers; nothing alerts on webhook failures or escrow holds ageing past the authorisation window.

**I7 · Consistency.** 222 `as any` in server code, three validation styles, 23 swallowed errors, 26 stray `console.log`. Lint rules and a single validation layer remove most of it mechanically.

**I8 · Product.** The directories need a partner-onboarding funnel (workshops, dealerships, practitioners, mentors) so the areas are not empty at launch; translations are nominal; the mobile app needs the three newest pillars.

---

## 5. Suggested order

**This week.** S1, S2, S3, S4, S5, S6, S7, S8 and the billing fix (S16, G4). All are hours, not days, and they close every high-or-worse item.

**This month.** S9 (same-site API or CSRF header), S10 (zod everywhere), S12 and S13 (Redis required, sweeper locks), I2 (pagination and the two per-row queries), I3 (escrow re-authorisation), I5 (`.gitattributes`, `proxy`), and the four UI gaps with routes already built: mentee booking, marketplace bookings, invoices, formation lookups.

**This quarter.** I1 (route and schema restructure), I4 (client tests and accessibility), G3 (mobile parity), G7 (Australian privacy and NDB modelling), G6 and I8 (content operations).
