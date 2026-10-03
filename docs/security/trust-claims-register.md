# ATHENA Trust Claims Register
_Version 1.0 — 2026-08-18. Rule (audit P0.2): **no public claim ships unless it appears here with evidence**. Marketing, pricing, and legal pages must only make claims listed as ✅. Anything ❌ must be removed from public surfaces or rewritten as an aspiration ("we're building…")._

## Verifiable claims (✅ allowed in public copy)

| Claim | Evidence |
|---|---|
| Passwords hashed with bcrypt (cost 12), never stored in plain text | `server/src/utils/password.ts` |
| Two-factor authentication (TOTP) with recovery codes available. Turned on, off and re-issued on the web (the phone app answers the code at sign-in but turns it on and off on the web). The ten recovery codes are shown once when it is turned on, and a code works once. It is asked for on Google and Facebook sign-in as well. A member who has lost her phone and her codes can be reset by an administrator, with a reason on the audit log and an email to her | `utils/totp.ts`, `routes/auth.routes.ts`, `routes/__tests__/auth.two-factor-login.test.ts`, `routes/__tests__/auth.social-two-factor.test.ts`, `tests/integration/two-factor.test.ts`; the web screen is `client/src/app/dashboard/settings/security/page.tsx`; the reset is `docs/runbooks/TWO-FACTOR-RESET.md` |
| Session management: view/revoke devices; refresh-token reuse revokes all sessions | `services/session.service.ts` |
| Sign-in, sign-up and password-reset rate limiting, and a lockout after five wrong passwords within 15 minutes, per account and address | `src/index.ts` (the limiter mounts), `utils/loginAttempts.ts`, `utils/rate-limit-store.ts`; `src/__tests__/auth-limits.mount.test.ts` and `src/utils/__tests__/loginAttempts.test.ts` |
| Payment webhooks verified against provider signatures | `athena-platform/server/src/routes/webhook.routes.ts`, `webhook-signature.test.ts` |
| Card details never touch our servers (handled by Stripe) | Stripe Checkout/Elements integration |
| Security headers incl. CSP and HSTS on responses | `netlify.toml`, `securityHeaders.ts`, Next middleware |
| Vulnerability disclosure channel published | `athena-platform/client/public/.well-known/security.txt`, `/SECURITY.md` |
| Data export and deletion available via privacy centre and Settings. Deleting an account erases it at once through one erasure (the same from Settings and the Privacy Centre), asks for her password again (and her second factor when that is on; an account with neither is asked for nothing more than its session), ends any membership she pays for at Stripe before anything is deleted, and says nothing was deleted if that cannot be done | gdpr routes/services, `services/erasure-billing.service.ts`, privacy-center UI, `routes/__tests__/user.delete-account.test.ts` |
| Transparency report shows only published reports | Impl Plan 2026-07-02 change |
| Yearly Pro plan = 2 months free vs monthly | computed in `client/src/lib/pricing.ts` |
| A 30-day money-back guarantee on a member's first paid subscription payment (a person refunds it; cancelling at any time takes effect at the end of the period she has paid for) | `athena-platform/client/src/content/legal/terms.md` section 6.3 and `athena-platform/client/src/lib/pricing.ts` REFUND_DAYS (the server's price book holds the same figure and a test in each package fails if they differ); the refund is made from the admin Subscriptions screen, `athena-platform/client/src/app/admin/subscriptions/page.tsx`, through Stripe, with the reason in the audit log; cancel at period end is `POST /api/subscriptions/cancel`. Needs a solicitor's check against the Australian Consumer Law before launch **[FOUNDER]** |
| The pricing and billing pages list only what the server does: the six AI tools Pro unlocks and a larger AI chat allowance, with no application cap, discounts, free sessions, priority support or Enterprise checklist | `athena-platform/client/src/app/pricing/page.tsx`; each tool is a route behind `requireAiPremium` in `athena-platform/server/src/routes/ai.routes.ts`, and a server test fails if a line is added to the cards without a route that makes it true |
| A report from a signed-in member of an intimate image shared without consent, a threat to hurt someone, child sexual abuse material or terrorism hides a post, comment or reel at once (hidden, not deleted, and put back if the report is dismissed). These reports are critical, on a 24-hour clock, and a person is asked to open them within 4 hours; an intimate image is queued as a referral to the eSafety Commissioner. Reporters are shown the eSafety Commissioner, Policelink and 000 once they have filed. A ban is a person's decision | `athena-platform/server/src/services/moderation-threshold.service.ts` (`IMMEDIATE_HIDE_REASONS`), `services/content-report.service.ts` (`REASON_PRIORITY`, `CRITICAL_FIRST_LOOK_HOURS`, `AUTHORITY_REPORTABLE_REASONS`, `restoreWhatThisReportHid`), `services/__tests__/moderation-threshold.test.ts`, `services/__tests__/content-report.ncii.test.ts`, `routes/__tests__/compliance.report-severe.test.ts`; the screens are `client/src/lib/report-next-steps.ts` and `client/src/components/safety/ReportNextSteps.tsx`; what a person does next is `athena-platform/docs/runbooks/TRUST-AND-SAFETY.md`. A direct message, a group or channel message, a profile and a story are **not** hidden on a report: they have no hidden state, and a person handles them. A report from no account never hides anything alone. Needs counsel's sign-off on the runbook before launch **[FOUNDER]** |

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
| "Immediate permanent bans" for child abuse material, terrorism, credible threats or intimate images (the Community Guidelines said so until 2026-10-01; the blueprint's table says "automatic ban") | Nothing bans an account by itself. One report can be false, and an automatic suspension or ban on a single report is a weapon against the women this platform exists to protect (a woman can be reported by the person she is hiding from). The platform hides the content at once and a person bans, within hours. **Decision recorded 2026-10-01: bans stay a person's decision; to be confirmed by the owner with counsel [FOUNDER].** | The guidelines now say a ban is always a person's decision. Do not describe a ban as automatic anywhere |

## Process

1. New public claim → add a row here with evidence **before** merge.
2. Release checklist: `grep -ri "thousands\|save 20\|SOC 2\|certified\|guarantee"` across client apps; every hit must map to a ✅ row.
3. Quarterly: re-verify every ✅ row still holds.
