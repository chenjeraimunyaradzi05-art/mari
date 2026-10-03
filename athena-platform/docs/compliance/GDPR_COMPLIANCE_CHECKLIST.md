# GDPR & Privacy Compliance Checklist

**Phase 5: Mobile Parity & Production - Step 96**  
**Last Updated:** January 29, 2026

## Overview

This document serves as the legal review checklist for ATHENA's GDPR/Privacy compliance implementation.

---

## 1. Lawful Basis for Processing

### ✅ Consent Management
- [x] Cookie consent banner implemented (`CookieConsentBanner.tsx`)
- [x] Granular consent options (analytics, marketing, functional)
- [x] Consent stored and retrievable per user
- [x] Easy withdrawal of consent mechanism
- [x] Consent logged with timestamp

### ✅ Legitimate Interest Assessment
- [x] Documented legitimate interests for core functionality
- [x] Balance test performed for marketing communications
- [x] User opt-out mechanisms in place

### ✅ Contract Performance
- [x] Terms of Service clearly state data processing for service delivery
- [x] Employment/mentorship features require explicit data provision

---

## 2. Data Subject Rights

### ✅ Right to Access (Article 15)
- [x] `/api/user/export` endpoint implemented
- [x] Exports user data in JSON format
- [x] Includes: profile, posts, applications, messages, activity logs
- [x] Response time: within 30 days (automated: instant)
- **Evidence:** [user.routes.ts - exportUserData](../../server/src/routes/user.routes.ts)

### ✅ Right to Rectification (Article 16)
- [x] Profile editing available via `/dashboard/settings/profile`
- [x] Users can update all personal information
- [x] Changes propagate to all dependent systems

### ✅ Right to Erasure (Article 17)
- [x] Account deletion endpoint: `DELETE /api/user/account`
- [x] Cascading soft-delete implemented
- [x] 30-day grace period before permanent deletion
- [x] Retained data: anonymized for legitimate interests (fraud prevention)
- **Evidence:** [user.routes.ts - deleteAccount](../../server/src/routes/user.routes.ts)

### ✅ Right to Data Portability (Article 20)
- [x] Export format: JSON (machine-readable)
- [x] Includes all user-provided data
- [x] Available via Privacy Center dashboard

### ✅ Right to Object (Article 21)
- [x] Marketing communications opt-out
- [x] Analytics tracking opt-out
- [x] Profiling opt-out (affects personalized recommendations)

### ✅ Rights Related to Automated Decision Making (Article 22)
- [x] Safety Score explanation available to users
- [x] AI-driven recommendations clearly labeled
- [x] Human review available for contested decisions
- [x] Appeal process documented

---

## 3. Privacy by Design

### ✅ Data Minimization
- [x] Only necessary fields collected during registration
- [x] Optional fields clearly marked
- [x] Progressive profiling (ask for more data as needed)

### ✅ Purpose Limitation
- [x] Data usage purposes documented in Privacy Policy
- [x] Internal access controls based on purpose
- [x] Audit logs for data access

### ✅ Storage Limitation
- [x] Data retention policy: 3 years after last activity
- [x] Automatic anonymization of inactive accounts
- [x] Chat messages: retained for 2 years
- [x] Video content: creator-controlled retention

### ✅ Security
- [x] Safe-chat messages, health records, safety plans and two-factor secrets are encrypted by ATHENA (AES-256-GCM) before they are stored. This is encryption at rest, not end-to-end: the servers decrypt them to show them to the member. What it does and does not protect against, and the key, are in `athena-platform/docs/runbooks/ENCRYPTION.md`
- [ ] Encryption at rest of everything else is the database host's own, and is not something this repository verifies
- [x] Encryption in transit (TLS 1.3)
- [x] Password hashing (bcrypt with salt)
- [x] MFA available for all users
- [x] Regular security audits scheduled

---

## 4. Transparency

### ✅ Privacy Policy
- [x] Clear, plain language
- [x] Available at `/privacy-policy`
- [x] Covers all data processing activities
- [x] Lists third-party processors
- [x] Contact information for DPO

### ✅ Cookie Policy
- [x] Detailed cookie descriptions
- [x] First-party vs third-party cookies explained
- [x] Duration and purpose listed
- [x] Available at `/cookie-policy`

### ✅ Terms of Service
- [x] Data processing terms included
- [x] User responsibilities defined
- [x] Available at `/terms`

---

## 5. Third-Party Processors

### ✅ Data Processing Agreements (DPAs)

| Processor | Purpose | DPA Status | Data Location |
|-----------|---------|------------|---------------|
| AWS | Infrastructure, S3, CloudFront | ✅ Signed | AU (ap-southeast-2) |
| Stripe | Payment processing | ✅ Signed | US (SCCs in place) |
| SendGrid | Email delivery | ✅ Signed | US (SCCs in place) |
| PostHog | Analytics | ✅ Signed | EU |
| OpenAI | AI features | ✅ Signed | US (SCCs in place) |
| Twilio | SMS notifications | ✅ Signed | US (SCCs in place) |

### ✅ Sub-processor Notifications
- [x] Process for notifying users of sub-processor changes
- [x] 30-day notice period
- [x] User can object and terminate

---

## 6. International Transfers

### ✅ Transfer Mechanisms
- [x] Standard Contractual Clauses (SCCs) with US processors
- [x] Data localization option for AU users (primary storage)
- [x] Transfer Impact Assessment completed

### ✅ User Notification
- [x] Privacy Policy discloses international transfers
- [x] Specific countries listed
- [x] Safeguards explained

---

## 7. Breach Response

### ✅ Incident Response Plan
- [x] Documented procedure in `docs/security/incident-response.md`
- [x] 72-hour notification timeline to authorities
- [x] User notification process
- [x] Incident logging and tracking

### ✅ Technical Measures
- [x] Intrusion detection (AWS GuardDuty)
- [x] Log monitoring (CloudWatch + Sentry)
- [x] Automated alerts for anomalies

---

## 8. Children's Privacy

ATHENA is for adults. There is **one minimum age, 18, everywhere** (`PLATFORM_MINIMUM_AGE`; Terms 2.1 and 12.4; Privacy Policy 11). It is not 16 in Australia or 13 in the US, and there is **no parental-consent flow and no tier for minors**. None should be built until safeguarding, age assurance, consent, moderation and reporting duties for children have been designed. This section used to tick all three of those; they were never true and contradicted the 18+ decision.

### Minimum age (18+)
- [x] A date of birth is asked at sign-up by email, Google and Facebook, and the server refuses an account without an acceptable one, or one that makes her under 18
- [x] The refusal is one sentence for a missing, impossible or too-young date, and does not name the age back
- [x] An account with no date of birth (made before it was asked) is asked once, on its first write, and refused every write until it answers; reads, safety help, appeals, privacy rights and deletion stay open
- [x] An account with a recorded date under 18 is refused every write, on every route, in one place (`account-standing.ts`, applied by `authenticate`)
- [x] The date of birth, and the stamp of a document check that confirmed it, are in the data export
- [x] They are cleared when an account is erased, including the shell kept for retained records
- [x] A staff runbook for an account that is, or may be, a child's: `athena-platform/docs/runbooks/UNDER-AGE-ACCOUNT.md`
- [ ] **The date is self-declared, not verified.** Nothing may call it "age verification". Only a Stripe Identity document check stamps a date as confirmed, and it is optional
- [ ] **[COUNSEL]** Whether ATHENA is an age-restricted social media platform under Australia's Online Safety Amendment (Social Media Minimum Age) Act 2024 (in force from 10 December 2025, administered by eSafety), and what "reasonable steps" eSafety would expect of a service with a public feed, stories and direct messages that says it is adults-only
- [ ] **[COUNSEL]** Any effect of the OAIC's Children's Online Privacy Code (being developed under the Privacy and Other Legislation Amendment Act 2024) on a service that declares itself adults-only
- [ ] **[FOUNDER]** Whether the document check becomes mandatory for accounts with no date of birth, or for anyone reported

---

## 9. Special Category Data

### ✅ Handling
- [x] Gender identity: optional, user-controlled visibility
- [x] Health data: not collected
- [x] Biometric data: not collected
- [x] Political/religious views: not collected

---

## 10. Audit Trail

### Evidence Files
1. [Privacy Center UI](../../client/src/app/privacy-center/page.tsx)
2. [Cookie Consent Banner](../../client/src/components/CookieConsentBanner.tsx) — the one consent record; the former GDPRContext provider, a second copy of the consent state that nothing read, was removed on 2026-09-30
3. [User Data Export Route](../../server/src/routes/user.routes.ts)
4. [Data Retention Policy](../../../docs/security/retention-and-deletion.md)
5. [Privacy Policy draft](../legal/PRIVACY_POLICY_DRAFT.md)

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Data Protection Officer | _______________ | ____/____/____ | _________ |
| Legal Counsel | _______________ | ____/____/____ | _________ |
| CTO | _______________ | ____/____/____ | _________ |
| CEO | _______________ | ____/____/____ | _________ |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | System | Initial checklist |
