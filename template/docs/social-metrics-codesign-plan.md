# Connections Hub Co-Design & Technical Readiness Plan

_Last updated: {{DATE:2025-11-24}}_

## 1. 90-Minute Co-Design Session

**Participants**: Social Graph PM, Growth PM, Lead Product Designer, Accessibility Specialist, Social Services Lead, Frontend (Connections Hub) Engineer, Admin Dashboard Engineer, Data/Analytics partner.

### Agenda (90 min)

1. _10 min_ – Context + goals (review metrics brief, interaction spec, and current persona pains).
2. _20 min_ – Walkthrough of existing fact-table outputs (`SocialMetricsDaily`, invite funnel bins, civility scores, heatmap bins).
3. _30 min_ – Co-design breakout:
   - Must-have Hub components (connections card, invite funnel, civility trend, heatmap, pending queues).
   - Filter/timeframe interactions (date picker, persona selector, range toggles) referencing `docs/social-metrics-interaction-spec.md`.
4. _15 min_ – Admin dashboard mapping (KPI cards, trend chart, persona table, ETL monitor tie-in).
5. _10 min_ – Privacy/accessibility cues (anonymization, opt-outs, WCAG notes).
6. _5 min_ – Action review + owners for prototype, API updates, and follow-ups.

### Outputs

- Whiteboard captures (FigJam/Miro) exported to Figma project.
- Decision log appended to `docs/social-visualization-workshop.md`.
- Open questions captured in Asana ticket `SOCIAL-ETL-UI`.

## 2. Prototype Deliverables (within 1 sprint day)

- **Low-Fidelity Wireframes**: Extend `docs/social-metrics-wireframes.md` into Figma frames labeled Persona Panel, Admin Dashboard, ETL Monitor. Include overlays for mobile/desktop states.
- **Clickable Prototype**: Simple clickable path (Connections Hub → detail card → admin view) linking frames; highlight interactive filters/timeframe toggles.
- **Annotations**: Inline Figma notes referencing data sources (`SocialMetricsDaily` fields, API endpoints) and privacy cues (civility explanation, invite visibility rules).
- **Async Feedback**: Share Figma link in Social Graph Slack channel; request comments from PM/UX/Engineering within 24h, automatically reminding at 36h. Tag stakeholders per component.

## 3. Validation & Sign-Off

1. **Pilot Review**: Run 30-minute remote validation with 2 mentors + 2 candidates. Use prototype to walkthrough tasks (check invites, monitor civility). Record qualitative feedback.
2. **Decision Logging**: Summaries appended to product spec (`docs/social-metrics-discovery-brief.md` or product wiki) with accept/reject for each component.
3. **Sign-Off Flow**:
   - UX lead confirms accessibility + usability acceptance.
   - PM validates KPIs supported and posts “ready” note in Asana.
   - Engineering lead acknowledges feasibility and creates implementation tickets. No engineering kickoff until these three confirmations exist.

## 4. Technical Workstreams

### 4.1 Database Migrations (already implemented but confirm readiness)

- **Referral Codes**: `invites` table migration adding `referral_code` + constraints (see `2025_11_24_120000_add_cohort_slug_and_referral_code_constraints_to_invites_table.php`). Ensure seeder/backfill validated.
- **Privacy Audits**: `profile_privacy_audits` table to capture tier changes (migration `2025_11_24_121500_create_profile_privacy_audits_table.php`). Verify observer emits entries.
- **Analytics Fact Table**: `social_metrics_daily` migration (`2025_11_24_123000_create_social_metrics_daily_table.php`). Confirm indexes and JSON columns.

### 4.2 Service Refactors & Tests

- **Verification Service**: Plan refactor of `SocialProfileVerificationController` + related services to log privacy audits and referral flows. Add feature tests covering approvals/denials.
- **Messaging Service**: Update civility scoring + invites to ensure incidents/messages counted correctly; add PHPUnit coverage for `SocialMetricsAggregationService` and `SocialMetricsEtlPipeline` (mock simple datasets, assert aggregates).
- **ETL Command Tests**: Feature test for `social:metrics-daily` with persona filter/force flag ensuring pipeline logs success/failure.

### 4.3 Requirements & Roadmap

- **Requirement Extraction**: Use briefs + workshop outcomes to finalize user stories (Connections Hub cards, admin dashboards, ETL monitor) with acceptance criteria referencing metrics.
- **Social Graph Upgrade Plan**: Sequence backlog—migrations (done), ETL pipeline (in place), UI/UX builds, verification/messaging refactors, instrumentation, go-live guardrails.
- **Dependencies**: Chart.js assets, authorization gating for admin routes, performance monitoring for ETL logs.

## 5. Next Steps

1. Send workshop invites + discovery brief two days in advance.
2. Prepare dataset snapshots (dev DB seeding) for prototype demos.
3. After workshop, update Asana roadmap with tasks for prototype, validation, service refactors, and testing.
4. Schedule pilot validation and PM sign-off deadlines aligned with sprint goals.
