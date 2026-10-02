# ATHENA Privacy Impact Assessment (PIA)
_Version 1.0 — 2026-08-18. Framework: AU Privacy Act 1988 / APPs, with GDPR alignment for any EU users. This is a living engineering PIA; it does not replace legal review **[FOUNDER: commission counsel review before public launch]**._

## 1. What ATHENA does with personal data

A career/life platform for women: accounts, job matching, mentorship, community,
payments, safety tooling, and AI assistance. Data categories, storage locations,
and processors are enumerated in [data-inventory.md](data-inventory.md).

## 2. Highest-risk processing and mitigations

| Processing | Risk | Mitigations | Residual |
|---|---|---|---|
| **DV-safe housing & safety reports** | Exposure could enable physical harm | Need-to-know access (authorisation-matrix): a member reads only her own inquiries, a lister only her own listings and the inquiries on them (the asker is an alias until she chooses to share who she is), and the staff housing routes are administrator-only, so a moderator reaches none. Every time a member of staff is shown what members are not (the check queue, the street address of a confidential listing, an inquiry thread on one) a `HOUSING_DV_SAFE_VIEWED` row is written to the audit log, filed as data access: who, which listings, which fields, when, and the reason if one was given (none is demanded, and a failed audit write is logged but does not stop the page, because the queue is also how checks get done). Staff decisions on a listing are audited as writes. A lister's own listings are in her data export and are erased with her account. A quick exit that replaces the page with an ordinary one: a button on the dashboard, the safety, housing, report, appeal and wellness pages and on the public Safety pages, and the Escape key pressed twice quickly, which works signed out (`athena-platform/client/src/app/dashboard/safety/QuickExit.tsx`); and in the header of the phone app's wellness, Safety, Help & Support, and sign-in and devices screens (`athena-platform/mobile/src/components/pillar/QuickExit.tsx`). It cannot erase pages visited earlier from the browser's history, and the copy says so. SEV-1 incident treatment | High until authz tests + field-level encryption exist |
| **Member names on social surfaces** | A legal name on a post, a comment or a message is how a violent ex-partner finds a woman, and the platform promises a pseudonym (APP 2) | A member chooses a public name that is not her legal name (Settings, then Profile, on the web and in the app; the server checks it is a name: no email address, phone number or web address, nothing that claims to be staff). Other members are sent only that name, or the first name alone when none is chosen, never the legal first and last name: `athena-platform/server/src/utils/member-display.ts` wraps every answer from the post, comment, group, message and member-page routes and the direct-message socket path, and the @-mention box no longer matches on the legal name. She sees her own record whole; real names stay where a payment, an identity check she chose, hiring or the law needs them. Registration still fills the public name from the legal one, so a member keeps her real name as her public name until she changes it [FOUNDER: decide whether to ask existing members once to choose]; stories, follow requests, close friends, event hosts, sounds and wellness forums and circles use the public name and then the first name alone. Clearing the public name stores her first name, so the surfaces that read only the display name (reels, channels, live and group chat) call her by it too. A few places outside those routes still fall back to the full legal name when none is set (the AI blocked-creator list, the referral leaderboard, team lists in the automotive and business areas, a practitioner's booking list), and a named health share link shows the name its owner chose to show; employers and mentors see the legal name on an application or booking she makes | Medium until existing members are asked to choose |
| **Wellness: language about self-harm** | A woman writing that she cannot go on is not shown help, or is flagged in a way that makes her stop writing | The K10 is stateless and stores nothing. A phrase screen (`athena-platform/server/src/services/wellness/forum.service.ts`) puts the crisis lines (000, Lifeline, 1800RESPECT first) in front of her on every wellness surface she writes on. Where other people can read the words (a forum post, reply or edit, a support circle check-in, name or description) a HIGH safety concern is raised for staff, carrying where it was and the phrases that matched and none of the rest of what she wrote, and the answer tells her a moderator has been told only if the flag was in fact written (it is best effort, so a failed write is logged and she is given the lines without that sentence). A moderator's own reply in a thread is not screened. Where the record is hers alone (a mental load task, a daily check-in note) she is shown the lines and nobody is told, because the page promises only she reads it. A forum post or reply can be reported, self-harm is a reason, and it runs on the 24-hour review clock | Medium: a phrase screen misses what it does not name, and no one is on call outside staff hours [FOUNDER: decide who answers a flag at night] |
| **Gender self-attestation (women-only spaces)** | Sensitive-attribute inference; exclusion errors | Self-attestation at sign-up; the women-only check is optional, a person decides it, and a written route exists beside the photo ID route; appeal path | Medium |
| **Verification documents** (photo ID and selfie, optional) | Identity-document theft; biometric data is sensitive information under the Privacy Act | The check runs on Stripe Identity's hosted page, so ATHENA never receives or stores the document or the selfie; consent is asked before it starts; only the result, legal name, document type and date of birth come back; review is staff-only with two-factor and every decision is audited; Stripe is asked to redact the session on decision, again nightly for any it could not, and before an account is erased; the name and document type are scrubbed 90 days after the decision (`athena-platform/server/src/services/identity-verification.service.ts`) | Medium until Stripe's own retention terms and DPA are confirmed [FOUNDER] |
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
3. Confirm Stripe's Identity retention terms and DPA, and list Stripe for identity verification in the service-providers register **[FOUNDER]** (the purge itself is built; there is no document storage of our own to make private)
4. AI retention + injection controls (ai-system-card.md)
5. End-to-end test of export and deletion flows with a real account
6. NDB readiness: incident-response.md contacts completed
