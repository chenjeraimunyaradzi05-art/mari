# Privacy Act 1988, the Australian Privacy Principles and the NDB scheme

**Home regime:** Privacy Act 1988 (Cth), Australian Privacy Principles (APPs), Notifiable Data Breaches scheme (Part IIIC). Regulator: Office of the Australian Information Commissioner (OAIC).
**Layered on for UK and EU members:** UK GDPR / EU GDPR. Those are covered by [GDPR_COMPLIANCE_CHECKLIST.md](./GDPR_COMPLIANCE_CHECKLIST.md) and [PHASE_4_GDPR_UK_IMPLEMENTATION.md](./PHASE_4_GDPR_UK_IMPLEMENTATION.md), which this document does not replace.
**Last updated:** 19 September 2026

ATHENA Platform Pty Ltd is a Queensland company. Every member is served under the Privacy Act; members in the UK and EU are also served under the GDPR. The code kept its GDPR names (`/api/gdpr`, `gdpr.service.ts`, `gdpr.middleware.ts`) for API and import stability, which is why a reader could come away thinking Australia was out of scope. It is the default.

---

## 1. APP-by-APP map

Where each principle is met in code, and where it is not yet. "Not modelled" is said plainly rather than left to be discovered.

| APP | What it asks | Where in ATHENA |
|-----|--------------|-----------------|
| **APP 1** Open and transparent management | A clearly expressed, up-to-date privacy policy; practices an entity can show | Privacy policy `client/src/content/legal/privacy.md`; Australian Privacy Statement page `client/src/app/privacy/au/page.tsx` (route `/privacy/au`); processing register `ProcessingActivity` and privacy impact assessments `DPIA` in `server/prisma/schema.prisma`, served by `/api/gdpr/ropa` and `/api/gdpr/dpia` in `server/src/routes/gdpr.routes.ts`; every privacy action lands in `PrivacyAuditLog` |
| **APP 2** Anonymity and pseudonymity | Deal anonymously where lawful and practicable | Not modelled. Accounts are identified, and the women-only gate verifies identity. The privacy statement should say so; see follow-ups |
| **APP 3** Collection of solicited information | Collect only what is reasonably necessary; sensitive information with consent | Consent ledger `ConsentRecord`, `server/src/services/consent.service.ts`; sensitive categories are `DataCategory.SENSITIVE` in the register |
| **APP 4** Unsolicited information | Destroy or de-identify unsolicited personal information | Not modelled as a workflow. Erasure tooling in `server/src/services/gdpr.service.ts` does the destruction when it is needed by hand |
| **APP 5** Notification of collection | Tell people what is collected and why, at or before collection | Privacy policy and `client/src/components/CookieConsentBanner.tsx`; a per-activity collection notice field on `ProcessingActivity` is a follow-up (survey item 11) |
| **APP 6** Use and disclosure | Use only for the primary purpose, or a related one a person would expect, or with consent | `consentService.verifyConsentForAction()`; the `requireConsent` gate in `server/src/middleware/gdpr.middleware.ts` |
| **APP 7** Direct marketing | Consent or reasonable expectation, and an easy opt-out every time | `MARKETING_EMAIL` / `MARKETING_SMS` / `MARKETING_PUSH` consent types in the ledger; the privacy centre `client/src/app/privacy-center/page.tsx`. The Spam Act 2003 sits behind this. Wiring the gate onto every send path is a follow-up |
| **APP 8** Cross-border disclosure | Take reasonable steps before disclosing overseas; stay accountable | `Subprocessor` table with `country` and `transferMechanism`, published by `GET /api/compliance/subprocessors` in `server/src/routes/compliance.routes.ts`. The data-transfers endpoint is being corrected to name Sydney (ap-southeast-2) rather than invented EU centres (survey item 5) |
| **APP 9** Government identifiers | Do not adopt, use or disclose a government identifier as your own | No table uses a government identifier as a key by design. Not audited field by field in this pass |
| **APP 10** Quality | Reasonable steps to keep information accurate, up to date and complete | Member profile editing; `POST /api/gdpr/dsar/rectify` |
| **APP 11** Security | Reasonable steps to protect information; destroy or de-identify when no longer needed | `RetentionPolicy` table, seeded and run by `server/src/scripts/data-retention.ts`; erasure in `gdpr.service.ts` runs in one transaction and tombstones rows the law makes us keep; `LegalHold` suspends purges; `anonymizeIP` and `auditDataAccess` in `gdpr.middleware.ts`. Retention basis is in section 3 |
| **APP 12** Access | Give access on request within a reasonable period (OAIC: typically 30 days) | `POST /api/gdpr/dsar/export` and `GET /api/gdpr/download/:token`. `DSARRequest` is acknowledged and identity-verified on creation (the routes are authenticated) with a 30-day `dueDate`; export completes synchronously |
| **APP 13** Correction | Correct on request; note a refusal; tell recipients | `POST /api/gdpr/dsar/rectify` |
| **Part IIIC** Notifiable Data Breaches | Assess a suspected eligible breach within 30 days; notify the OAIC and individuals when serious harm is likely and not remedied | `DataBreach` model; `server/src/services/breach.service.ts`; `server/src/routes/admin-operations.routes.ts`; register at `client/src/app/admin/breaches/page.tsx`. Runbook in section 2 |

Region and regulator details (OAIC, oaic.gov.au, AUD, GST 10%) live in `server/src/config/region.config.ts`, and requests default to `AU` when no country is detected.

---

## 2. NDB runbook

The scheme is triggered by **suspicion**, not confirmation, and the 30 days run from **awareness**. The register is built so the first step starts the right clock and nothing after it can skip the assessment.

### The two clocks

| Clock | Applies to | Length | Where it is stored | Where it is watched |
|-------|-----------|--------|--------------------|---------------------|
| NDB assessment window | Any breach recorded as Australian (the default) | 30 days from `detectedAt` | `DataBreach.assessmentDueAt`, `assessmentComplete` | `GET /api/admin/breaches/ndb-assessments-due` and the "NDB assessments due" card on the register |
| GDPR Article 33 | Only breaches recorded as UK or EU (and rows from before regimes were recorded) | 72 hours from `detectedAt` | Computed; `notificationDeadline` on every row | `GET /api/admin/breaches/deadlines`; the Overdue / Due within 24h / Notified late cards |

An Australian-only breach reports `notificationDeadline.state = NOT_APPLICABLE`, is never counted as overdue or late, and never appears on `/deadlines`. The incident-team email prints the applicable clock and nothing else.

### Step 1: Record the incident

Admin > Data breach register > **Record an incident** (`POST /api/admin/breaches`).

- **Applies under**: Australia is pre-ticked. Tick the UK or EU as well if members there are affected. The body field is `jurisdictions: ('AU'|'UK'|'EU')[]`, default `['AU']`.
- Recording an Australian breach writes `assessmentDueAt = detectedAt + 30 days` at intake and logs `NDB_ASSESSMENT_STARTED`. Nobody has to find a button later.
- `notificationRequired` starts **false** for an Australian-only breach: under the scheme the assessment decides, not the severity. (For UK/EU breaches the Article 33 severity heuristic still sets it.)
- The `DataBreach.jurisdiction` column is still written with the first regime for one release; read `jurisdictions`.

### Step 2: Contain and investigate

The **Investigation** panel on the incident (`PATCH /api/admin/breaches/:id`): status, containment actions, remediation actions, root cause. Do this in parallel with the assessment; remedial action that prevents serious harm changes the outcome of step 3.

### Step 3: Assess within 30 days

On the incident, under **NDB assessment (30 days, Australia)**:

1. Write the reasoning. It is the record if the assessment is ever questioned, and the route refuses without it.
2. Tick **Remedial action prevented the harm** if it did.
3. Choose **Serious harm is likely** or **Not likely** (`PATCH /api/admin/breaches/:id/ndb-assessment`).

The outcome writes `assessmentComplete`, `seriousHarmLikely`, `remediedBeforeHarm` and logs `NDB_ASSESSMENT_COMPLETED`; that audit row's time is what `assessedWithin30Days` in the breach report is measured from.

`notificationRequired` becomes true only when serious harm is likely **and** it was not remedied. A breach that also touches UK or EU members keeps its Article 33 duty whatever the NDB outcome.

If the assessment is heading past day 30, the "NDB assessments due" card and `/ndb-assessments-due` show it. Overdue is reported, not hidden.

### Step 4: If it is an eligible data breach, lodge the statement with the OAIC

Section 26WK requires a statement containing four things:

1. the identity and contact details of the entity;
2. a description of the eligible data breach;
3. the kinds of information concerned;
4. recommendations about the steps individuals should take.

On the incident, **Statement to the OAIC** shows those four fields once the assessment has found an eligible data breach (and not before). The entity block is prefilled from `ORGANISATION` in `client/src/lib/contact.ts`; the ABN and registered office appear only once they are configured, so complete the block by hand until then.

- Lodge with the OAIC through its **Notifiable Data Breach form** (oaic.gov.au, "Report a data breach"). The OAIC does not take statements by email.
- Then press **Record statement and send copy** (`POST /api/admin/breaches/:id/notify-regulator` with `jurisdiction: 'AU'` and `statement`). This stores the four parts on `DataBreach.statement*`, stamps `statementLodgedAt` and `regulatorNotifiedAt`, sets the status to `NOTIFIED`, and emails a record copy to the address in the form. Put the OAIC's reference in `regulatorReference` when it arrives.
- The route refuses (409) while the assessment is incomplete or found no eligible breach, and refuses (400) if any of the four parts is blank. The email and the `REGULATOR_NOTIFIED` audit row carry the assessment dates, not a 72-hour count.

### Step 5: Tell the people affected (s 26WL)

`POST /api/admin/breaches/:id/notify-users` with `userIds`, `notificationContent` and, for an Australian breach, `recommendedSteps`. The statement's recommended steps are reused automatically once recorded; the route refuses to send to Australians without a "What you can do" section.

Section 26WL(2) allows notifying all individuals, only those at risk of serious harm, or (if neither is practicable) publishing the statement. Record which option was taken in the remediation actions.

### Step 6: Close out

Root cause, lessons learned, then status `RESOLVED` or `CLOSED`. `GET /api/admin/breaches/:id` returns the full record with a `compliance` block: `ndbApplies`, `assessedWithin30Days`, `notifiableUnderNdb`, `oaicNotified`, and for UK/EU breaches `notifiedWithin72Hours`. Whichever regime does not apply reads `null`, never `false`.

### A breach recorded under the GDPR that turns out to be Australian

On the incident, **It does: start the 30-day assessment** (`POST /api/admin/breaches/:id/ndb-assessment`) adds Australia to the regimes and opens the window from `detectedAt`, without removing the UK/EU clock.

### Walking it through

The super seed (`server/src/services/seed/super.seed.ts`) plants one incident mid-assessment so the whole flow can be exercised on a fresh environment. The schema comments and the two migrations `20260917100000_ndb_breach_assessment` and `20260919030000_breach_jurisdictions_and_ndb_statement` explain the columns.

---

## 3. Retention basis (APP 11.2)

Served to members by `GET /api/gdpr/retention-policies` from the `RetentionPolicy` table, never invented in a handler. The table is seeded by `initializeRetentionPolicies()` in `server/src/scripts/data-retention.ts` with these rows; the live table is the source of truth.

| Data type | Retention | Basis recorded | Reason recorded |
|-----------|-----------|----------------|-----------------|
| `user_messages` | 1095 days | LEGITIMATE_INTERESTS | Dispute resolution |
| `audit_logs` | 2555 days (7 years) | LEGAL_OBLIGATION | Legal compliance requirement |
| `payment_records` | 2555 days (7 years) | LEGAL_OBLIGATION | Tax and financial compliance |
| `session_data` | 30 days | CONTRACT | Security and authentication |
| `notifications` | 90 days | LEGITIMATE_INTERESTS | User experience |

The seven-year financial retention matches Australian tax record-keeping. Erasure never blocks on it: financial rows are tombstoned (kept without anything that identifies the member) rather than refused.

---

## 4. Access and correction requests (APP 12 and 13)

- Every DSAR route is behind `authenticate`, so `DSARRequest.identityVerified` is `true` and `acknowledgedAt` is set on creation. There is no 72-hour acknowledgement rule in APP 12; prompt acknowledgement is OAIC guidance and this is how it is met.
- `dueDate` is 30 days, the APP 12 "reasonable period" as the OAIC reads it, which also covers the one month Article 12(3) gives UK and EU members. Export, rectification and restriction complete synchronously in practice.
- Restriction (GDPR Article 18) and portability have no APP equivalent and are offered to every member anyway.

---

## 5. Response headers

`gdprRegionMiddleware` in `server/src/middleware/gdpr.middleware.ts` sets `X-Data-Protection: UK-GDPR` or `EU-GDPR` for requests detected as coming from the GDPR footprint. An `AU-PRIVACY-ACT` value for requests detected as Australian or New Zealand is the intended counterpart and is tracked as a follow-up in the same middleware.

---

## 6. What this does not cover

- Legal copy (governing law, ACL wording, age of consent) is survey item 10 and needs a lawyer's confirmation before the version bump.
- Member-facing surfaces naming the APPs and the OAIC route (privacy centre, cookie banner, settings) are survey item 4.
- The Online Safety Act 2021 and the eSafety Commissioner are survey item 7.
