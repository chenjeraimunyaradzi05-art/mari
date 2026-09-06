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
| Credential stuffing / brute force | Per-account lockout (`loginAttempts.ts`), rate limits, bcrypt-12, dummy-hash timing defence (`password.ts`) | Lockout is fail-open without Redis |
| Token theft / replay | Sessions stored hashed, revocation + reuse detection (`session.service.ts`), HS256-pinned verification | Access tokens live 7d (recommend ≤1h + refresh) |
| Forged identity headers | `x-user-id` bypass removed; proxy strips identity headers | Legacy `app-backend` routes need authz review |
| Webhook forgery | Stripe/PayPal signature verification (`athena-platform/server/src/routes/webhook.routes.ts`, `webhook-signature.ts` + tests) | — |
| XSS / injection | CSP (netlify.toml, `securityHeaders.ts`), React escaping, zod schemas | CSP allows `unsafe-inline` scripts on Netlify tier — tighten with nonces |
| IDOR / cross-tenant access | Role middleware (`roles.ts`, `requireRole`) | **No systematic authz test suite — top gap** |
| Secret leakage | `.gitignore` hardened; fail-closed secrets; AWS Secrets Manager support (`secrets.ts`) | .env files existed in synced tree — **rotate all** |
| Prompt injection into AI features | — | **Unmitigated — see ai-system-card.md** |
| DoS | Tiered rate limiting (`rate-limit.ts`, `rateLimiter.ts`) | In-memory store per instance until Redis is configured |

## Out of scope (v1)

Nation-state adversaries, physical attacks, malicious Netlify/Neon insiders.

## Review triggers

New data category collected; new third-party integration; auth flow change; any security incident.
