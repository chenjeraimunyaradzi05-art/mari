# ATHENA Trust Claims Register
_Version 1.0 — 2026-08-18. Rule (audit P0.2): **no public claim ships unless it appears here with evidence**. Marketing, pricing, and legal pages must only make claims listed as ✅. Anything ❌ must be removed from public surfaces or rewritten as an aspiration ("we're building…")._

## Verifiable claims (✅ allowed in public copy)

| Claim | Evidence |
|---|---|
| Passwords hashed with bcrypt (cost 12), never stored in plain text | `server/src/utils/password.ts` |
| Two-factor authentication (TOTP) with recovery codes available | `utils/totp.ts`, auth routes, mfa UI |
| Session management: view/revoke devices; refresh-token reuse revokes all sessions | `services/session.service.ts` |
| Login rate limiting and per-account lockout | `utils/loginAttempts.ts`, `middleware/rateLimiter.ts` |
| Payment webhooks verified against provider signatures | `athena-platform/server/src/routes/webhook.routes.ts`, `webhook-signature.test.ts` |
| Card details never touch our servers (handled by Stripe) | Stripe Checkout/Elements integration |
| Security headers incl. CSP and HSTS on responses | `netlify.toml`, `securityHeaders.ts`, Next middleware |
| Vulnerability disclosure channel published | `athena-platform/client/public/.well-known/security.txt`, `/SECURITY.md` |
| Data export and deletion available via privacy centre | gdpr routes/services, privacy-center UI |
| Transparency report shows only published reports | Impl Plan 2026-07-02 change |
| Yearly Pro plan = 2 months free vs monthly | computed in `client/src/lib/pricing.ts` |

## Unverifiable or false claims (❌ must not appear publicly)

| Claim (seen in older docs/copy) | Problem | Required action |
|---|---|---|
| "Join thousands of women" / any user count | No verified metric | Removed from pricing page 2026-08-18; grep before each release |
| "Save 20%" yearly discount | Real figure is 16.6% (2 months free) | Fixed — badge now computed |
| "+40% callbacks measured across 1,000 users", "95% moderation accuracy" | Fabricated/aspirational metrics in Dec-2025 docs | Never ship; keep out of marketing |
| "SOC 2 / ISO 27001 certified (or in progress)" | No engagement exists | Only after auditor engagement letter **[FOUNDER]** |
| `api.athena.com`, `@athena.com` addresses | Domain not owned by ATHENA | Purge from all public surfaces; `sales@athena.com` still on `/contact-sales` — **replace when owned domain exists [FOUNDER]** |
| "Bank-level security", "military-grade encryption" | Meaningless superlatives | Use specific ✅ claims instead |
| Uptime/SLA percentages | No monitoring history published | Only after a status provider accumulates real data |
| Mentor/testimonial identities not on file | Cannot evidence | Only real, consented testimonials |

## Process

1. New public claim → add a row here with evidence **before** merge.
2. Release checklist: `grep -ri "thousands\|save 20\|SOC 2\|certified\|guarantee"` across client apps; every hit must map to a ✅ row.
3. Quarterly: re-verify every ✅ row still holds.
