# ATHENA Authorisation Matrix
_Version 1.0 — 2026-08-18. Enforcement points: `athena-platform/server/src/middleware/auth.ts` (`authenticate`, `requireRole`, `requirePremium`, `requireSubscriptionTier`), `athena-platform/server/src/middleware/roles.ts` (role helpers), Next.js middleware (coarse gate only)._

## Roles

| Role | Source | Description |
|---|---|---|
| anonymous | no token | Public pages, registration, login |
| MEMBER | `user.role` | Standard authenticated user |
| MENTOR | `user.role` | Member + mentor-side scheduling/earnings |
| EMPLOYER / COMPANY | `user.role` | Job posting, applicant management, org dashboards |
| CREATOR | `user.role` | Monetisation surfaces (uploads, payouts) |
| MODERATOR | `user.role` | Reports queue, content actions; no user PII beyond case need |
| ADMIN | `user.role` | Full admin surface; **must have MFA enabled [FOUNDER: enforce]** |
| service (internal) | `INTERNAL_SERVICE_TOKEN` header | Server-to-server; rate-limit bypass only, never user impersonation |

## Resource × action matrix (own = record owner only)

| Resource | anonymous | MEMBER | MENTOR | EMPLOYER | MODERATOR | ADMIN |
|---|---|---|---|---|---|---|
| Public pages, job search | read | read | read | read | read | read |
| Own profile / settings / sessions | — | CRUD own | CRUD own | CRUD own | CRUD own | CRUD any (audited) |
| Other users' profiles | public fields | public fields | public fields | applicants only | case-linked | any (audited) |
| Job applications | — | CRUD own | — | read for own jobs | — | any |
| Messages / chats | — | own threads | own threads | own threads | reported content only | reported content only |
| Mentor sessions / payouts | — | book | own calendar + earnings | — | — | any |
| Payments / subscriptions | — | own billing | own billing | org billing | — | refunds, config |
| Safety reports | submit (rate-limited) | submit + own | submit + own | submit + own | full queue | full queue |
| DV-safe housing data | — | own enquiries | — | own listings | need-to-know | need-to-know, audited |
| Moderation actions | — | appeal own | appeal own | appeal own | act + log | act + log + policy |
| Admin panels (`/admin/*`, admin.routes.ts) | — | — | — | — | — | full |
| Feature flags, site settings | — | — | — | — | — | ADMIN only |

## Rules

1. **Deny by default.** Every non-public route must call `authenticate`; role checks via `requireRole` — never by trusting client-supplied fields.
2. **Ownership checks on every object access** (`where: { id, userId: req.user.id }` pattern) — the ID in the URL is never enough.
3. **Admin actions are audited** via SecurityAuditService / security_audit_logs.
4. Subscription tier gates features, never authorisation (`requireSubscriptionTier` is not an authz control).
5. The Next.js middleware auth gate is coarse; real enforcement is server-side.

## Known gaps (tracked)

- No automated IDOR/cross-tenant test suite (top gap in ATHENA_GAP_REPORT.md).
- `app-backend` legacy routes (69 files) need a route-by-route authz review before that line ever serves production traffic.
- MFA is available but not yet **required** for ADMIN. **[FOUNDER: approve enforcement]**
