# Women Real Estate Platform — Verification & Onboarding RFC (Step 03)

## 1. Objectives

- Deliver end-to-end verification and onboarding journeys tailored to women real estate cohorts.
- Define dashboard information architecture (IA) for licensed agents and learners/investors.
- Document compliance, trust, and safety controls embedded within the workflows.

## 2. Core Personas & Journeys

- **Licensed Female Agents**
  - Intake: submit license, regulator details, references, proof-of-identity (POI).
  - Verification: automated checks + manual review, status notifications, agent academy resources.
  - Dashboard: manage listings, leads, social boosts, compliance alerts, market insights.

- **Women Renters & Students (Uni/TAFE)**
  - Intake: personal profile, institution verification (optional), safety preferences, budget.
  - Guidance: AI-matched listings, roommate suggestions, bursary/grant prompts.
  - Dashboard: saved listings, application status, study housing tips, mortgage readiness tracker.

- **First-Home Buyers & Investors**
  - Intake: financial profile (income, savings), investment goals (residence vs. investment), preferred mentors or partners.
  - Guidance: AI-driven mortgage readiness, government grant eligibility, partnership matchmaking.
  - Dashboard: savings milestones, recommended listings, mentor calendar, co-investment opportunities.

- **Women-Led Developers & Partners**
  - Intake: project scope, required partners, capital stack summary, timeline.
  - Guidance: AI partner matching, feasibility calculators, regulatory checklist.
  - Dashboard: project pipeline, interested partners, tasks, document vault, funding leads.

## 3. Verification Workflow Blueprint

1. **Submission**
   - Unified onboarding wizard collects persona-specific data and aggregates into `verification_payload` JSON structures.
   - File uploads stored encrypted at rest; metadata hashed for tamper detection.

2. **Automated Pre-Screen**
   - License validation via regulator lookup (initially manual, scaffold API adapters for NSW Fair Trading, VIC CAV, QLD OFT).
   - Fraud heuristics (duplicate IDs, mismatched expiration dates) scored via `FraudDetectionService`.
   - AI assistant summarises submitted documents for reviewers (Anthropic fallback for content-heavy payloads).

3. **Review Queue**
   - Moderation UI segments cases by risk score; reviewers apply decisions (approve, reject, request info).
   - Actions logged to `WomenAgentVerificationAudit` with reviewer ID, timestamp, rationale, linked AI summary.

4. **Decision & Activation**
   - Approvals trigger `WomenVerifiedAgent` status updates, publish dashboards, send welcome kits.
   - Rejections initiate appeals flow with explicit reasons, educational resources, and next steps.
   - Expiration monitoring: scheduled job checks `license_expires_at`, sends reminders 90/30/7 days prior, auto-suspends on lapse.

## 4. Learner & Investor Onboarding Flow

1. **Profile Foundations**
   - `WomenCohortProfile` captures demographics, study/work intents, financial posture.
   - Optional import from existing user resume or LinkedIn profile via `SocialAuthService` connectors.

2. **AI Readiness Assessment**
   - `CareerInsightsService` and `MortgageRepaymentService` compute readiness scores (housing, credit, savings) and tag opportunities.
   - Output stored in `ai_insights` columns for personalisation and historical tracking.

3. **Cohort Placement**
   - Auto-enrol learners to relevant cohorts (first-home accelerator, investor mastermind, TAFE support) via `WomenCohortEnrolment` records.
   - Mentorship pairing triggered through `MentorshipMatchingJob` with AI recommendations and human oversight.

4. **Goal Setting & Tracking**
   - Dashboard wizard encourages goal creation (e.g., save $20k deposit in 12 months) with milestones tracked by `GamificationService`.
   - Integrations with budgeting tools (phase 2) planned through pluggable webhooks.

## 5. Dashboard Information Architecture

- **Agent Dashboard**
  - Hero metrics: active listings, leads in pipeline, verification status, mortgage snapshot usage.
  - Tabs: Listings manager, Leads CRM, Social amplification center, Compliance center, Education resources.
  - Components: AI insight cards, video uploader, partner requests inbox, trust score badge.

- **Learner/Investor Dashboard**
  - Hero metrics: readiness score, savings progress, recommended listings, open cohorts.
  - Tabs: Home search, Learning pathway, Mentorship, Partnerships, Finance tools.
  - Components: AI mortgage calculator widget, grant eligibility checklist, cohort events calendar, social feed highlights.

- **Partner/Developer Workspace**
  - Hero metrics: active projects, new partner matches, funding status, timeline alerts.
  - Tabs: Projects, Partners, Financials, Compliance, Updates.
  - Components: Document vault, task board, AI feasibility summaries, investor outreach tracker.

- **Admin Verification Console**
  - Queues: New submissions, expiring licenses, flagged cases, appeals.
  - Tools: AI-generated digests, regulator API logs, audit timeline, bulk notification actions.

## 6. Compliance & Trust Controls

- Role-based access enforced via policies: `WomenVerifiedAgentPolicy`, `WomenCohortProfilePolicy`, admin gates.
- All verification actions emit domain events for audit streams (piping into `AdvancedAnalyticsService`).
- Sensitive data encryption using Laravel encrypted casts + key rotation strategy (AWS KMS / Azure Key Vault abstracted).
- Consent management: explicit toggles for AI personalisation, data sharing with partners, communication preferences.
- Content moderation: integrate `AutomatedModerationService` for uploaded docs/notes plus manual override.

## 7. AI Enablement Within Workflows

- **Document Summaries**: AI generates concise briefs of verification packets, highlighting anomalies and missing documents.
- **Risk Recommendations**: Mortgage AI suggests deposit strategies and flags high-risk repayment ratios.
- **Personalised Nudges**: `PersonaNudgeService` orchestrates cohort-specific prompts (study reminders, savings tips, partner invites).
- **Explainability Layer**: store AI rationales in `AIInferenceLog` for transparency and regulator reviews.

## 8. Implementation Sequencing & Dependencies

1. Data scaffolding: migrations for cohort profiles, audits, verification payloads, dashboard preferences.
2. Service layer: verification service coordinator, readiness scoring orchestrator, cohort enrolment engine.
3. UI foundation: Blade/Livewire components for onboarding wizard, dashboards, admin console.
4. AI integration: prompt templates, caching, fallback logic, telemetry instrumentation.
5. Compliance hardening: audit events, encryption, consent registry, security review.

## 9. Open Risks & Mitigations

- **Regulator API availability**: fallback to manual uploads with SLA tracking; design adapters for asynchronous sync when APIs exist.
- **Data sensitivity**: enforce least-privilege roles, auto-expire stored POI files, monitor via `SecurityAuditService`.
- **AI bias**: run regular fairness checks on recommendations, include human-in-the-loop overrides, document decision criteria.
- **Scalability**: cohort enrolment and verification queues scale via horizon workers; monitor backlog with `RealTimeAnalyticsEngine`.

## 10. Next Actions

- Translate this RFC into user stories and acceptance criteria for Step 04 planning.
- Engage legal/compliance partners to validate regulator and data retention requirements.
- Prototype onboarding wizard wireframes aligned with dashboard IA.
- Define KPI dashboards for verification SLA, learner conversion, and AI satisfaction scores.
