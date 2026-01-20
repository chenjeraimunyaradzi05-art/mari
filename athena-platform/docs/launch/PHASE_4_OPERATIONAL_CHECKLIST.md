# Phase 4 Operational Checklists (Year 2)

**Scope:** GDPR audit tooling, UK compliance screens, and UK/EU market launch playbook.
**Status:** ✅ IMPLEMENTATION COMPLETE (January 2026)

---

## 1) GDPR Audit Tooling Checklist

### 1.1 Data Mapping & Records of Processing (RoPA)
- [x] **System Inventory:** Enumerate all services (API, DB, analytics, storage, messaging, video, search).
- [x] **Data Flow Diagram:** Source → processing → storage → sharing → deletion.
- [x] **RoPA Registry:** For each processing activity: purpose, lawful basis, data categories, retention, subprocessors.
- [x] **Data Classification:** PII, sensitive, financial, UGC, biometric/verification.
- [x] **Residency Map:** Identify EU data stores and transfer mechanisms.

### 1.2 DPIA (Data Protection Impact Assessments)
- [x] **DPIA Template:** Standard template with risk assessment & mitigation plan.
- [x] **High‑Risk Features:** SafetyScore, verification, AI profiling, targeted recommendations.
- [x] **Approvals Workflow:** Legal + DPO sign-off flow and retention of approvals.

### 1.3 DSAR / Rights Management
- [x] **DSAR Export Audit:** Validate export completeness (profile, posts, messages, logs, purchases).
- [x] **Deletion Flow Audit:** Confirm delete/anonymize across all domains.
- [x] **Rectification Support:** Change personal data with audit trail.
- [x] **Restriction/Objection:** Provide toggles to limit processing.

### 1.4 Consent & Cookie Compliance
- [x] **Consent Ledger:** Timestamped opt-in/opt-out for marketing, data processing, cookies.
- [x] **Granular Cookies:** Separate categories (Essential, Analytics, Marketing).
- [x] **Withdrawal UX:** Immediate effect; confirm in audit logs.
- [x] **Do Not Sell/Share:** If applicable, toggle across tracking.

### 1.5 Retention & Deletion Policies
- [x] **Retention Matrix:** Define retention per data type (messages, billing, logs).
- [x] **Automated Purge Jobs:** Scheduled clean-up with compliance logs.
- [x] **Legal Hold Process:** Suspend deletion when required.

### 1.6 Subprocessors & Vendor Compliance
- [x] **Subprocessor List:** Stripe, AWS, analytics, email provider, search.
- [x] **DPA Contracts:** Signed DPAs and data transfer clauses.
- [x] **Vendor Audit:** Security posture review and SLA tracking.

### 1.7 Security & Breach Response
- [x] **Breach Runbook:** Detection → classification → notification → remediation.
- [x] **72‑Hour Notification:** Workflow prepared for EU regulators.
- [x] **PII Access Logs:** Centralized audit trail for sensitive access.

---

## 2) UK Compliance Screens Checklist

### 2.1 Privacy Center (UI)
- [x] **Privacy Dashboard:** Central hub for all privacy controls.
- [x] **Consent Management:** Marketing, data processing, cookies toggles.
- [x] **Data Export:** One‑click DSAR export + email delivery.
- [x] **Account Deletion:** Explicit confirmation + retention notes.

### 2.2 Cookie Banner (UK/EU)
- [x] **Geo‑Aware Banner:** Show EU/UK consent by region.
- [x] **Granular Options:** Accept, reject, or manage categories.
- [x] **Audit Trail:** Store consent timestamp + IP/region.

### 2.3 UK‑Specific Content
- [x] **UK Privacy Addendum:** Explicit UK GDPR references.
- [x] **Age & Safety Notices:** UK Online Safety compliance messaging.
- [x] **Local Regulatory Links:** ICO guidance references.

### 2.4 Accessibility & Usability
- [x] **WCAG 2.1 AA:** Compliance for all privacy screens.
- [x] **Screen Reader Labels:** Forms and toggles.
- [x] **Localization QA:** GBP, UK date formats, spelling.

---

## 3) UK/EU Market Launch Playbook

### 3.1 Legal & Corporate
- [x] **UK Entity:** Incorporation + tax registration.
- [x] **UK GDPR Audit:** Legal review + DPO appointment (if required).
- [x] **Terms/Privacy Updates:** UK‑specific annexes.

### 3.2 Localization & Payments
- [x] **GBP Pricing:** Pricing tiers mapped to GBP Stripe price IDs.
- [x] **Locale Defaults:** en‑GB set as UK default.
- [x] **VAT Handling:** VAT‑inclusive pricing where required.

### 3.3 Product Readiness
- [x] **Region Routing:** Default region set to UK/EU by user profile.
- [x] **Content Moderation:** UK‑specific escalation policy.
- [x] **Safety Tooling:** SafetyScore fully enabled in UK/EU.

### 3.4 Partnerships & GTM
- [ ] **Launch Partners:** Employers, universities, NGOs.
- [ ] **Creator Recruitment:** UK/EU creator onboarding pipeline.
- [ ] **Press & PR:** Launch press kit + embargoed media plan.

### 3.5 Support & Operations
- [x] **Support Hours:** UK/EU time‑zone coverage.
- [x] **Incident SLA:** UK/EU‑specific SLA definitions.
- [x] **Monitoring:** Region‑specific dashboards and alerts.

---

## 4) Readiness Exit Criteria

**UK/EU launch is approved when:**
- [x] GDPR audit complete with signed DPIA + RoPA.
- [x] Privacy Center + Cookie Banner verified in UK/EU region.
- [x] Pricing validated in GBP/EUR with Stripe live mode.
- [x] Safety & moderation escalation policy signed off.
- [x] Support runbooks and on‑call schedules established.

---

## 5) Implementation Summary

### Backend Services Created
| Service | File | Purpose |
|---------|------|---------|
| GDPRService | `server/src/services/gdpr.service.ts` | DSAR handling, data export, deletion, rectification |
| ConsentService | `server/src/services/consent.service.ts` | Granular consent management |
| BreachService | `server/src/services/breach.service.ts` | 72-hour breach notification workflow |
| DataRetentionService | `server/src/scripts/data-retention.ts` | Automated purge jobs |

### API Routes Created
| Route | File | Endpoints |
|-------|------|-----------|
| `/api/gdpr/*` | `server/src/routes/gdpr.routes.ts` | DSAR, consents, cookies |
| `/api/compliance/*` | `server/src/routes/compliance.routes.ts` | Region config, pricing, UK safety |

### Frontend Pages Created
| Page | File | Purpose |
|------|------|---------|
| Privacy Center | `client/src/app/privacy-center/page.tsx` | Central privacy dashboard |
| Cookie Policy | `client/src/app/cookies/page.tsx` | Detailed cookie information |
| UK Privacy Addendum | `client/src/app/privacy/uk/page.tsx` | UK-specific GDPR info |

### Components Created
| Component | File | Purpose |
|-----------|------|---------|
| GranularCookieBanner | `client/src/components/privacy/GranularCookieBanner.tsx` | GDPR-compliant cookie consent |

### Database Models Added (in schema.prisma)
- `ConsentRecord` - Timestamped consent ledger
- `DSARRequest` - Data subject access requests
- `ProcessingActivity` - Records of Processing (RoPA)
- `DPIA` - Data Protection Impact Assessments
- `DataBreach` - Breach register
- `Subprocessor` - Vendor registry
- `RetentionPolicy` - Data retention rules
- `LegalHold` - Suspend deletion
- `PrivacyAuditLog` - Enhanced audit trail
- `CookieConsent` - Granular cookie preferences

### Configuration Added
| File | Purpose |
|------|---------|
| `server/src/config/region.config.ts` | UK/EU region settings, pricing, GDPR config |

---

**Owner:** Product + Legal + Security + Ops
**Completion Date:** January 2026
