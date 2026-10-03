# ATHENA Threat Model
_Version 1.0 — 2026-08-18. Scope: athena-platform (deployed line), athena-frontend, app-backend, auth-service._

## What we protect (assets, highest value first)

1. **User safety data** — DV-safe housing enquiries, safety reports, survivor-support usage. Exposure can cause physical harm, not just privacy harm. (dv-safe.routes.ts, safety.routes.ts, report flows)
2. **Credentials & sessions** — password hashes, TOTP secrets, JWT/refresh tokens, session table.
3. **Financial data** — Stripe customer/Connect IDs, payout details, tax records, bank-statement uploads.
4. **Personal data** — profiles, resumes, messages, career history, verification documents.
5. **Platform integrity** — moderation queue, admin functions, published claims/metrics.

## Who we defend against

| Adversary | Capability | Primary targets |
|---|---|---|
| Opportunistic attackers | Credential stuffing, scanners, known CVEs | Auth endpoints, outdated deps |
| Malicious users | Abuse, IDOR probing, scraping, harassment | Other users' data, messaging, reports |
| Abusive ex-partners / stalkers | Targeted account compromise, social engineering | DV-safe data, location signals, profiles |
| Payment fraudsters | Stolen cards, payout redirection, webhook forgery | Stripe flows, Connect payouts |
| Insider / supply chain | Compromised dependency or leaked secret | Everything |

## Trust boundaries

1. Browser ↔ Next.js edge/middleware (untrusted → semi-trusted)
2. Next.js API routes ↔ Express backend (proxy boundary — identity headers must be stripped; enforced in `backendProxy.ts`)
3. Backend ↔ database (Prisma; least-privilege DB user **[FOUNDER: confirm DB user is not superuser]**)
4. Backend ↔ third parties (Stripe, PayPal, OpenAI/AI providers, email) — signed webhooks in, scoped API keys out
5. CI ↔ repo secrets (GitHub Actions secrets; Netlify env)

## Key threats and current mitigations

| Threat | Mitigation (evidence) | Residual risk |
|---|---|---|
| Credential stuffing / brute force | Lockout per account and address: five wrong passwords or second-factor codes from one address lock that account's sign-in from that address for 15 minutes (`athena-platform/server/src/utils/loginAttempts.ts`, keyed on email plus address, with an in-process fallback). Rate limits on sign-in and sign-up (10 per 15 minutes per address in production), Google and Facebook sign-in (10), refresh (30 a minute) and password reset, resend and reset (5 an hour, one budget) in `athena-platform/server/src/index.ts` over a shared store (`athena-platform/server/src/utils/rate-limit-store.ts`); `athena-platform/server/src/__tests__/auth-limits.mount.test.ts` proves each is mounted. The credential checks behind a session (change password, two-factor enable, disable, recovery codes) share a per-member lockout of five wrong answers, kept apart from sign-in. bcrypt-12, dummy-hash timing defence (`athena-platform/server/src/utils/password.ts`) | The counters live in Redis, which is required at boot in production. If Redis is lost after boot they fall back to counters in each API process (the `AthenaRedisFallbackActive` alert and `/health/detailed` say so): a guessing run is slowed, not stopped. The lockout is per account and address, so a slow guess spread across many addresses at one account is bounded only by the per-address budgets, not by an account-wide lock |
| Token theft / replay | Sessions stored hashed (SHA-256); access tokens live 15 minutes and refresh tokens 7 days, rotated on every use; a retired refresh token presented again revokes every session (a second tab or a retry within 10 seconds of the same browser is told to ask again instead), while the token of a session that was signed out on purpose is simply refused, so signing out an old phone does not sign the member out everywhere; ending every session also switches off push notifications to the account's phones until the app registers again at the next sign-in; HS256-pinned verification; sessions are ended server-side, and their live sockets closed, on sign-out, password change or reset, suspension, ban, role change and account deletion (`session.service.ts`, `session-events.ts`). `jwt.ts`, `render.yaml` and `fly.toml` carry the same lifetimes and a test holds them equal | A stolen access token works until it expires (15 minutes, or until its session is revoked); a stolen refresh token works until it is used or revoked (7 days). A phone app keeps its refresh token in the device secure store and sends it in the request body; a browser keeps it in an HttpOnly cookie |
| Account taken over (a stolen password, or a person she knows) | A member can lock her own account from her settings or from the one-time "this was not me" link in the new-device sign-in email, which needs no session (`athena-platform/server/src/services/account-lock.service.ts`, `POST /api/auth/lock`, `/lock-by-token`). Locking ends every session, closes live sockets and refuses password, Google, Facebook and refresh sign-in until she unlocks it from a link mailed to the address on the account (`athena-platform/server/src/routes/auth.routes.ts`); `authenticate` also refuses a token minted while the lock was being made. Behaviour is held by `athena-platform/server/src/routes/__tests__/auth.account-lock.test.ts` | Whoever controls her mailbox can unlock it, as they can reset her password. A lock needs her to notice: the new-device alert is the prompt, and it only fires for a browser and address the account has not used before |
| Forged identity headers | `x-user-id` bypass removed; proxy strips identity headers | Legacy `app-backend` routes need authz review |
| Webhook forgery | Stripe/PayPal signature verification (`athena-platform/server/src/routes/webhook.routes.ts`, `webhook-signature.ts` + tests) | — |
| XSS / injection | CSP (netlify.toml, `securityHeaders.ts`), React escaping, zod schemas. Every email built from text a member or a provider wrote is escaped where the markup is made (`athena-platform/server/src/services/email.service.ts` renders each template from an escaped copy of its data; the notification fallback, the safety alert, the breach notices and the Stripe alerts use `athena-platform/server/src/utils/escape-html.ts`). The client sanitiser has no regular-expression fallback: with no document it returns text (`athena-platform/client/src/lib/utils/sanitize.ts`). Stored-text render tests for a post, a comment, a profile, a message and a link preview (`*.xss.test.tsx`) | CSP allows `unsafe-inline` scripts on Netlify tier — tighten with nonces |
| Scraping and bulk profile reads | A visitor with no account reads a member's card (name, picture, headline, counts), not her record, and finds her by name and headline only (`PUBLIC_PROFILE_DETAIL`, `athena-platform/server/src/services/audience.service.ts`); per-account budgets for profile, follower-list, member-search and directory reads (`athena-platform/server/src/middleware/rateLimiter.ts`); every list page size is clamped (`athena-platform/server/src/utils/pagination.ts`, held by `scripts/check-debt-ratchet.js`); a caller refused more than 20 times an hour is logged once, and `AthenaSustainedRateLimiting` flags a sustained 429 rate | A scraper with many accounts, each under its budget; whether a visitor should see even the card is the owner's call |
| Malware in an uploaded file | Every upload is scanned by ClamAV before it is kept, and a résumé or document that cannot be scanned is refused in production (`athena-platform/server/src/services/malware-scan.service.ts`; `MALWARE_SCAN_REQUIRED`); pictures are re-encoded and video and sound re-muxed on the way in; `/health/launch-readiness` reports the scanner | Pictures and video are stored unscanned in the default mode while the scanner is down; a file over 25 MB is not scanned unless the scanner and `MALWARE_SCAN_MAX_BYTES` are raised |
| IDOR / cross-tenant access | Role middleware (`roles.ts`, `requireRole`) | **No systematic authz test suite — top gap** |
| Secret leakage | `.gitignore` hardened; fail-closed secrets; AWS Secrets Manager support (`secrets.ts`) | .env files existed in synced tree — **rotate all** |
| Prompt injection into AI features | — | **Unmitigated — see ai-system-card.md** |
| DoS | A general limit on `/api` and stricter ones on the auth routes (`athena-platform/server/src/index.ts`, counted in Redis by `athena-platform/server/src/utils/rate-limit-store.ts`), and the sliding-window limiters in `athena-platform/server/src/middleware/rateLimiter.ts` | Counters are per instance while Redis is unreachable (`REDIS_URL` is required at boot in production, and the `AthenaRedisFallbackActive` alert says when it is lost) |
| Redis lost after boot | `REDIS_URL` is required at boot in production, and must be a redis:// or rediss:// address (`athena-platform/server/src/utils/env.ts`). The shared client keeps reconnecting without limit, and opens itself again if it ever ends (`athena-platform/server/src/utils/redis.ts`). `/readyz` and `/health/ready` answer 503 while it does not answer, so the uptime workflow reports it; the host's own check stays on `/livez`, so a Redis blip does not restart a healthy API. The scheduled sweeps are skipped, not run unlocked, and resume by themselves; `/health/detailed` names the ones waiting (`redis.sweeps_skipped`). The sign-in lockout and the rate limits count per process meanwhile (above) | While it is away: reminders, escrow-expiry warnings and scheduled posts are late, and a guessing run is slowed per instance, not stopped. Realtime (Socket.IO) has no Redis adapter, so the API is one instance by design (`render.yaml`) |

## Out of scope (v1)

Nation-state adversaries, physical attacks, malicious Netlify/Neon insiders.

## Review triggers

New data category collected; new third-party integration; auth flow change; any security incident.
