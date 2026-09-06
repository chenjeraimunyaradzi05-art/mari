# ATHENA Data Inventory
_Version 1.0 — 2026-08-18. Source of truth for schemas: `athena-platform/server/prisma/schema.prisma` (active line), the retired app-backend schema (quarantined, no longer in this repository). Storage: Neon Postgres (active), local `athena-platform/server/uploads/*` (files — see gaps)._

## Categories of personal data

| Category | Examples | Where | Sensitivity | Lawful basis* |
|---|---|---|---|---|
| Account & identity | email, name, password hash, TOTP secret, roles, persona | `User`, session tables | High | Contract |
| Profile & career | bio, skills, resume/CV, work history, education | profile/resume models, uploads | Medium | Contract |
| Verification | ID documents, verification status, women-only self-attestation | verification models, `media_upload_sessions` | **Very high** | Consent / legal obligation |
| Safety | reports, blocks, appeals, moderation cases | report/moderation models, security_audit_logs | **Very high** | Legitimate interest (safety) |
| DV-safe housing | enquiries, safe-listing interactions | dv-safe models (legacy line) | **Critical** | Consent |
| Financial | Stripe customer/Connect IDs, subscriptions, invoices, payouts, tax records | subscription/payment models; card data stays with Stripe | High | Contract |
| Social content | posts, comments, messages, media, live chat | post/message/media models | Medium | Contract |
| Usage & device | IP, user agent, session metadata, analytics events | `Session`, logs, analytics | Low-Med | Legitimate interest |
| AI interactions | coach/concierge prompts and responses | AI service logs **[verify retention]** | High (free-text may contain anything) | Consent |

_*Bases are indicative; **[FOUNDER: confirm with counsel]**._

## Data flows to third parties

| Processor | Data | Purpose | Region |
|---|---|---|---|
| Neon (Postgres) | all DB categories | primary storage | **[FOUNDER: confirm region — should be AU/SYD or documented]** |
| Netlify | request logs, edge delivery | hosting | global CDN |
| Stripe / PayPal | payment identity, transactions | payments | global |
| OpenAI / AI providers | prompt text (may contain PII) | AI features | US **[FOUNDER: confirm provider list + DPA]** |
| Email provider (SendGrid types present) | email, name | transactional mail | **[FOUNDER: confirm provider + domain auth]** |
| Sentry (when enabled) | errors incl. possible PII in context | monitoring | configure PII scrubbing |

## Where data must NOT be

- Git history (env files existed in tree — rotate; see SECURITY-HARDENING-CHANGELOG.md)
- Client-side storage beyond the session token (localStorage token noted as an accepted risk pending cookie migration)
- Logs: no passwords, tokens, or message bodies (logger truncates user agents; keep it that way)

## Gaps

1. Uploads on local disk (`athena-platform/server/uploads/*`) — move to object storage with private ACL + signed URLs.
2. AI prompt/response retention undefined — define and enforce (see ai-system-card.md).
3. No field-level encryption for verification documents or TOTP secrets at rest beyond DB encryption — evaluate KMS envelope encryption.
