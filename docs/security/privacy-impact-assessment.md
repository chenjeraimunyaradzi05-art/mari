# ATHENA Privacy Impact Assessment (PIA)
_Version 1.0 — 2026-08-18. Framework: AU Privacy Act 1988 / APPs, with GDPR alignment for any EU users. This is a living engineering PIA; it does not replace legal review **[FOUNDER: commission counsel review before public launch]**._

## 1. What ATHENA does with personal data

A career/life platform for women: accounts, job matching, mentorship, community,
payments, safety tooling, and AI assistance. Data categories, storage locations,
and processors are enumerated in [data-inventory.md](data-inventory.md).

## 2. Highest-risk processing and mitigations

| Processing | Risk | Mitigations | Residual |
|---|---|---|---|
| **DV-safe housing & safety reports** | Exposure could enable physical harm | Need-to-know access (authorisation-matrix), audited admin access, quick-exit UI patterns (legacy components), SEV-1 incident treatment | High until authz tests + field-level encryption exist |
| **Gender self-attestation (women-only spaces)** | Sensitive-attribute inference; exclusion errors | Self-attestation only, no verification documents required for membership; appeal path | Medium |
| **Verification documents** | Identity-document theft | Upload-session model with scan columns (legacy); planned 90-day purge | High until purge + private storage implemented |
| **AI features on private data** (resume coach, concierge) | PII sent to external model providers; prompt-injection exfiltration | System-prompt constraints; planned: provider DPA, retention limits, injection defences (ai-system-card.md) | High — top open item |
| **Payments/tax records** | Financial profiling, fraud | Stripe holds card data; 7-year statutory retention isolated from general deletion | Low-Med |
| **Behavioural matching/ranking** (ML rankers) | Opaque profiling, APP 5 transparency | Feature is config-only until model artifacts ship; when live: explanation surface + opt-out | Deferred |

## 3. Individual rights — how each is honoured

| Right | Mechanism | Status |
|---|---|---|
| Access / export | Privacy centre export (gdpr.service) | Implemented — verify end-to-end |
| Correction | Profile/settings editing | Implemented |
| Deletion | Privacy centre → GDPR worker queue | Implemented — verify propagation (see retention doc) |
| Consent management | Granular cookie banner, consent service | Implemented |
| Complaint | /contact, privacy policy contact; OAIC escalation stated | Page added 2026-08-18; **policy text needs owned-domain contact [FOUNDER]** |

## 4. Cross-border disclosure (APP 8)

Neon (DB region **[confirm]**), Netlify CDN (global), Stripe (global), AI
providers (US). The privacy policy must name destination countries and the
safeguards used. **[FOUNDER: confirm regions, sign DPAs, update policy]**

## 5. Open items before launch (blocking)

1. Appoint privacy officer + publish owned-domain contact (audit P0.4)
2. Provider DPAs: Neon, Netlify, Stripe, email, AI **[FOUNDER]**
3. Verification-document purge + private object storage
4. AI retention + injection controls (ai-system-card.md)
5. End-to-end test of export and deletion flows with a real account
6. NDB readiness: incident-response.md contacts completed
