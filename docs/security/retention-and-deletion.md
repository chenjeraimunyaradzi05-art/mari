# ATHENA Retention & Deletion Schedule
_Version 1.0 — 2026-08-18. Enforcement code: `athena-platform/server/src/scripts/data-retention.ts`, `gdpr.service.ts`, `gdpr.worker.ts`, session cleanup (`cleanupExpiredSessions`). Statuses: **enforced** (code runs it) vs **policy** (needs wiring/decision)._

| Data | Retention | Trigger | Status |
|---|---|---|---|
| Sessions (expired/revoked) | deleted on cleanup run | scheduled job | enforced (`session.service.ts`) |
| Login-attempt counters / lockouts | ≤15 min window | TTL in Redis | enforced (`loginAttempts.ts`) |
| Account (active) | life of account | — | — |
| Account (user-requested deletion) | delete/anonymise within 30 days; queue via GDPR worker | user request in privacy centre | enforced path exists — **verify end-to-end [FOUNDER]** |
| Account (dormant) | delete after 24 months of inactivity, with 30-day warning email | scheduled | **policy — not yet wired** |
| Resumes / uploaded media | deleted with account; orphaned uploads purged after 90 days | account deletion / sweep | **policy — needs storage sweep job** |
| Verification documents | delete raw document ≤90 days after decision; keep decision + hash only | verification decision | **policy — high priority** |
| Messages | deleted with account (both-party content anonymised, not destroyed) | account deletion | policy |
| Safety reports & moderation cases | 3 years after case closure (defensibility), then anonymise | case closure | policy |
| security_audit_logs | 2 years, then delete | scheduled | policy (export command exists in legacy line) |
| Financial/tax records | 7 years (AU statutory) — survives account deletion as required by law | statutory | policy — **do not shorten** |
| Stripe data | per Stripe retention; deletion via Stripe API on account deletion | account deletion | policy |
| AI prompts/responses | 30 days for abuse review, then delete; never used for third-party training | rolling | **policy — define with provider DPA** |
| Server logs / runtime logs | 30 days | rolling | policy (runtime logs quarantined by cleanup script) |
| Backups | 35 days rolling (Neon PITR window) | provider | **[FOUNDER: confirm Neon plan window]** |

## Deletion standards

1. **Deletion means deletion** — not `deleted=true` forever. Anonymisation is acceptable only where content integrity requires it (threads) or law requires retention (financial).
2. Deletion must propagate to: DB, object storage, search indexes (OpenSearch when enabled), caches, Stripe (via API), analytics.
3. Every user-requested deletion gets a completion confirmation; the GDPR worker records completion.
4. Backups: deleted data may persist in backups until the window lapses — state this in the privacy policy.

## Actions

- [ ] Wire dormant-account and orphaned-upload sweeps into the scheduler (`data-retention.ts` is the natural home)
- [ ] Implement verification-document 90-day purge
- [ ] **[FOUNDER]** Confirm statutory retention list with counsel (tax 7y, employment records, NDB documentation)
