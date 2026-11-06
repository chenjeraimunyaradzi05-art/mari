# ATHENA Mega Implementation Plan

Date: 2026-06-28
Last implementation update: 2026-11-05
Status: Late-stage beta; substantial implementation exists, but production launch is not complete.

This file replaces the scattered project markdown documents that previously mixed vision, plan, launch, compliance, deployment, and audit notes. Treat this as the single source of truth for implementation status.

Runtime legal markdown in `athena-platform/client/src/content/legal/*.md` is intentionally preserved because the app reads it for public legal pages.

## Current Verified State

- 2026-11-05 paid admissions: nine local browser and API scenarios verify public previews, pending and refused access, explicit provider approval, enrolment rollback, and competing requests. The paid and free fixture runs cleaned up their databases. The production web build, server type check, 76 focused server cases, 1,603 web unit cases and 16 additional Chromium cases pass. [Paid admissions evidence](tools/plan-audits/paid-course-admission-2026-11-05.json) does not verify payment collection or hosted operation.
- 2026-11-05 populated web pass: nine disposable-database browser checks verify car comparison, free-course enrolment through a public certificate, public preview and classroom access boundaries, and persisted private retirement data. The final build, 16 additional browser checks, 1,603 web unit cases and 42 automotive route cases pass. [Populated web evidence](tools/plan-audits/populated-web-views-2026-11-05.json) is targeted verification, not a repeat of the full-template crawl.
- 2026-11-05 web views: 334 built templates and 668 desktop/phone visits across anonymous, member and two-factor staff sessions. Five overflowing phone layouts were fixed; the retirement savings render failure passed a focused retest at both sizes. The TypeScript-checked build, 226 web suites / 1,601 unit tests and 38 distinct Chromium checks pass across the broad run and targeted rerun. [Web view evidence](tools/plan-audits/web-view-audit-2026-11-05.json) distinguishes read-only route coverage from actions, populated states and release gates.
- 2026-11-05 media processing: all local FFmpeg paths now share a bounded runner and pass only a minimal environment. Required moderation refuses uploads when no frame could be checked; metadata cleanup failure never stores raw bytes. Eleven PostgreSQL media cases and four browser regressions pass. [Media-worker evidence](tools/plan-audits/media-worker-limits-2026-11-05.json) is local process-level evidence, not production sandbox or capacity verification.
- 2026-11-05 story media: migration 88 is applied on the local app and disposable integration databases. New stories use an owned private upload rather than a public post/video URL. Expired or deleted story links are refused even before cleanup; highlights use their own gated routes and preserve their original audience. Eight story lifecycle cases and 20 privacy export/erasure cases pass on PostgreSQL. The four-case browser check proves upload, private playback, deletion and refused link reuse. [Story-media evidence](tools/plan-audits/story-media-2026-11-05.json) is local only; legacy shared files were not purged, and production story storage remains gated on external origin/CDN verification.
- 2026-11-05 security re-audit: 511 backend unit suites / 7,199 tests plus four new contract regressions, 26 targeted real PostgreSQL cases, 224 web suites / 1,594 tests, 34 targeted Chromium cases and the TypeScript-checked 293-page production build pass. Native type checks, 52 suites / 432 tests, 50 signing/toolchain checks and both Hermes exports pass. The expanded loopback baseline passes 21 scenarios / 88 requests. [Security re-audit](tools/plan-audits/security-gap-review-2026-11-05.json) records the fixes and unresolved risks; earlier full integration, administrator, recovery and load runs retain their dates.
- 2026-10-30 backend verification: all 511 unit suites / 7,205 tests and all 20 actual PostgreSQL integration suites / 630 cases pass, including the expanded 26-case independent-API-process socket suite. Source/test TypeScript, API contract coverage (1,155 web / 163 native call sites against 1,238 distinct routes), route authentication, bounded-list/body validation and parsed-database-input checks pass. Retired feature tests were removed with their implementation and replaced by refusal/payment-preservation coverage. The separate October26 admin audit remains dated evidence: 227 API probes, 43 persisted workflows, all87 migrations and fresh-database cleanup. Existing operator credentials/data remain unchanged.
- Current dependency status (registry refresh 2026-11-05): all six server/web/native runtime/full graphs have zero moderate, high or critical findings after remediation. Server/web runtime graphs have zero findings; full graphs retain six/five low entries, and native runtime/full graphs retain eleven/eighteen low entries. These all trace to one unpatched `deepmerge` tooling advisory. [Current registry receipts](tools/plan-audits/dependency-security-refresh-2026-11-05.json) are unsuppressed snapshots of the audited locks, not public-launch clearance.
- Previous full web verification (2026-10-30): all 220 unit suites / 1,568 tests, the TypeScript-checked 293-page production webpack build, 98 browser journeys with zero skips/retries and all18 member smoke checks pass with local Redis/search/workers enabled. New desktop/phone journeys confirm ordinary finance remains usable without bank linking, bank scans or round-ups, and the removed banking page returns404. Finance/tax screenshots at both sizes were inspected. The separate real two-factor administrator audit remains dated October26 evidence: all55 pages/110 desktop-phone visits, discovered tabs and11 persisted UI journeys. [Previous administrator review](tools/plan-audits/launch-review-2026-10-26.json) is not represented as a fresh rerun or live-provider/public-launch clearance.
- Earlier branding verification (2026-11-05): all 222 web unit suites / 1,577 cases and the TypeScript-checked 293-page production webpack build pass. All 15 branding/homepage browser cases pass against the production build, with zero skips/retries: four real MP4 decodes, no eager video downloads/autoplay, selection/close pausing, retry recovery, desktop/phone layout, focus restoration, advertising form attribution and scoped rail/dialog accessibility checks. A separate normal-API browser visit confirms the public feed returns200 and the actual desktop/phone play buttons work. [Local branding evidence](tools/plan-audits/home-branding-2026-11-05.json) is additive targeted evidence, not a rerun of every backend/native/administrator or prior browser journey.
- Earlier web icon verification (2026-11-05): all 223 web unit suites / 1,582 cases, the TypeScript-checked 293-page production build and all 30 targeted browser cases passed. This covered the shared icon rollout, live member sign-in, compact and phone dashboard navigation, keyboard focus, reduced motion, public accessibility and branding regressions. An isolated two-factor admin overview check also passed on desktop and phone, with the disposable API and database removed.
- Current native verification (2026-10-30): TypeScript, all 52 suites / 432 tests, 50 signing/security/toolchain checks and 11 API-contract/release-policy checks pass. Actual Android/iOS Hermes exports verify 1,205/1,206 source modules with neither node-forge nor deepmerge in the app bundles. Separate clean registry and offline scratch installs verify the unmodified upstream implementation and clean their owned directories. [Upstream verification evidence](tools/plan-audits/native-signature-upstream-2026-10-30.json) records source hashes, the explicitly in-memory disabled-check negative control and the unchanged high-severity audit passing before Expo credentials. Remote native artifacts additionally require explicit approval and an exact reviewed EAS CLI version. These exports are not APK/IPA, device/store or independent approval. The earlier ML baseline remains 150 passing tests and a loopback Node/FastAPI bridge; synthetic models are excluded from forecasting claims.
- All 88 migrations are applied to the local app and disposable test databases. The earlier 87-migration fixture schema/count rehearsal preserves 8 users / 1 job / 0 applications. Migration 84's 330,000-row query benchmark and the 2026-10-24 ten-minute-hold soaks for 100 mixed-workload actors / 250 sockets remain dated evidence, not fresh infrastructure-profile capacity claims.
- Real local infrastructure now passes Redis six-node failover/AOF recovery, actual business-worker publishing/restart, shared HTTP rate-limit and nine real OpenSearch synchronization/recovery checks. The infrastructure profile starts Redis, search and both application workers; default tests leave them disabled. A 50,000-row streaming export is measured at 102.2MB / 50.46 seconds / 100.4MB additional peak heap. Production licensing, secure replicated infrastructure and capacity are not implied.
- Local encrypted PostgreSQL backup/restore now passes a fresh snapshot and independent saved-archive reruns: all 243 tables match their snapshot row counts and keyed content fingerprints, logical schema definitions match, and both application sequences are safe to resume. Restore safety reconciliation, normal password login and administrator login with a restored encrypted authenticator pass only in newly generated disposable databases. All 13 backup-tool tests and 59 existing restore-safety/runbook cases pass. Archives and recovery keys remain encrypted outside OneDrive with Windows-user-bound key protection. [Measured local recovery evidence](tools/plan-audits/local-backup-restore-2026-10-26.json) does not clear production backup, off-device recovery, media or point-in-time recovery requirements.
- Temporary credentials, PostgreSQL, API, web, email inbox and analytics substitutes run locally. Real browser signup without an invitation, local email verification and verified sign-in pass. The new recovery journey also proves reset-link delivery, successful password change, old password/session refusal, single use and exact fixture erasure. The successful verification response now survives signed-out bootstrap changes without weakening private API guards. See [local setup](tools/LOCAL_DEVELOPMENT.md).
- [The 100-step evidence audit](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md) covers every step with existing source paths, measured checks and explicit remaining work. It supersedes unsupported completion marks; no public launch approval is implied.
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
9. Review the remaining low-severity `deepmerge` tooling advisory with the independent security assessor and adopt a compatible upstream fix when available. The native signature issue now has a verified published upstream fix, but passing registry and local checks is not independent review or release approval. No audit finding is suppressed.
10. Complete encrypted off-device backup/key escrow, retention ownership, media recovery and staging/hosted restore/rollback approval. The verified local logical database drill is not production disaster-recovery or RPO/RTO clearance.

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

## Penetration Testing Handoff

- Current authorization is local PC only. The hosted Netlify site, cloud/provider accounts, original administrator account, payment credentials and production records are excluded. Any hosted/staging assessment needs separately agreed targets, authorization, test accounts, timing, stop conditions and a recovery owner.
- Repeat the internal API baseline with `node tools/verify-local-pentest.cjs`. It creates its own database and binds only 127.0.0.1:5007, with provider networking blocked. Its fixed ceiling is 160 scenario requests, plus at most 60 bounded startup-readiness probes; response reads are capped at 2MB and individual scenario requests at ten seconds. It is not a load/denial-of-service test. Review its report and cleanup receipt before accepting a run.
- Verify the scope guards with `node --test tools/local-security-scope.test.cjs`. The ordinary app stays on localhost:3000/API5000; the browser verifier uses named reserved-domain fixtures, not the operator's credentials. No independent penetration test has been performed.
- Give the independent assessor the source, dependency reports, fresh local regression evidence and explicit remaining-work list. Use the [OWASP WSTG](https://owasp.org/projects/web-security-testing-guide) as a test-planning reference, not a claim of certification: authentication/2FA and recovery, authorization/IDOR, session lifecycle, input/content handling, private files, SSRF, WebSocket audiences, concurrency and payment/business logic.
- Specifically retest ingress header ownership and direct-origin reachability, IPv4/IPv6 and DNS rebinding, cross-instance missed-revocation/partition behavior, stale browser callbacks, cookie/CSRF/TLS behavior behind the actual ingress, upload scanning and OS-level media processing isolation, and real sandbox webhook/idempotency/payment transitions. Verify bucket/CDN access and that private uploads cannot be reached through the origin or aliases. Review the production CSP origin inventory before narrowing its HTTPS/WSS allowances. Local development evidence cannot settle these deployment-specific questions.
- Keep the unpatched [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) visible. Its remaining graph entries are tooling; current Android/iOS export maps contain no deepmerge source. Independent reachability/risk review and a compatible fix remain open, with no downgrade or audit exception introduced.
- Before an external assessment, agree a production-like staging scope, synthetic/anonymized fixtures, monitored backups and rollback, provider sandbox accounts, secret handling and incident contact. Require remediation and retesting of findings before release sign-off. Legal, provider, device/store, off-device recovery, production infrastructure and capacity gates remain open regardless of these internal results.

## Implementation Log

### 2026-11-05: Provider Course Creation, Editing And Publishing

- [x] Run a seven-case browser and PostgreSQL baseline using disposable providers and learners. Confirm private drafts and the empty-course publish gate, and reproduce lost unsaved details, duplicate positions after deletion and append, and concurrent removals leaving a live course empty.
- [x] Use the homepage's shared page shell, typography, rose controls and tinted icons for the provider list and editor. Keep labels visible after fields are filled, preserve unsaved details during curriculum saves and give module renames explicit Save and Discard actions.
- [x] Explain why a draft cannot be published, distinguish a denied list from a failed load, and key private course data by viewer and organization.
- [x] Serialize publication, curriculum deletion and position changes per course. Append after the current highest position, save each reorder atomically and protect existing certificate titles on rename.
- [x] Verify all eight course-builder scenarios on disposable PostgreSQL. Drafts stay private, unsaved edits survive curriculum changes, module and lesson order survives reload, and concurrent deletion or publication cannot leave an empty course live. A published course exposes only its public previews; unpublishing blocks new enrolments while existing learners retain classroom access.
- [x] Inspect the rebuilt editor at 390px and 1440px. The type-checked web build, server type check, 80 focused API and contract tests, and 1,603 web unit tests pass. Nine paid-admission regressions and 16 Chromium accessibility and recovery checks also passed during this pass. The disposable APIs and databases were removed.
- [ ] Verify authoring and publication with real provider teams, actual course media and physical devices before launch. No hosted deployment or real provider setup was performed.

### 2026-11-05: Paid Course Admission And Provider Approval

- [x] Baseline seven local cases across guest, learner and provider roles. Reproduce the analytics-only course-editor bypass, provider queue overflow on a phone, and an accepted application left without enrolment after a forced database failure.
- [x] Require accepted course-editing permission for builder access and the editor-only classroom bypass. Provider admissions authority remains separate from course editing, and public lesson previews remain available.
- [x] Make provider approval and required enrolment one transaction. Reject stale decisions and conflicting withdrawals rather than overwriting them. Serialize the two ways to request a place so concurrent requests cannot create duplicate open applications.
- [x] Restyle provider and learner admissions views with homepage typography, shared controls and tinted icons. Require an explicit Save decision, distinguish denied access from a failed load, and make clear that acceptance opens lessons without recording payment.
- [x] Verify nine paid admissions cases and nine populated regressions on disposable PostgreSQL, including a forced enrolment failure and concurrent API requests. Inspect the desktop and phone queue and approved classroom screenshots. The final build, 16 additional Chromium cases, 76 server cases and 1,603 web unit cases pass. The disposable APIs and databases were removed.
- [ ] Verify real provider operations and physical devices separately. Fees remain arranged with the provider and no payment is processed by the admissions flow.

### 2026-11-05: Populated Web Views And Actions

- [x] Exercise populated car, course and retirement pages against a fresh local database. The seven-case baseline passed four cases and reproduced three problems: a stale car selection showed a one-car table, a course outage appeared as a missing course, and an enrolled learner lost the classroom action on a fresh visit.
- [x] Distinguish temporary course failures from missing or refused courses, with retry on both public and dashboard views. Wait for session restoration, keep viewer-dependent reads separate by account, and route eligible learners directly into the classroom.
- [x] Require at least two available cars for a comparison. If enough remain, disclose that some are missing. Add a retry and a keyboard-focusable table that scrolls within the phone layout.
- [x] Confirm the existing retirement form saves its manual balance, investment option and insurance flag, and another signed-in account cannot see the record. Confirm the guest course response and the unenrolled classroom refusal contain no private lesson material.
- [x] Use the screenshot findings to make public previews expandable and replace invented zero or null service intervals with published values or an explicit unavailable state. Compare and detail now use the same interval wording.
- [x] Rebuild and verify nine populated browser cases, 16 additional accessibility and recovery cases, 1,603 web unit cases, and 42 automotive route cases. Inspect four phone screenshots and confirm the isolated API and database are removed after the run.
- [x] Exercise paid-provider admission in the dedicated pass above.
- [ ] Exercise other populated workflows and permission combinations separately. Production, providers and physical device gates are unchanged.

### 2026-11-05: Web Views And Homepage Consistency

- [x] Crawl the built web application with signed-out, member and two-factor staff sessions at 390px and 1440px. Baseline: 334 templates and 668 visits; 282 static, six seeded detail routes, one named empty topic and 45 missing-record probes. Five phone layouts overflowed. One pre-existing render failure was caught by the error boundary at both sizes despite returning HTTP 200.
- [x] Apply the homepage's rose accent, neutral surfaces and tinted icons to shared controls and the affected views. Fix narrow layouts in Community, Mentors, Safety Center, Learning and mentor onboarding without hiding document overflow.
- [x] Make 404 search submit to public search, keep error-reporting copy truthful, direct mentor cards to the selected profile, handle empty car comparisons locally and wait for session restoration before loading viewer-keyed appeal history.
- [x] Use the homepage's serif display headings, rose accents and small title flourish in the shared public-page header. Separate the homepage rail eyebrows from their titles. Show signed-out, loading and retry states in Safety Center instead of presenting unavailable private data as zero cases.
- [x] Fix the retirement savings page's account response parsing and use the actual saved investment and insurance fields. Keep balances manually entered, remove unsaved controls and offer a retry when the balances cannot be loaded.
- [x] Re-crawl all 334 templates with zero measured document overflow over 2px, navigation errors, uncaught page exceptions or HTTP 5xx responses. Re-test the only error-boundary route, Retirement Savings, after its fix: both sizes render the real tracker and projection. Inspect selected settled desktop and phone screenshots. Record 1,601 passing unit tests and 38 distinct Chromium checks; both disposable audit databases were removed.
- [ ] Exercise populated detail states and action/permission combinations that the route crawl could not cover. Realtime, external providers, physical devices and production launch gates remain separate.

### 2026-11-05: Media Worker Limits And Screening

- [x] Route frame extraction, probe, remux, trim, duet and rendition through one runner with two active children, eight waiting and a ten-second admission deadline per Node process. Use an allowlisted child environment, disable stdin, cap decoder pixels, threads, individual allocations and output, and wait for actual process close after timeouts before releasing admission.
- [x] Sample from the first frame. Required moderation refuses if no frame can be checked. Refuse over-budget output and unavailable metadata cleanup rather than storing raw media in any environment.
- [x] Exercise a real sub-half-second clip and a size-ceiling refusal. Eleven real PostgreSQL media tests verify reel transcode, private story playback/expiry and refusal without storage on both screening and metadata failures. Four Chromium regressions pass against the restarted local API.
- [x] Verify backend TypeScript and the route contract, auth, validation and parsed-input checks. Backend unit coverage passes across 513 suites / 7,211 cases: 510 suites passed in the broad run and all 19 cases in the three upload suites passed after their test fixtures explicitly supplied a moderation policy.
- [ ] Add aggregate admission and temporary storage budgets for multipart uploads before decoding. Verify separate OS-level worker isolation, quotas, representative load and provider behavior in authorized staging. Frame sampling is not a full video moderation assessment.

### 2026-11-05: Private Story Media And Retention

- [x] Add the server-owned `StoryMedia` ledger and migration 88. Web and native upload screened media through the private story path. A ready upload can be claimed once by its owner and cannot be read, presigned, or deleted through generic media routes. Stored keys are not emitted by the Stories APIs.
- [x] Require a current authenticated audience for media GET, HEAD and range requests. The original story URL stops working at expiry or deletion, including for its owner. Close-friends removal and blocking apply to subsequent byte requests. Highlights are separately authorized and preserve the original audience; only live managed stories can be pinned. Web revokes in-memory blob URLs when they expire or the viewer changes. Previously downloaded copies cannot be recalled.
- [x] Separate logical access from physical cleanup. Unpublished drafts have a one-hour deadline; published files are eligible once their last story/highlight reference is gone. A row lock and rechecked references fence publication before the worker deletes bytes. Missing files are handled idempotently and storage failures retry. Ordinary account erasure includes the private story folder. Backups, noncurrent bucket versions and physical media erasure are separate policies.
- [x] Suppress legacy raw URLs in story/highlight responses rather than assigning ownership from untrusted historical references. The read-only local migration inventory found zero untracked story rows, highlight items or custom covers. That is a database count, not proof that older public files or copies no longer exist. No legacy public files were moved or deleted.
- [x] Register the new ledger for metadata export and explicitly retain the minimal cleanup record until storage deletion succeeds, including an upload still finishing when its owner erases her account.
- [x] Prove eight cases on disposable PostgreSQL and real local storage, including image ranges, FFmpeg video, session/audience refusal, immediate expiry, highlight pins, concurrent claims, failed-delete retry, draft cleanup, account erasure and preservation of legacy media. Twenty existing export/erasure cases and four Chromium cases also pass. Browser testing surfaced and verified the fix for the swipe area blocking the delete button. The production storage flag stays off until an authorized bucket/CDN check proves the `stories/` prefix is private.
- [x] Verify the 512 backend, 225 web and 52 native unit suites, source/test type checks, route contract and auth checks, the 293-page production web build and both Hermes exports. The local browser fixture has no remaining story rows or managed assets after the normal cleanup worker ran.
- [ ] Before any hosted rollout, verify actual S3/CDN policy, transport, storage retry monitoring, lifecycle/version and backup rules. Review any known legacy URLs with owners and reference evidence rather than deleting shared uploads. Physical phone/device cache checks and the independent penetration assessment remain separate.

### 2026-11-05: 100-Step Security Re-Audit

- [x] Reconcile all 100 objectives against the current code and dated evidence. Steps 10, 14, 17, 18, 26, 28, 36, 57, 58, 90, 93, 94, 96, 98 and 99 remain partial or pending. Implemented steps may still have separate launch gates. See the [100-step evidence audit](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md) and [security findings and follow-ups](tools/plan-audits/security-gap-review-2026-11-05.json).
- [x] Patch newly flagged `follow-redirects`, `joi`, `glob` and `minimatch` ranges; refresh all three locks. Remove the unused mobile Babel resolver that depended on glob's former default export. Keep supported legacy consumers on their existing ranges and retain the unsuppressed low `deepmerge` finding. Android/iOS Hermes exports contain 1,205/1,206 source modules respectively and neither `deepmerge` nor `node-forge` source.
- [x] Stop owner-scoped story deletion and expiry from deleting files based on a story URL. Retain referenced media and viewer-safe database expiry. Require an explicit public media namespace at publication and processing boundaries, refuse private or noncanonical paths, and reject local symlink aliases. Stories are ephemeral feed entries, not self-destructing files; the web copy now says shared links may still work. Do not purge legacy media without ownership/reference and retention proof.
- [x] Restrict FFmpeg's local inputs to supported media formats and the file protocol, and keep failed processing hidden rather than publishing raw input. Limit multipart fields/parts and bound web auth/API request streaming and upstream response-header waits. Do not follow upstream redirects with session or signed identity headers. Apply the same signed-out page-shell gate to localized URLs; API authorization remains authoritative.
- [x] Repair the route contract checker so unrelated routes of equal length cannot match, literal shadowing remains detectable and finite web recovery/native social auth paths are resolved. Four new checker regressions pass; 1,155 web and 163 native call sites resolve against 1,238 distinct server routes. Route-auth, validation and parsed-write checks pass.
- [x] Run the expanded [loopback API baseline](tools/plan-audits/local-penetration-baseline-2026-11-05.json): 21 scenarios, 88 requests, four synthetic accounts, provider networking blocked and disposable API/database cleanup passed. New checks reject private-media publication, prove deletion of a legacy story does not remove the private fixture it references, and reject unexpected upload fields. All four verifier scope/budget tests pass. This is an internal regression baseline, not independent penetration testing.
- [x] Rebuild and restart the isolated API/web stack. The 34 targeted production-build browser cases pass without skips or retries, including localized admin, malformed/oversized authentication bodies and cross-origin auth refusal. Full web/native unit checks and targeted backend regressions pass. No hosted site or provider account changed.
- [x] Implement ownership-bound retention and audience enforcement for newly uploaded story media; see the follow-up above. Do not infer ownership or auto-purge legacy public objects.
- [ ] Verify actual bucket/CDN ACLs, version/backup retention, hosted proxy/body/time limits and worker sandbox limits in a separately authorized staging review.
- [ ] Keep live-surface cluster refusal until missed revocation, partition/reconnect and multi-host capacity are addressed. Finish or explicitly scope out ordinary SMS, sponsored mixing, full localization and offline/device behavior. Remaining external gates include monitoring/alert delivery, provider/payment proof, legal/privacy review, signed-device/store testing, DNS/TLS, off-device recovery/PITR and an independent penetration test with remediation and retest.

### 2026-11-05: Shared Platform Icon Design

- [x] Promote the homepage treatment to the shared `AthenaIcon` component. Use rose, orchid, gold, mint and sky with a fine inset edge. Reserve the small star stamp for featured marks and empty states; keep compact rows and tool controls simple. Glyphs remain decorative beside named controls and their hover movement respects reduced-motion preferences.
- [x] Apply the palette to the member dashboard, its sidebar and modes, search and account controls, public page shells and footer, the wellness and car directories, and the admin overview. Use a compass for the workspace, a feather for creation and a heart speech bubble for mentoring and messages. Preserve data, destinations, unread indicators, safety actions and staff role checks.
- [x] Keep expanded, compact and mobile navigation labels accessible, preserve the visible mobile skip target, and validate saved mode choices. Restore focus when dismissing global search and use the existing application timestamp on the overview. All 223 web unit suites / 1,582 cases pass, including icon, dashboard, search and admin regressions.
- [x] Rebuild all 293 pages with TypeScript checking and pass all 30 production browser cases without skips or retries, including real member sign-in and desktop/phone layouts. Separately inspect the read-only admin overview with a disposable two-factor account, then verify cleanup of its temporary API and database. Inspect the light desktop and dark phone screenshots under `.local/platform-icons/`. Leave the local site running at `http://localhost:3000/`; no hosted deployment or change to operator credentials, permissions or records.

### 2026-11-05: Compact Homepage Navigation

- [x] Replace the homepage's wide row of individual links with a shorter header and three compact groups: Social (Reels, Communities, Events, Wellness), Wealth (Finances, Salary, Cars), and Career (Jobs, Mentors, Learning). Keep direct search, brand-to-home, theme and account controls. Wellness and Cars retain their full directories on their overview pages. The homepage video rail, member dashboard navigation and mobile bottom shortcuts remain intact.
- [x] Reuse the same groups in the phone menu with accessible disclosure controls and clear destination labels. The 11 preview browser checks cover all group destinations, keyboard focus and Escape, outside-click dismissal, mobile navigation and scoped dark-menu accessibility at 320px.
- [x] Rebuild all 293 pages with TypeScript checking and pass all 19 targeted production browser checks without skips or retries (four navigation, seven smoke, eight branding). The live local feed still returns200; inspected desktop and phone screenshots show a 59px header without crowding. Leave the rebuilt homepage open at `http://localhost:3000/` with the existing local backend. No GitHub push, deployment or hosted-site change.
- [x] Refresh the homepage icon styling with rose, gold, orchid, sky and mint accents across category menus, reel topics and mobile shortcuts. Keep the 59px header, existing destinations and accessible names. Decorative icons tilt on hover only when reduced motion is off. Inspect light desktop and dark phone screenshots, confirm the local feed returns200, and pass a fresh 293-page TypeScript-checked build and all 19 targeted browser cases. Local evidence is in `.local/icon-preview/`; nothing was published.

### 2026-11-05: Local Homepage Branding And Advertising

- [x] Inspect all five supplied MP4s from `C:\Users\mutir\OneDrive\Desktop\MP4s`. Use the ATHENA founder tour plus the money, sport and skilled-trades clips. Exclude the long WhatsApp room/ceiling recording from public assets and playback; leave every source original untouched.
- [x] Prepare four complete web-ready H.264 MP4s and lightweight posters under `athena-platform/client/public/media/branding/`, reducing the selected videos from 154.72MB to 20.93MB. Strip container metadata, preserve the tour's audio and retain the other three as silent originals. Record source/output SHA-256 fingerprints and refuse unverified overwrites in `tools/prepare-branding-videos.cjs`; see [media receipt](tools/plan-audits/branding-media-2026-11-05.json). No source file is moved, deleted or uploaded.
- [x] Replace only the formerly empty homepage left spacer with ATHENA branding, an on-demand film player, full four-film playlist, previous/next controls and expanded viewing. Use posters with `preload="none"`, muted/no-autoplay playback, native controls after starting, pause on hidden/offscreen/selection/close, and a working error/retry state. Below desktop width, use a compact film launcher and keyboard-accessible dialog with close/Escape/focus restoration. Preserve the existing discovery/feed surfaces and unrelated local changes.
- [x] Connect the advertising link to `/contact-sales?intent=advertising`, with campaign-specific copy and the existing lead form carrying `interest=advertising` and `source=CONTACT_SALES`. Verify the form's submission payload with an intercepted browser request; do not claim a new persisted lead or an automatic ad booking/payment. No external ad pixels, invented paid partner relationship or fake sponsored placement is added.
- [x] Verify nine new focused unit cases, the full 222-suite/1,577-case web unit run, fresh production build and all15 targeted production-browser cases with zero skips/retries. Actually decode/play all four prepared videos, test media failure/recovery, inspect desktop/narrow-desktop/phone/dark screenshots, and check scoped rail/dialog WCAG2A/AA/2.1AA rules. A separate unmocked local feed visit and actual desktop/phone play-button clicks pass. These automated checks are not full accessibility certification; review captions, descriptions and distribution rights before publishing the clips.
- [x] Leave the updated production web at `http://localhost:3000/` with the existing local API/database/Redis/search/workers and unchanged operator credentials. Keep all source changes, derived media, evidence and preview screenshots local. Do not push to GitHub, publish assets or alter the hosted site. Backend/native/security and external launch gates retain their previously dated evidence.

### 2026-10-30: Plan Gap Review And Security Hardening

- [x] Re-read all 100 evidence rows and compare their dates, remaining work and source links with the master document. The generated table still has October 25 baselines and omits the subsequent administrator, native mitigation and encrypted recovery work; reconcile it after the new verification completes. Keep code implementation distinct from local verification and external release approval.
- [x] Run fresh read-only official-registry audits before changing dependencies. New findings include a moderate server `qs` advisory and low `deepmerge` tooling entries; the native signing advisory now has an available upstream release. Preserve these findings rather than treating October 26's clean server/web reports as current clearance.
- [x] Reproduce two boundary failures in failing regressions: direct `X-Forwarded-For` controls the API's assumed address under blanket hop trust, and the old private-address classifier misses expanded IPv6 forms. Default ordinary proxy trust to none, require explicit ingress IP/CIDRs, and let the web signer use only an ingress-controlled header without an unsigned fallback. Replace regex-based IP classification and pin every outbound fetch hop to a validated public DNS answer, with bounded redirects, timeouts, port restrictions and credential-header stripping. The first 49 focused backend cases and eight web proxy cases pass; broader verification remains pending.
- [x] Review the published `node-forge@1.4.2` RSA implementation and install it through a compatible native override. Remove the local crypto backport; a read-only version/source-integrity guard now checks the reviewed upstream implementation through normal npm entry points. All 50 signing/toolchain checks pass, including malformed DigestInfo refusal, actual Expo certificate/CSR/manifest signing and a clearly labelled in-memory canonical-check-disabled negative control. No real signing material, hosted changes or EAS build/submission is used.
- [x] Refuse unknown/unset runtime modes and development/test mode under a production hosting context; staging/preview with real accounts must use production controls. Seven new runtime regressions pass, while unrelated warnings remain tolerated only in explicit development/test.
- [x] Recheck private-channel socket recipients at delivery on every receiving instance, evict removed subscribers without content, and clear revoked conversations plus stale callbacks in the web UI. Socket typing now checks membership, account standing, reply permission and a bounded per-account throttle. All 26 actual independent-API socket cases pass, including two-device removal, public-to-private changes and forged relay refusal; the wider integration run remains in progress.
- [x] Retire bank linking, statement import/sync, deduction scanning and bank-derived round-ups, including the separate automotive statement matcher. Remove their implementation/UI/client calls and Basiq configuration example, with content-free 410 tombstones. Card checkout, provider-managed payouts, invoices, manual payment records, Stripe verification and ledger exports remain. Preserve existing database/audit records and migration history for lawful retention/export/erasure; no provider consent is revoked remotely or original data purged.
- [x] Complete fresh six-profile unsuppressed audits, 52 native suites/432 cases, 50 signing/toolchain checks, 11 contract/release checks, source types, reviewed upstream clean registry/offline installs and fresh Android/iOS exports. Native artifact creation now additionally requires explicit approval and a reviewed exact EAS CLI pin. Low findings remain open rather than downgrading Expo/Jest incompatibly.
- [x] Complete a guarded local API baseline: 18 adversarial scenarios and 83 requests against a generated database on 127.0.0.1:5007, with four synthetic accounts, real administrator recovery-code login and no external provider traffic. Authentication/2FA replay, stale-role refusal, IDOR/blocking, private-file ownership/traversal, CORS, headers, metrics, malformed/oversized bodies, retired routes, logout and spoof-resistant budgets pass. The final rerun uses the actually issued browser refresh cookie as the wrong-kind bearer token, checks HttpOnly and JSON omission, and logs out with the actual cookie. The API stops and only its fresh database/files are removed. Four scope/budget/response-bound tests pass. [Measured baseline](tools/plan-audits/local-penetration-baseline-2026-10-30.json) is internal preparation, not independent penetration clearance.
- [x] Finish startup/configuration hardening, broader regression runs, all six post-remediation audits and clean-install/export verification. Residual low-severity tooling findings remain unsuppressed and explicitly require further review; no incompatible Expo/Jest downgrade is used.
- [x] Record the reproducible local baseline, exclusions, cleanup and independent-assessor handoff above. This is preparation and internal adversarial verification, not a penetration-test certificate or permission to scan the hosted site.
- [x] Finish the full backend/unit/database and web-unit reruns: 511/7,205, 20/630 and 220/1,568 respectively, with zero skips. The 293-page production webpack build and source/test types pass. Regenerate stale Next development route types through Next itself after removing the banking page; do not restore the retired route or disable type checking. Current contract/auth/body checks pass, including explicit public content-free retirement tombstones.
- [x] Reconcile the current measured results and regenerate all100 evidence rows, validating496 existing evidence paths and retaining explicit code/product, production/provider, legal, device and independent-review gaps. [Security gap review](tools/plan-audits/security-gap-review-2026-10-30.json) records the results, retired banking scope and dated older evidence. Recheck all source/test/web types, review finance/tax screenshots at desktop/phone sizes, pass all98 browser journeys and18 member smoke checks, and leave the ordinary local web/API/Redis/search/workers running. No full-plan completion, public launch or independent penetration clearance is claimed.

### 2026-10-26: Local Encrypted Backup And Restore

- [x] Add Windows-local backup tooling pinned to the portable PostgreSQL instance at `127.0.0.1:5442`. Refuse other hosts, ports, roles, source databases, connection overrides and data directories. The working database is read through a repeatable-read, read-only snapshot; an attempted no-op write is refused. Every restore/write/drop is limited to fresh generated databases owned by that invocation. No production backup workflow, cloud provider or hosted data is used.
- [x] Stream the actual custom-format `pg_dump` directly into AES-256-GCM encryption without writing a plaintext source archive. Keep archives under `%LOCALAPPDATA%/ATHENA/LocalBackups/<id>`, outside OneDrive and the repository, with owner/SYSTEM-only ACLs and a Windows DPAPI CurrentUser-protected random key. Encrypt the snapshot manifest, per-table counts/keyed fingerprints and required application decryption keys; do not publish member rows, credentials or table-level population details.
- [x] Restore a fresh encrypted snapshot and independently reopen the retained archive from disk. Authenticate the manifest/archive completely before `pg_restore`; pass ciphertext/tag corruption, truncation, wrong-key, wrong-purpose and manifest-tamper refusal controls before creating a target. All 243 tables retain exact snapshot counts/content and selected logical schema definitions. Normalize dropped physical column slots without weakening visible column-order/default/type comparison.
- [x] Prove imported-snapshot consistency with concurrent synthetic changes on a disposable restored clone. The subsequent dump restores the held pre-change state, including detection of changed row contents without a row-count change. Use the actual safety planner/SQL twice to verify protective replay and idempotence, flag lifted blocks for manual review, detect and explicitly re-erase only the synthetic deleted account, restore bans and revoke copied sessions.
- [x] Start an isolated API on the recovered clone with fresh JWT signing keys, providers/workers/shared infrastructure disabled and external HTTP refused. Real password login, current-user and safety reads, suspended/erased login refusal and logout/session revocation pass. A synthetic administrator's encrypted authenticator survives the dump/restore: password alone is refused, actual TOTP login and staff access succeed, and ordinary-member staff access stays forbidden. Only archive-supplied application key material is used, including any previous decryption keys; no operator credential is retrieved for login or reset.
- [x] Harden stream/empty-envelope failures and archive overwrite guards; preserve pre-existing partial output. Refuse simultaneous verification of the same archive through an exclusive file lock. Cleanup failures force a failed result instead of successful evidence. Pass all 13 Windows-local tests with zero skips, plus all 59 cases in the three existing restore-safety/runbook suites. Verify both table-owned and default-referenced sequences, including the search revision counter; collision, exhaustion and unmapped-reference controls are covered.
- [x] Finish the final saved-archive repeat in 24.47 seconds (whole local drill, not a production recovery-time objective). Working, unowned and populated restore destinations are refused. Stop the isolated API, drop both generated databases and remove plaintext, replay, test-log and lock files. Independently inspect the retained directory: only `database.enc`, `manifest.enc`, `key.dpapi` and `receipt.json` remain, with restricted ACLs. Confirm zero generated restore databases remain, port 5008 no longer serves the drill and the normal web/API still return 200. Retained verified archive: `%LOCALAPPDATA%/ATHENA/LocalBackups/b4d23c3f78dc518043c52a769cd8f77d` (1,195,700 encrypted archive bytes). No hosted change, deployment or cloud backup upload was performed.
- [ ] Production approval remains open: off-device encrypted copies and independent key escrow, actual retention/restore ownership, media recovery, hosted failover/rollback, point-in-time recovery where required and reconciliation of real erasures/lifted protections before restored traffic. Redis jobs require reconciliation and OpenSearch needs a safe fresh-index rebuild; neither is recovered by this database archive. DPAPI recovery depends on this Windows user/profile; this is not a portable disaster-recovery key. No scheduled backups or secure SSD erasure are claimed.

Local operator commands, from `C:\Users\mutir\OneDrive\Desktop\mari`, with the existing portable PostgreSQL cluster running and loopback port 5008 free for the disposable API. Run drills one at a time:

```powershell
# Create a new encrypted source snapshot and verify it in disposable databases.
node tools/verify-local-backup.cjs
# Reopen the retained snapshot and repeat recovery without taking a new source dump.
node tools/verify-local-backup.cjs --backup b4d23c3f78dc518043c52a769cd8f77d
# Exercise the backup tool's focused regressions.
node --test tools/local-backup.test.cjs
```

The command deliberately never promotes a copy or overwrites the working database. Keep all four archive files together and private; `key.dpapi` alone is not usable on another Windows profile. Failed/incomplete attempts are not verified backups. Unexpected process/PC termination can leave a restricted plaintext temporary file or stale `verification.lock`: do not bypass the lock or bulk-delete backup folders; privately inspect the exact run and confirm its process is stopped before any manual cleanup. Production recovery needs the existing on-call safety reconciliation and operator approval, not just this synthetic drill.

### 2026-10-26: Native Signature Verification Mitigation

Historical evidence below records the October26 state. The local backport and its installer were retired on October30 in favor of published upstream1.4.2 with a read-only source-integrity guard; the current command verifies that upstream release. The current audit, clean-install/export results and remaining independent-review gate are recorded above.

- [x] Recheck the npm registry and the primary advisory: `node-forge@1.4.0` remains the latest published release and [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) has no patched release. Review [upstream PR 1159](https://github.com/digitalbazaar/forge/pull/1159), pinned at `db05494352dd3c9a5a07c5270333dcc78866cad2`; the earlier nested-element-count proposal does not cover NULL content or non-minimal encodings. Do not downgrade Expo or rename the package to hide the finding.
- [x] Install a local Node verifier backport with canonical DigestInfo checks, preserving the original package identity/version. `mobile/scripts/node-forge-backport.cjs` pins original/patched SHA-256 hashes, checks every locked installed copy, rejects unexpected versions/source/paths and applies idempotently through `postinstall`. Normal npm start/build/test entry points require the checked patch. This is a compensating control based on an unmerged proposal, not a maintainer-reviewed release or independent security sign-off; browser forge distributions and global EAS tooling are outside its scope.
- [x] Pass 50 installed-dependency/toolchain checks. A child-process negative control reconstructs the exact original RSA source in memory: it accepts 14 malformed encodings (seven variants, exponents 3 and 65537) that the installed mitigation rejects. Cases include nested garbage, non-NULL parameters, NULL content and non-minimal outer/inner/digest/OID encodings, plus existing outer/trailing-data refusal. All keep real PKCS#1 padding checks enabled. These private-key-constructed fixtures exercise parser acceptance; they are not a demonstration of private-key-free signature forgery or an exhaustive cryptographic proof.
- [x] Verify actual Expo consumers share the patched Node implementation: certificate/key PEM roundtrips, self-signed certificate validation, CSR verification, manifest signing with independent Node/OpenSSL verification and tampered-message rejection pass. OpenSSL SHA-256/384/512, optional NULL parameters, wrong-digest refusal, PSS and NONE behavior remain covered. All 52 mobile Jest suites / 432 tests and native TypeScript pass.
- [x] Finish separate clean registry and fully offline scratch installations: automatic postinstall applies the checked backport, all 47 security regressions pass in each fresh tree, lockfiles are unchanged by installation and both scratch directories are removed. The first offline attempt correctly stopped on an uncached archive and cleaned itself; only official registry package downloads were used to fill the cache before the successful offline rerun. The app's own dependency installation and operator data were not removed.
- [x] Repeat offline Android/iOS exports with source maps and verify actual Hermes bytecode headers, assets and source graphs (1,205 Android / 1,206 iOS modules), excluding node-forge from both app bundles. Recheck all six dependency audit profiles: server/web stay clean and native still has five affected entries from this advisory. No dependency versions changed; the sole lockfile change is the root install-hook flag.
- [x] Add signing/toolchain checks to native CI and an unsuppressed high-severity lockfile audit before the artifact build job receives Expo credentials. The actual audit returns exit 1 as expected; native artifacts/submission remain blocked. Repair the API-contract checker's TypeScript resolution for mobile-only dependency installations and pass all 10 contract/release-policy regressions. No remote workflow was run. [Final measured evidence](tools/plan-audits/native-signature-mitigation-2026-10-26.json); repeat with `node tools/reconcile-native-security.cjs <absolute npm-cli.js path>` after the two clean-install verifiers and offline exports.
- [ ] Keep the five registry advisory entries and native release gate open until a compatible maintainer-reviewed release and independent review are available. No advisory suppression, altered audit threshold, remote EAS build/submission or hosted change is authorized or claimed.

### 2026-10-26: Launch Readiness Review

- [x] Resume local launch preparation without changing hosted code, provider accounts or operator credentials. Restore the isolated PostgreSQL, Redis/search infrastructure, API and web application; continue the incomplete admin audit before accepting its results.
- [x] Repair the launch CI API-contract checker: traverse nested and pathless router mounts using the TypeScript syntax tree, preserve registration precedence and include inline API routes. Resolve finite auth endpoint/provider unions from actual TypeScript types rather than suppressing unknown paths. Keep intentional upload/consent parameter branches explicit. All 11 checker/audit-tool regression cases pass; 1,168 web and 163 mobile call contracts resolve against 1,248 server routes. Add checker regression tests to CI; no remote workflow was triggered.
- [x] Refresh all six npm registry lockfile audits without installing packages or changing locks: server/web runtime and full graphs have zero findings. Native retains five affected entries for the existing unpatched Expo signing-tool advisory. Evidence: `tools/plan-audits/dependency-security-refresh-2026-10-26.json`. This is not a clean native or public-launch security approval.
- [x] Pass all 511 backend suites / 7,194 tests. Complete the expanded isolated admin API probes (227 operations) and all 43 persisted workflow journeys, including housing CSV preview/import, impact reporting and accessibility employer lifecycle. The initial populated browser pass still requires mobile layout repairs and is not marked complete.
- [x] Diagnose the grant editor's remaining phone overflow as an absolutely positioned screen-reader table label escaping its scroll container; contain it and make the base editor grid explicitly single-column. Add scrolling to the populated disclosures table. The fresh general browser run passed 95/96 and exposed one stale sign-out test selector after the account menu gained its stable accessible name; update the selector without changing authentication behavior.
- [x] Finish the TypeScript-checked 294-page production build and all 220 frontend suites / 1,563 tests. The final admin sweep passes 110 desktop/phone visits across 55 pages, including initial and every tab state, and all 11 actual UI action journeys. All 227 operation probes and 43 persisted API workflows pass; the generated database/API are removed. Review repaired mobile grant/disclosure and accessibility screens plus desktop group controls. The repeat general browser run passes 96/96 with zero skips/retries, and launch smoke passes 18/18 plus actual local TLS verification. [Final measured evidence](tools/plan-audits/launch-review-2026-10-26.json) explicitly distinguishes local checks from public-release approval. Leave the local app running at `http://localhost:3000/admin`.
- [ ] Public release remains gated on real payment/webhook/payout verification, secure hosted infrastructure and backup/rollback rehearsal, authenticated production email/DNS/TLS, required moderation/storage providers, legal/compliance approval and the unresolved native advisory/device/store checks where native is in scope. No placeholder credentials, local simulations or test counts replace these gates.

### 2026-10-25: Full Local Staff Console Audit

- [x] Inventory the original 52 staff pages and uncover three embedded staff workflows. Add direct admin entries for housing supply/imports, impact reports and accessibility employers, reusing their existing components. The expanded inventory has 55 pages and 227 API operations / 139 writes; every operation resolves to a mounted backend handler. The broader legacy API-contract script has unrelated non-admin findings and is not claimed clean.
- [x] Complete the first real two-factor, read-only browser sweep at desktop and phone sizes (104 page visits), preserving operator data and cleaning the generated actor/session. It exposed mobile overflow in Grants and Groups and a transient staff query during session restoration; the initial report remains review-required, not a passing claim.
- [x] Prevent the admin layout from mounting staff content while any cached session is still being restored. All 11 role/loading regression tests pass, including a restored account losing its admin role. Adjust Grants grid sizing and Groups layout, and expose group-list/mutation and grant-list failures instead of silently presenting empty data. Final browser verification is tracked separately.
- [x] Complete isolated action probes and positive journeys, finishing on 2026-10-26 after repairs: all 227 probes and 43 persisted API workflows pass. The action harness creates its own generated local database/API, disables providers/workers/shared infrastructure, refuses external HTTP and removes only that fresh database afterwards. It never changes the operator database or hosted data. Probes cover authorization/validation/not-found paths, not every successful variant of every action.
- [x] Reproduce 33 profile-gated staff operations outside `/api/admin` and fix them with an exact method/path, live-role-bound exemption list; also cover shared event editing and the linked automotive dispute action. Staff second-factor, closed-account, ordinary-member age/verification, ownership and review-evidence checks remain in force. All 89 focused middleware/admin-validation cases pass.
- [x] Refuse empty job/subscription updates as 400 and return 404 when a record disappears during an update instead of leaking a database 500. Staff invoice re-issue now refuses with a clear 503 before attempting Stripe if keys are absent; all 25 invoice-route tests pass.
- [x] Add retry/error states to Grants, Groups, the Marketing hub and the admin index; transient statistics failures no longer claim the administrator has lost permission. Link the previously unlisted formation review queue from the index, and put automotive admin pages behind the same session-restoration/staff layout.
- [x] Complete the first isolated 213-operation probe pass and 40 positive workflow journeys. The populated browser audit found premature notification requests in the dashboard shell and grant-form overflow on phones; add authenticated/restored-session notification gating and responsive form sizing. Extend the exact staff policy to six embedded impact operations without relaxing member or evidence requirements. Expanded final verification remains pending.
- [x] Complete the final 2026-10-26 verification: all 220 frontend suites / 1,563 tests, all 511 backend suites / 7,194 tests, backend source TypeScript and the frontend TypeScript-checked 294-page production build pass.
- [x] Rebuild and finish the complete browser/action sweep on 2026-10-26, with screenshots inspected and the local app left running. All 55 staff pages, their tabs, 11 actual UI action journeys, 96 general browser journeys and 18 launch smoke checks pass. Real provider payments/payouts, external email, production operations and legal approval remain explicitly outside this local verification.

### 2026-10-25: Local Administrator Access

- [x] Provision a dedicated private local ADMIN account at the user's request, without altering existing members or hosted data. Generate its password into ignored `.local/admin-access.json`; credentials are not included in this document or the evidence reports.
- [x] Verify real password sign-in and access to two-factor enrollment. Confirm the admin API refuses access with `TWO_FACTOR_REQUIRED` until enrollment is completed, then close the verification session. No role, authentication or second-factor guard was bypassed.
- [x] Confirm the operator has since enabled two-factor sign-in and changed their password. Preserve both; the originally generated password file is not a current credential and must not be reused to reset access.
- [x] Add role-aware Administration (`/admin`) and Moderation (`/admin/moderation`) entries to the member sidebar/mobile navigation and account menu. Collapsed links retain accessible names and hover labels; non-staff accounts receive neither entry and role changes remove stale entries immediately. All 14 dashboard-shell tests and frontend TypeScript pass.
- [x] Prove real authenticated staff access to 15 assembled backend endpoints, with anonymous 401 and ordinary-member 403 for every endpoint. A disposable administrator without member DOB, verification or paid subscription can use these staff tools after real two-factor login. Change and restore only a disposable member's role, confirming both persisted changes and their two audit events.
- [x] Prove the path from Creator Studio to the administration console through both navigation and account menu at 1440px desktop and 390px phone sizes. Read real user search, the moderation queue and platform settings; inspect screenshots and confirm no admin-index horizontal overflow. Remove the exact two fixture actors, their sessions and audit rows afterwards. Preserve the operator's existing password, second factor and profile.
- [x] Pass all 216 web unit suites / 1,541 tests, frontend TypeScript and the 291-page production build, then restart only the local application with existing local Redis/search infrastructure. Leave it running at `http://localhost:3000/admin`. [Admin access evidence](tools/plan-audits/admin-access-2026-10-25.json); repeat with `node tools/verify-local-admin-access.cjs` while the loopback app is running.
- Scope: administrator access does not fabricate paid billing records, personal verification or provider credentials. External payment, streaming and AI integrations still require their documented setup; this is not a claim that all launch blockers are resolved. Hosted code and hosted data are unchanged.

### 2026-10-25: Redis And Durable Search Continuation

- [x] Add one Redis connection factory used by shared/cache clients, BullMQ producers and both worker entry points. Opt-in authenticated/TLS cluster seeds use primary reads and bounded reconnects; single-URL deployments retain their existing keys and queue namespace. The first 56 focused Redis/queue/AI-budget regression cases pass; real multi-node proof is tracked separately below.
- [x] Replace blocking pattern `KEYS` and cross-slot multi-key deletion with bounded primary-node `SCAN` and single-key deletion. Give each cluster BullMQ queue a matching hash-tag prefix on producer/consumer, and keep the AI daily multi-key count in one daily hash slot.
- [x] Verify actual local multi-node Redis-compatible operation with signed Memurai Developer 8.2.0: three primaries/three replicas, shard-safe scan invalidation, counters/expiry, the actual AI-budget pipeline on an unused synthetic future day, independent worker crash/retry recovery, primary loss/replica promotion, 220ms optional-cache refusal during an all-node outage and AOF-backed queued work processed after all six nodes restart. Exact fixtures are cleaned. Missing periodic replica topology refresh and misplaced cluster offline-queue configuration were corrected during these real checks. This is a Windows-compatible development proof, not native production Redis clearance.
- [x] Implement transaction-owned search change capture for users/posts/jobs/courses/videos/mentors and dependent profile/skill/catalogue edits, bounded lease-based retries, restartable keyset backfill, external revision ordering and content-free queued resource references. All 23 real PostgreSQL cases pass, including source rollback, concurrency, expired leases and stale delivery acknowledgement.
- [x] Apply migrations 85-87 to the three isolated local databases. The first real retry/lease run exposed a database-timezone/UTC mismatch; migration 86 preserves references/cursors and uses timezone-aware instants. The repeat suite also verifies a writer transaction in Pacific/Auckland. Migration 87 ties checkpoints to actual index names/UUIDs so deleting and recreating an index cannot inherit an obsolete completed backfill. New local database connections default to UTC. No hosted database was accessed.
- [x] Run actual OpenSearch 3.9.0 from the checksum-verified official Windows ZIP, with workspace data and a 512MiB heap, bound only to loopback. The real-engine verifier passes all nine checks: mappings, six-source backfill/search, minimal indexed user data, HTTP outage/retry/read fallback, rejection of stale external versions, live block filtering, lifecycle removal, immediate read fallback before the next tick after index recreation and rebuilding the recreated index. Read readiness compares actual engine UUIDs, not just stored metadata. Unique test indices and exact disposable actors are removed; app/hosted indices are untouched.
- [x] Keep authoritative database search active whenever an indexed source has pending changes or incomplete backfill. Catalogue queries deliberately retain Prisma filtering/paging while their index-backed query parity remains a separate check.
- [x] Document portable service provenance, development licensing, loopback ports, restart ownership, isolated fault-proof procedures and resumable search operations. Default tests still disable shared Redis/search. Ordinary Prisma query logging is now explicit opt-in to avoid flooding local API logs.
- [x] Verify the actual standalone application workers against the six-node cluster, not just an echo queue: a generated clip is queued, transcoded to H264/AAC, published with poster/sound and fully decoded. A real report-deadline sweep completes, a job queued while the consumer is stopped completes after restart, four recurring schedules remain unique, and both worker processes shut down cleanly through trusted-parent IPC. All six checks pass; unique queue namespaces, exact actors and generated files are cleaned.
- [x] Pass the full PostgreSQL integration run: 20 suites / 625 tests, including all 23 new search cases. Rehearse all 87 migrations with no pending schema delta and preserve 8 fixture users / 1 job / 0 applications. The first schema comparison caught the sequence-default declaration; matching Prisma's autoincrement metadata fixed it without altering the sequence, rows or migration history. The initial review-required report is retained beside the successful repeat.
- [x] Run the explicit resumable search CLI against the local app: all six source checkpoints complete, with zero queued/pending work afterward. Source/test TypeScript and the emitted backend build pass.
- [x] Verify actual request-budget middleware on two loopback listeners with independent cluster clients/stores: shared anonymous counts, forged-token refusal, separate signed-member budgets, fresh-store count retention, real window expiry and the actual sorted-set sliding limiter. All six checks pass and exact counters are removed. This is not multi-host capacity or strict AI spend-reservation proof.
- [x] Measure the real privacy-export generator with 50,000 generated notifications and a deliberately slow consumer: 102,200,527-byte valid JSON, 50.46 seconds, 500-row batches, largest chunk 1,021,912 bytes and 100,371,240 additional peak heap bytes. A separate validator confirms exact count/uniqueness and credential exclusion. All four checks pass; the actor and temporary export are removed. This is one local synthetic cardinality, not exhaustive resource/legal/production clearance.
- [x] Pass all 511 backend unit suites / 7,135 tests using two recycled Jest workers (768MB idle limit, explicit 4GB process heaps). The initial single-process default-heap run exhausted Node's 4GB test heap and is not counted as success. The final 23-case PostgreSQL search recheck also passes after tightening immediate index-generation read safety.
- [x] Re-verify portable package provenance: the OpenSearch ZIP exactly matches its published SHA512; the Memurai MSI has a valid Janea Systems, Inc. Authenticode signature. Extracted workspace binaries require no Windows service, global PATH, firewall or hosted changes. Keep the development-only licensing and ten-day automatic-stop limit visible.
- [x] Refresh all six dependency audits on 2026-10-25 without changing lockfiles: server/web runtime and full graphs remain clean; native still has five affected entries from the one unresolved node-forge advisory. No incompatible downgrade or suppression is used.
- [x] Repeat all nine real local registration, inbox-verification and password-reset checks with Redis/search/workers enabled, including old-session/password refusal, token single use and exact actor erasure.
- [x] Pass all 95 browser journeys with zero skips/retries and all 18 launch smoke checks, metrics and explicit-CA localhost TLS checks on the Redis/search/worker-enabled local app. Inspect the refreshed desktop/mobile reset screenshots. Final read-only readiness confirms every Redis primary reports full slot coverage and all six search checkpoints are complete with zero pending work.
- [x] Clean the isolated integration database after all tests and fault proofs (0 users / 0 groups / 0 socket relay packets), preserve app/rehearsal data, and generate the consolidated 2026-10-25 review from actual result files. Leave the local app and portable infrastructure running for review.
- [x] Reconcile every one of the 100 evidence entries and validate all 476 final cited paths (473 before the added bootstrap regression evidence). All 10 local-runner/query/browser/soak helper checks pass. Record the remaining 13 partial steps and two pending-proof states explicitly; these evidence states are not completion percentages.
- [x] Inspect the refreshed UI screenshots, not just automated accessibility scores: the jobs page exposed a successful-200/failed-render bootstrap race. Confirming an already anonymous visitor now preserves in-flight public reads, while existing-session termination and explicit account changes still cancel stale requests. All 39 focused bootstrap/session/public-auth tests pass, including three new anonymous-versus-authenticated boundary cases. Add a deterministic browser regression and reject rendered catalogue failure states in the shared audit readiness helper. Rebuilt browser/audit proof is tracked below.
- [x] Pass all 216 web unit suites / 1,532 tests, TypeScript and the complete 291-page production rebuild after the bootstrap fix. All 96 browser cases then pass with zero skips/retries. The first controlled delayed-response test timed out because a service worker bypassed its page interception; the corrected test blocks service workers only in that controlled context and always releases test barriers. The ordinary browser cases retain normal service-worker behavior; the incomplete run is not counted as success.
- [x] Repeat the stronger real UI audit after the final build: all eight routes in both light/dark themes finish their primary requests and render without data-failure states, with zero automated WCAG violations across all 16 page states. Refreshed jobs/mentor screenshots show the real fixture listings instead of the bootstrap error. Repeat the nine real inbox/recovery checks and all 18 launch smoke/metrics/local-TLS checks successfully. Qualified manual screen-reader/device certification remains separate.
- [ ] Resolve remaining scope decisions, approved data/translation/provider requirements, native advisory/device constraints and production release gates. The full plan is not complete. No hosted site, provider account or production database changes are authorized or claimed.
- Current evidence: [consolidated review](tools/plan-audits/implementation-review-2026-10-25.json), [Redis fault proof](tools/plan-audits/redis-cluster-2026-10-25.json), [real search recovery](tools/plan-audits/search-sync-2026-10-25.json), [business workers](tools/plan-audits/business-workers-2026-10-25.json), [shared rate limits](tools/plan-audits/rate-limits-2026-10-25.json), [large export](tools/plan-audits/large-export-2026-10-25.json), [package provenance](tools/plan-audits/portable-infrastructure-2026-10-25.json), [fresh dependency audit](tools/plan-audits/dependency-security-refresh-2026-10-25.json), and the regenerated [100-step evidence tracker](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md).

### 2026-10-24: Continuous Local Completion Review

- [x] Resolve the three high-severity server dependency entries with a real Zod 4 / compatible SDK migration and patched request parsing. All 509 backend unit suites / 7,090 tests and 19 actual PostgreSQL integration suites / 602 tests pass, including the two-process socket safety cases. Source/test TypeScript checks and the emitted backend build pass.
- [x] Install patched Express/body-parser and Zod 4 with a compatible OpenAI SDK. The refreshed server runtime/full audits report zero findings. All 18 process-isolated compressed-body, bounded-collection, strict-field and offline SDK regression cases pass; the latest full backend run passes 510 suites / 7,108 tests plus all 19 PostgreSQL suites / 602 tests.
- [x] Refresh and remediate web/native dependency graphs as well: current server/web runtime and full graphs have zero findings. Native navigation/URI/redirect/Undici findings are fixed; one unpatched `node-forge` tooling advisory remains through five affected Expo entries. Keep that release gate visible.
- [ ] Finish the complete 100-step implementation and launch proof. Code/scope gaps and external gates below remain open; this pass does not claim whole-plan completion.
- [x] Run the current backend/web/native unit, integration, type/build, export, browser and launch checks; reconcile all 100 evidence entries and assemble the local review handoff. Historical unchanged ML evidence is labeled separately.
- [x] Pass the dependency-migrated backend unit suite (509 suites / 7,090 tests), full PostgreSQL integration run (19 / 602), web unit suite (214 / 1,509), native suite (50 / 423, including the installed navigation parser), all source/test type checks, the backend/web production builds and both Android/iOS Hermes exports.
- [x] Measure four hot-list queries against 330,000 synthetic rows in temporary tables cloned from the migrated schema. All four candidate composite indexes are chosen by PostgreSQL, with lower warm median execution times; transaction rollback removes every temporary table. Add migration 84 for those indexes. Applying/rehearsing it and production-scale validation remain separate checks.
- [x] Apply migration 84 to all three isolated local databases. The generated-fixture rehearsal passes schema comparison and preserves 8 users / 1 job / 0 applications. No hosted database was accessed.
- [x] Make browser verification repeatable with a loopback-only runner that resets only the named disposable fixtures before the full suite. The initial browser rerun correctly failed on leftover application, membership, two-factor and Safe Mode state from an earlier successful run. The clean seeded rerun passes all 95 cases with zero failures, skips or retries.
- [x] Re-run all 95 browser cases after the final recovery changes, alone with freshly seeded disposable fixtures: zero failures, skips or retries. An intermediate run with two prematurely closed Chromium contexts was not accepted. The final rebuilt app also passes all 18 launch smoke checks, metrics and local certificate/hostname verification.
- [x] Finish isolated ten-minute-hold capacity measurements for 100 mixed-workload actors and 250 sockets, including per-minute local process-memory/event-loop samples. These local results do not replace production sizing or representative data evidence.
- [x] Complete the isolated 100-actor mixed soak: 1-minute ramp / 10-minute hold / 30-second ramp-down, 31,903 requests, zero failed requests, p95 222.42ms / p99 235.32ms, all configured overall/per-surface thresholds met and sampled peak API memory 495MiB.
- [x] Complete the separate 250-socket ten-minute-hold soak: all 250 authenticated sessions and 500 upgrade/peer-delivery checks pass, handshake p95/p99 are 9ms, 57,556 typing notices arrive, connection/delivery failure rates are zero, and no socket is closed unexpectedly by the server. Sampled peak API RSS is 496MiB. Both soaks run on Windows/Node24.19 with generated local actors, no imposed 2GB limit and no concurrent build/browser/integration checks.
- [x] Verify the notification follow-up: one saved-preference policy across in-app/email/push entry points, explicit refusal of unsupported ordinary SMS dispatch before partial delivery, and removal of the unused duplicate Firebase sender. All 65 focused cases and the full 510-suite backend run pass. Trusted-contact panic SMS remains a separate explicit-action service; it is not ordinary notification routing.
- [x] Verify reset-password policy parity on web and native: 12-128 characters and the API's uppercase/lowercase/number/special-character rules, with actual form submission tests. The real loopback inbox/browser journey also proves successful reset, old password/session refusal, single-use reset tokens, new sign-in and exact fixture erasure. Desktop/mobile screenshots show no horizontal overflow. The earlier eight-character UI rule disagreed with the server.
- [x] Verify native authentication return navigation with the installed v7 stack router, including cold reset links, so completed registration/recovery forms are popped rather than left behind a duplicate login screen. All 52 native suites / 432 tests, TypeScript and both Hermes exports pass; physical-device evidence remains separate.
- [x] Fix the real verification-link/session-bootstrap race found by the new local inbox journey. Token-only verification/reset/recovery requests omit cookies/bearer credentials and never refresh or retry one-time tokens; private API session guards are unchanged. All 25 focused transport/form cases pass, including StrictMode single consumption, actual viewer-boundary changes and late old-token replies. The rebuilt real signup/verification/reset journey passes all nine checks with exact fixture cleanup.
- Current evidence: [implementation review](tools/plan-audits/implementation-review-2026-10-24.json), [dependency audit](tools/plan-audits/dependency-security-summary.json), [measured query plans](tools/plan-audits/query-index-2026-10-24.json), [ten-minute soaks](tools/plan-audits/local-soak-2026-10-24.json), [browser verifier](tools/verify-local-browser.cjs), [real email/recovery verifier](tools/verify-local-password-reset.cjs), and the regenerated [100-step tracker](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md).
- Scope: all changes stay on this PC. Public deployment, paid/provider registrations, production data, system-level tooling changes, qualified translation/legal approval and product decisions remain explicit external gates; they must not be represented as completed by simulations or documentation alone.

#### Remaining Review Gates

The complete 100-step plan is still open, not merely waiting for deployment:

- Code/scope decisions: ordinary notification SMS with approved verified-phone/consent rules and delivery provider; sponsored-feed inventory/operating policy; qualified 24-locale domain copy; production-safe global presence and cross-instance lifecycle recovery before scaling beyond the current single API instance. Redis Cluster topology and durable six-source OpenSearch writers/retry/backfill are now implemented and locally verified above. Catalogue search remains fully functional through authoritative database queries; index-backed query parity is an optional performance follow-up, not permission to replace working queries with empty indices.
- Infrastructure/device limits: this PC's Docker Linux engine is unavailable, WSL reports a registration failure and Android device tooling is absent. Portable Redis failover/AOF, real application-worker restart and OpenSearch mapping/recovery checks now pass. Native production Redis/TLS, secure replicated search, physical devices and iOS signing remain unverified; mocks/bundle exports do not replace them. No system tooling was changed.
- Data and product approval: consent/purpose-approved datasets, validated non-synthetic model artifacts, sponsored inventory policy and launch-market/locale decisions remain unresolved.
- External release proof: real payment/payout, email/push/moderation providers; hosted infrastructure, DNS/TLS and monitoring; signed store binaries/device review; operational ownership and qualified legal approval. The native Expo code-signing advisory also remains an upstream release gate.

The [100-step tracker](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md) records these against their individual steps. Evidence-state counts are not completion percentages, and an implemented code path can still have a release gate.

### 2026-10-24: Multi-Instance Socket Safety

- [x] Add an opt-in official PostgreSQL Socket.IO adapter and a migration-owned table for short-lived oversized/binary relay packets. Keep the ordinary local runner on the memory adapter.
- [x] Add a harness that launches independent API processes on ephemeral loopback ports against `athena_test`, using separate authenticated socket devices.
- [x] Reproduce missing remote group delivery, then fix group relays and session revocation across API processes. Each receiving process rechecks its own local membership snapshot, retains blocks and never rebroadcasts the relay in a loop.
- [x] Pass the first 21 multi-process database cases: two-way delivery, stale-member eviction, both block directions, nonmember admission, selective logout/reconnect refusal, notifications, oversized/binary packets, private readmission, pin/removal safety, API restart, relay-spoof refusal, channel isolation and four cross-process administrator races.
- [x] Pass 107 focused socket tests and the full 508-suite / 7,072-test backend unit run. The paired multi-process/administrator integration run passes 41 cases in two suites.
- [x] Keep the adapter explicitly local/test-only: production refuses it until presence, last-device/push semantics and other live surfaces are cluster-safe. Keep every hosted deployment setting unchanged.
- [x] Apply only migration 83 to the local app/test databases, regenerate Prisma, and document the temporary packet table's cleanup behavior. No app database reset or member-data rewrite.
- [x] Re-run all eight live group verification stages and 18/18 local launch smoke checks, including exact fixture cleanup.
- [x] Finish source/test TypeScript checks and repeat all 41 paired integration cases with graceful child shutdown and test-database cleanup. No socket test child processes remain.
- [x] Rehearse migration 83 on the existing local generated-fixture clone: schema comparison matches, no pending migrations remain and core counts stay at 8 users / 1 job / 0 applications.
- [x] Reconcile all 100 tracker entries and validate 432 evidence paths; record the remaining production gates without marking the full plan complete.
- Security follow-up: the fresh server production audit reports three high-severity affected entries (`body-parser`, `zod`, and `openai` through `zod`), representing two advisories. The earlier zero-finding server audit is historical, not a current launch clearance. Compatibility-reviewed fixes remain separate work.
- Evidence: [measured multi-instance report](tools/plan-audits/socket-cluster-2026-10-24.json), [two-process test suite](athena-platform/server/tests/integration/socket-cluster.test.ts), [local verification guide](tools/LOCAL_DEVELOPMENT.md), and the regenerated [100-step tracker](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md).
- Remaining: global presence/last-device and offline-push semantics, live-stream/channel revocation, database partition and missed-revocation recovery, representative load and load-balancer affinity. Redis Cluster is not evidenced; production activation remains blocked.
- Scope: generated test actors, the disposable local test database and loopback sockets only. No hosted setting, deployment topology or production provider changes.

### 2026-10-24: Concurrent Group Administrator Changes

- [x] Serialize group authority checks and membership changes with a PostgreSQL parent-row lock and explicit READ COMMITTED transactions, including the separate staff role-change route.
- [x] Check the resulting active-administrator count before commit; roll back a change that would orphan the group. A final administrator must appoint a successor or explicitly close the group, even when alone.
- [x] Re-read queued actors' authority for invitations, promotions, bans, mutes, private request decisions, settings and closure. Notifications remain after commit.
- [x] Create a group and its first administrator atomically.
- [x] Pass 20 real PostgreSQL integration cases, including observed lock contention, mutual administrator changes, stale authority, banned-row counting, independent groups proceeding concurrently and a block committed while an invitation waits.
- [x] Align the final-administrator UI with the invariant, including accessible leave guidance, a working shortcut to group closure settings and a stacked mobile header. Seven focused client checks pass.
- [x] Pass the full backend regression run: 507 suites / 7,053 tests, with zero failures or skips.
- [x] Pass backend source and test TypeScript checks after the transaction-aware safety reader changes.
- [x] Pass the production web rebuild, including TypeScript and all 291 generated pages; remove only obsolete external generated-type includes from the previous local runtime.
- [x] Re-run real browser guidance/closure navigation at 1440x1000 and 390x844, inspect both screenshots and verify no horizontal overflow. The dedicated UI verifier removes only its disposable account and group.
- [x] Re-run all eight local HTTP/PostgreSQL/Socket.IO group verification stages and all 18 launch smoke checks against the refreshed app, including TLS, metrics and local sinks. Verify exact fixture cleanup and loopback-only listeners.
- Evidence: [measured concurrency report](tools/plan-audits/group-administrator-concurrency-2026-10-24.json), [repeatable browser verifier](tools/verify-local-group-admin-ui.cjs), the integration test, focused client checks and the regenerated [100-step evidence tracker](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md).
- Scope: concurrency tests use isolated `127.0.0.1:5442/athena_test`; live/browser verifiers use only their disposable `athena_local` fixtures. No member database reset, hosted deployment, new provider configuration or production-data access.
- Boundary at this checkpoint: independent API-process testing and cross-instance sockets were still pending here; the newer multi-instance entry above now records local proof. Production fan-out and broader global account-lifecycle coverage remain open. The full 100-step plan is still incomplete.

### 2026-10-24: Step 31 Group Membership And Live Access

- [x] Reproduce stale group-room delivery after membership revocation with failing regression tests.
- [x] Re-read active PostgreSQL membership before broadcasting group messages, pin updates or removals; evict stale subscriptions on all devices and send only to the authorized socket snapshot.
- [x] Fail closed when membership cannot be read, retain block exclusions, and exclude devices that join late or unsubscribe while authorization is pending.
- [x] Await the delivery boundary from the HTTP routes. Add optional group-join acknowledgements without breaking existing clients.
- [x] Verify real private join requests/approval, role demotion, escalation denial, last-admin protection, mute/unmute, leave/rejoin, moderator removal, ban/unban/reapproval and two-device block filtering using only disposable local fixtures.
- [x] Verify fixture cleanup: no test accounts, group or conversation remain. Existing accounts and groups are not modified.
- Verification: 163 tests across six focused group/socket suites; source and test TypeScript checks; eight full-stack verification stages; local launch smoke 18/18, with zero skips. Repeat with `node tools/verify-local-groups.cjs`; measured results are recorded in `tools/plan-audits/group-membership-2026-10-24.json`.
- Boundary at this checkpoint: single-instance, loopback-only evidence. Concurrent administrator transitions and multi-instance sockets are addressed in the newer entries above. Production-scale fan-out and external release prerequisites remain separate work. Nothing was deployed or pushed.

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
- Continued dashboard settings cleanup:
  - `client/src/app/dashboard/settings/appearance/page.tsx` no longer uses decorative local-only accent, font-size, compact-mode, or reduced-motion controls. Appearance preferences now persist through the existing UI store, apply before first paint via the root boot script, and drive CSS variables/classes used by the dashboard UI; the preview also uses the current account identity instead of a hardcoded sample user.
- Re-verified after the appearance settings cleanup:
  - Client production build passes with `npm run build`.
- Continued job detail cleanup:
  - `client/src/app/dashboard/jobs/[id]/page.tsx` no longer uses a local-only saved-job toggle or static "similar jobs coming soon" placeholder. The save button now uses the existing saved-job mutations, share copies or invokes native share, backend `logo`/`isRemote`/job-skill fields are normalized for display, and the sidebar shows live personalized job recommendations from `/api/jobs/recommendations/for-me`.
- Re-verified after the job detail cleanup:
  - Client production build passes with `npm run build`.
- Continued billing settings cleanup:
  - `client/src/app/dashboard/settings/billing/page.tsx` no longer renders hardcoded regional payment "coming soon" sections or a dead checkout link. Billing now reads available payment methods from `/api/payments/methods` through `paymentsApi`/`usePaymentMethods`, maps the user's launch region to the payment routing region, and opens checkout through the existing subscription mutation.
- Re-verified after the billing settings cleanup:
  - Client production build passes with `npm run build`.
- Continued finance/accounting cleanup:
  - `client/src/app/dashboard/finance/accounting/page.tsx` no longer shows a disabled "Refresh (coming soon)" action. The trial-balance card now refreshes live accounting accounts and journal entries through the existing accounting endpoints, with loading and error handling.
- Re-verified after the finance/accounting cleanup:
  - Client production build passes with `npm run build`.
- Continued mentor session cleanup:
  - `server/src/services/mentor.service.ts` now supports authorized mentor-session rescheduling with status guards, overlap checks, persistence, and notifications.
  - `server/src/routes/mentor.routes.ts` exposes `PATCH /api/mentors/sessions/:sessionId` for rescheduling instead of leaving the client without a backend route.
  - `client/src/lib/hooks/useMentor.ts` no longer throws for session creation or rescheduling; creation uses the existing booking endpoint, and rescheduling uses the new live session route.
- Re-verified after the mentor session cleanup:
  - Server TypeScript build passes with `npm run build`.
  - Client production build passes with `npm run build`.
- Continued account security cleanup:
  - `server/prisma/schema.prisma` and migration `20260701090000_add_user_two_factor` add persisted two-factor authentication state to users.
  - `server/src/routes/auth.routes.ts` now exposes live 2FA status/setup/enable/disable routes, enforces TOTP codes during password login when enabled, and blocks Google/Facebook session creation for existing 2FA-enabled users so social auth cannot bypass the second factor.
  - `server/src/utils/totp.ts` implements local TOTP secret generation, otpauth URL creation, code normalization, and verification without adding another runtime dependency.
  - `client/src/app/dashboard/settings/security/page.tsx` replaces the disabled 2FA placeholder with live setup, verification, enabled, and disable states; `client/src/app/login/page.tsx` prompts for an authenticator code when the server requires one.
  - Mobile auth now preserves two-factor login errors instead of retrying them as refresh failures, and the React Native login screen can submit an authenticator code after the server requires one.
- Re-verified after the account security cleanup:
  - Prisma client generation passes with `npm run db:generate`.
  - Server TypeScript build passes with `npm run build`.
  - Client production build passes with `npm run build`.
  - Mobile TypeScript check passes with `npx tsc --noEmit`.
  - Targeted TOTP unit test passes with `npm test -- --runInBand src/utils/__tests__/totp.test.ts`.
  - Targeted auth route tests pass with `npm test -- --runInBand --forceExit src/__tests__/auth.happy.test.ts`, including missing-code and valid-code 2FA login coverage.
- Continued worker production enablement cleanup:
  - `server/src/utils/worker-config.ts` now has a dedicated-worker validation mode and shared Redis URL resolver so production worker startup cannot silently fall back to localhost Redis.
  - `server/src/workers/index.ts` validates Redis, provider URLs, and `ENABLE_WORKERS=true` before opening Redis or importing BullMQ workers, then dynamically loads the worker service only after config passes.
  - `server/.env.production.template`, `server/.env.production.example`, and `docker-compose.yml` now document/set the explicit worker enable flag and production worker provider URL requirements.
  - `server/src/scripts/validate-launch-readiness.ts` now checks the dedicated worker bootstrap and production worker env template.
- Re-verified after the worker production enablement cleanup:
  - Targeted worker/readiness tests pass with `npm test -- --runInBand --forceExit src/__tests__/worker-config.test.ts src/__tests__/launch-readiness-ci.test.ts`.
  - Launch-readiness validator passes with `npm run validate:launch-readiness`.
  - Server TypeScript build passes with `npm run build`.
- Continued AI interview coach cleanup:
  - `client/src/app/dashboard/ai/interview-coach/page.tsx` no longer has a voice-recording TODO behind the mic button. It now records microphone audio in-browser, offers local playback, and uses browser speech recognition when available to transcribe spoken answers into the existing feedback flow.
- Re-verified after the AI interview coach cleanup:
  - Client production build passes with `npm run build`.

### 2026-07-02

- Continued launch-hardening cleanup from the remaining mock/placeholder audit:
  - `client/src/app/dashboard/persona/[persona]/page.tsx` no longer renders nonfunctional animated placeholder widgets. It now uses live authenticated hooks for profile readiness, job recommendations, applications, saved jobs, enrollments, feed updates, courses, mentors, groups, and events, plus persona-specific links to existing workspace routes.
  - `client/src/app/dashboard/persona/page.tsx` copy now reflects persona dashboards and live workspace signals instead of "personality" dashboards.
  - `server/src/routes/compliance.routes.ts` now exposes public `GET /api/compliance/transparency-report`, returning only the latest published `TransparencyReport` record or an explicit `not_published` state.
  - `client/src/app/help/transparency-report/page.tsx` no longer ships hardcoded Q4 2024 moderation figures. It loads the published compliance report endpoint and shows loading, unavailable, or not-published states when no reviewed report exists.
- Re-verified after the persona/transparency cleanup:
  - Server TypeScript build passes with direct bundled Node execution of `node_modules/typescript/bin/tsc`.
  - Client production build passes with direct bundled Node execution of `node_modules/next/dist/bin/next build`.

### 2026-07-03

- Continued public marketplace cleanup:
  - `client/src/app/vendors/page.tsx` no longer ships fabricated vendor cards. It loads public vendor records from `/api/business/vendors`, filters live results, and routes users to the connected dashboard workflow instead of empty public detail folders.
  - `client/src/app/grants/page.tsx` no longer ships fabricated grant programs, fixed deadlines, or static award metrics. It loads active grant programs from `/api/business/grants`, computes visible summary stats from the current response, and shows honest empty/error states.
  - `client/src/app/rfps/page.tsx` no longer ships fabricated RFPs, company names, proposal counts, deadlines, or requirements. It loads open RFPs from `/api/business/rfps`, filters live results, and routes proposal actions to the dashboard workflow.
- Continued public discovery cleanup:
  - `client/src/app/events/page.tsx` no longer ships fixed February/March 2026 event examples. It loads public events from `/api/events`, supports live type/search filters, and shows honest empty/error states.
  - `client/src/app/mentors/page.tsx` no longer ships named featured mentor examples. It loads available mentor profiles from `/api/mentors`, filters via the public search endpoint, and routes discovery to the dashboard workflow.
  - `client/src/app/accelerator/page.tsx` no longer ships fixed investment/equity/timeline/mentor claims. It loads upcoming cohorts from `/api/business/accelerators`, computes summary stats from live cohorts, and shows honest empty/error states.
- Continued authenticated dashboard cleanup:
  - The dashboard sidebar (rendered by `client/src/app/dashboard/layout.tsx`) shows the Messages dot from the live conversation unread-count hook and hides it when there are no unread messages. The unmounted components/DashboardSidebar.tsx duplicate, which still carried a hardcoded badge of "3", was deleted on 2026-09-04.
  - `client/src/lib/hooks.ts` now prevents the unread-message count query from running before an authenticated user is available.
  - Removed the stale messages page.old.tsx (client/src/app/dashboard/messages, deleted 2026-09-04) and the unused super-app RichTextEditor mock; active messaging routes and the TipTap-backed editor remain in place.
  - `client/src/components/super-app/CreatorUploadStudio.tsx` no longer fabricates a change event for drag-and-drop uploads; file validation/metadata loading now runs through a shared selected-file path with object URL cleanup.
  - `client/src/app/dashboard/formation/page.tsx` no longer shows placeholder "Coming Soon" cards for tax and capital. It links to the live tax, grants, and investor workspaces and removes corrupted glyph text from the Formation Studio landing page.
  - `client/src/app/admin/analytics/page.tsx` keeps the live revenue/engagement metrics but removes the static future-enhancements "Coming Soon" panel and its corrupted bullet glyphs.
- Cleaned repository clutter:
  - Removed generated `.next`, coverage, log, test-result, temporary, duplicate copy, and stale backup artifacts from the workspace.
  - `.gitignore` now blocks local backup/copy artifacts such as `*.bak`, `*.old`, `*.orig`, and `* copy.*`.
- Re-verified after the public marketplace/discovery cleanup:
  - Client production build passes with direct bundled Node execution of `node_modules/next/dist/bin/next build`.
- Re-verified after the authenticated dashboard cleanup:
  - Client production build passes with direct bundled Node execution of `node_modules/next/dist/bin/next build`.

### 2026-07-04

- Continued latest-frontend business dashboard cleanup:
  - `athena-frontend/app/api/business/dashboard/route.ts` no longer returns the fabricated business-network dashboard or mock update success when no backend responds. It now proxies configured/local backend origins and returns explicit unavailable or upstream error responses.
  - `athena-frontend/app/business/page.tsx` no longer falls back to fake company metrics, tasks, deadlines, or a demo banner on auth/API failure. It normalizes live business data when available and otherwise shows a sign-in/formation empty state plus real business navigation links.
  - `athena-frontend/app/dashboard/business/page.tsx` now shows a connected-data empty state when the business dashboard backend is unavailable instead of a generic failure panel.
- Continued latest-frontend accelerator cleanup:
  - `athena-frontend/app/api/business/accelerator/[...path]/route.ts` now proxies accelerator cohort, mentor, curriculum, progress, and application requests to the configured/local backend without returning mock records.
  - `athena-frontend/app/business/accelerator/page.tsx` no longer ships fixed Q1/Q4 cohort dates, named mentor profiles, fabricated graduate stories, or fixed impact metrics. It loads live cohorts and mentors, submits applications through the accelerator API, and shows honest empty/unavailable states when no cohort or mentor data is connected.
- Re-verified after the business dashboard and accelerator cleanup:
  - Latest frontend production build passes with direct bundled Node execution of `node_modules/next/dist/bin/next build --webpack`.

### 2026-10-16

#### Local continuation and 100-step reconciliation

- Added an isolated loopback stack with generated temporary credentials, portable PostgreSQL17, local email inbox, count-only analytics sink, explicit development payment simulation and optional localhost TLS. Existing environment files and external accounts are preserved. All80 migrations applied to fresh local databases; an isolated fixture-clone rehearsal preserved schema and core row counts.
- Implemented native Google/Apple entry points and nonce validation, Stories camera/library uploads, consent-gated journey analytics, account-bound offline message drafts and bounded public Home/Jobs/Profile read caching. Actual Android/iOS bundles are exported; hardware capture and registered-provider verification remain separate.
- Implemented mentor availability/calendar/meeting access, opt-in cofounder matching, versioned skill assessments, rich article authoring, optimistic messages/attachments, command search, persona onboarding, real video trimming, organization cover uploads, connected business-health figures and candidate timelines.
- Fixed stale account/request races across community polling, privacy/export/deletion, native authentication, drafts, analytics, video feeds and job application state. Privacy-setting lookup failures now return503 instead of granting public access. Session refresh keeps cookie delivery alive across navigation; explicit logout waits for an existing rotation.
- Removed public invitation entry across signup methods. The real local browser-to-inbox-to-verification-to-sign-in flow passes without an invitation.
- Current full checks: server504 suites/7,016 tests; PostgreSQL545 unique integration cases across full/corrected-suite runs; web205 suites/1,423 tests; mobile49 suites/409 tests; ML150 tests. Detailed browser, accessibility, dependency and capacity evidence is recorded in [the 100-step audit](ATHENA_IMPLEMENTATION_PLAN_100_STEPS.md).
- Remaining work is explicit: Redis topology/worker delivery, durable search synchronization, complete domain localization, sponsored-inventory requirements, unresolved dependency advisories, hardware verification, live providers, production-like capacity/migration proof, legal sign-off and public launch. Local substitutes do not close those acceptance conditions.

- Removed the invitation field from public sign-up:
  - `client/src/app/register/page.tsx` no longer renders, validates, watches or submits an invitation code.
  - `client/src/components/auth/GoogleSignInButton.tsx`, `FacebookSignInButton.tsx` and the registration request types in `client/src/lib/api.ts` no longer carry invitation codes. Date of birth, self-attestation, persona and email verification still apply.
  - Regression coverage: `client/src/app/register/page.test.tsx`, `client/src/components/auth/SocialSignIn.two-factor.test.tsx`, and the new `client/tests/register.spec.ts`. The browser test uses fixture API/provider responses; it does not create an external account or send email.
- Continued the public discovery and launch-verification work:
  - `client/src/app/apprenticeships/page.tsx`, `skills-marketplace/page.tsx`, `mentors/page.tsx` and `community/page.tsx` now distinguish unavailable requests from confirmed empty lists and offer retry actions.
  - Catalogue retries preserve earlier results with an explicit notice, suppress stale counts, retry the failed pagination page, and ignore superseded requests.
  - Community channel and membership requests have separate failure/retry states. `client/src/components/channels/ChannelSidebar.tsx` and `ChatArea.tsx` avoid no-membership and join/post claims while membership is unknown. Late message requests and polls are discarded after account/channel changes.
  - Added `client/src/__tests__/public-catalogue-failures.test.tsx`, `client/src/app/mentors/page.test.tsx` and `client/src/app/community/page.test.tsx`. Enabled all four previously skipped pages in `client/tests/failure-states.spec.ts` and added outage recovery checks.
  - `.github/workflows/ci.yml` now includes the browser sign-up regression in the pull-request web checks; `athena-platform/docs/runbooks/TESTING.md` describes the active checks.
- Fixed existing Next.js production-build errors from extra page exports by moving shared code to `client/src/app/blog/author.ts`, `client/src/app/dashboard/cars/ReminderList.tsx`, `client/src/app/dashboard/cars/sell/ListingFields.tsx` and `client/src/app/skills-marketplace/orders/order-status.ts`, updating the page, detail-page and garage consumers.
- Verification:
  - Targeted client Jest checks: 85 tests passed across registration, social sign-in, verification screens, discovery failures, community, marketplace escrow and automotive behavior.
  - Targeted server authentication checks: 5 suites, 79 tests passed (registration, eligibility, overposting, start-over and email delivery).
  - Playwright: 13 browser checks passed for sign-up, outage states and retry recovery.
  - Focused ESLint: no errors; existing unused-function and unescaped-apostrophe warnings remain.
  - Production build passes with `npm run build -- --webpack`, including Next.js generated route type checks and static page generation.
  - Workflow guard: all 13 checks pass after completing the pending environment-template cleanup. The original `client/.env.netlify` values are preserved locally in ignored `client/.env.netlify.local`; `client/.env.netlify.example` is the repository template, and `.gitignore` prevents reintroducing the old filename.

#### Continued master-plan implementation

- Added native mobile profile photos as a partial camera-parity milestone:
  - `mobile/src/screens/ProfileEditScreen.tsx` now supports camera capture and library selection, permission refusals/settings, cancellation, loading/error states and confirmed Android activity recovery. Text edits survive photo updates, and account changes discard the previous member's pending work.
  - `mobile/src/services/profilePhoto.ts` validates local image descriptors and the API's JPEG/PNG/WebP, 5 MiB contract. `mobile/src/services/api.ts` sends real multipart data to `/media/upload/avatar` and uses the server-confirmed result.
  - `mobile/app.json` declares purpose-specific camera/photo access and disables the image-picker microphone permission. A new native build and physical iOS/Android picker/upload checks remain required; Stories/verification capture remains outside this milestone.
- Finished community history and panel failure recovery:
  - `client/src/app/community/page.tsx` and `client/src/components/channels/ChatArea.tsx` distinguish failed history/refresh/pinned/member reads from genuine empty results and provide independent retry actions.
  - Failed reads do not clear unread counts. Polls are serialized, initial recovery fetches full history, and prior requests cannot override newer socket/local changes, restore locally deleted messages, or update a different viewer/channel.
  - Identically named channels have separate drafts/panels. Pinned messages older than the visible history remain available. Joining a previewed room marks its successfully loaded history read.
  - Regression coverage lives in `client/src/app/community/page.test.tsx`, `client/src/components/channels/ChatArea.test.tsx` and `client/tests/failure-states.spec.ts`.
- Repaired the migration rehearsal tool for the launch-validation milestone:
  - `server/scripts/migration-dry-run.js` pins all database aliases to the chosen staging clone, rejects equivalent application URLs, uses subprocess arguments rather than shell interpolation, and redacts database URLs from reports/errors.
  - The default command is read-only inspection. `--apply` alone deploys to the clone, checks migration status/schema, and measures actual before/after core row counts. Reports state the limits of count/SQL checks and never equate passing with production approval.
  - Added `server/tests/migration-dry-run.test.ts`; updated deployment/launch/testing instructions to distinguish inspection from an actual rehearsal.
- Closed existing privacy build/test gaps exposed by validation:
  - Restored the missing step-up/stream imports in `server/src/routes/gdpr.routes.ts`. Route tests now verify password re-checking and consume a streamed, non-cacheable JSON download.
  - `server/src/services/consent.service.ts` defines the new sensitive-information and AI-processing consent metadata as optional; tests verify no default grants and withdrawal support.
  - Five GDPR export suites now consume the real serialized async export through `server/src/services/__tests__/read-dsar-export.ts`, preserving their privacy/decryption assertions. Corrected two typed media/moderation test mocks without weakening rejection coverage.
- Verification for this continuation:
  - Web production build, server build, server `tests/` type check and mobile TypeScript pass.
  - Community Jest: 36 tests; mobile photo/API Jest: 36 tests; focused server migration/privacy/consent/media checks: 154 tests; browser failure/recovery checks: 15 tests passed.
  - Focused ESLint and repository diff checks pass.
  - Real database integration was attempted only through the guarded disposable harness, which stopped before database access because Docker Desktop's Linux engine is unavailable. No real clone rehearsal, production migration or deployment was performed.
- Corrected the 100-step audit statuses for camera parity, measured load testing, migration rehearsal and launch so prepared tooling is not mistaken for completed operational validation. The testing runbook records the remaining device and database checks.

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
- [x] Persist and apply appearance settings instead of local-only display controls.
- [x] Live-wire job detail save/share controls and recommendation sidebar.
- [x] Replace billing regional payment placeholders with live payment-method availability and mutation-backed checkout.
- [x] Replace accounting refresh placeholder with a real reload action.
- [x] Live-wire mentor session creation and rescheduling actions.
- [x] Add real two-factor authentication setup and login enforcement.
- [x] Harden dedicated worker startup and production worker env templates.
- [x] Replace interview coach voice-recording placeholder with browser recording/transcription controls.
- [x] Replace persona dashboard placeholder widgets with live account/workspace signals.
- [x] Replace hardcoded public transparency-report metrics with a published-report API and honest unpublished state.
- [x] Replace hardcoded public vendor, grant, and RFP marketplace data with live business API data and honest empty states.
- [x] Replace hardcoded public event, mentor, and accelerator discovery data with live API data and honest empty states.
- [x] Replace hardcoded dashboard Messages badge with live unread conversation counts.
- [x] Remove stale duplicate messages route and unused mock rich-text editor component.
- [x] Replace upload-studio synthetic event reuse with a shared selected-file handler.
- [x] Replace Formation Studio placeholder cards with links to live finance, grants, and investor workspaces.
- [x] Remove static admin analytics future-enhancements placeholder panel.
- [x] Remove latest-frontend business dashboard mock data and mock update success fallbacks.
- [x] Remove latest-frontend accelerator mock cohorts, mentors, graduate stories, and fixed impact stats.
- [ ] Provision real Redis and provider URLs, then enable workers intentionally in production.
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
