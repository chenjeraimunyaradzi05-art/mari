# Women Real Estate Platform — Analytics & Telemetry RFC (Step 10)

## 1. Objectives

- Instrument end-to-end analytics for women-first real estate experiences across listings, mortgages, cohorts, and social flows.
- Provide actionable telemetry for product, growth, trust & safety, and AI platform teams.
- Ensure privacy-aware data handling with transparent opt-ins and retention policies.

## 2. Metrics Framework

| Pillar | Primary Metrics | Secondary Metrics |
| --- | --- | --- |
| Listings & Discovery | Listing views, saves, inquiries, publish-to-lead conversion | Time-to-first-view, AI insight engagement, social share multiplier |
| Mortgage Intelligence | Mortgage widget usage, repayment scenario completions, grant click-through | AI narrative satisfaction, data freshness score, rate discrepancy alerts |
| Agent & Verification | Verification SLA, approval rate, trust score distribution | Appeals rate, compliance incidents, agent referral success |
| Cohort & Learning | Cohort activation rate, goal completion, mentorship match success | Nudge effectiveness, cohort retention, study-to-listing conversion |
| Partnerships | Partner match acceptance, project onboarding velocity | Capital raised, collaboration sentiment, task completion |
| Social & Community | Feed engagement, shares, referral conversion, safety incident rate | Audience diversity index, share-to-follow ratio, moderation turnaround |

## 3. Data Capture Architecture

1. **Event Bus**: Use Laravel events + queue to emit domain events into `AdvancedAnalyticsService`.
2. **Event Schema**: Standardised payload (`event_name`, `distinct_id`, `entity_type`, `entity_id`, `properties`).
3. **Storage**: Primary write to analytics data warehouse (e.g., BigQuery/Snowflake) via batch exports; realtime views in Postgres for dashboards.
4. **Streaming**: Optional Kafka stream for AI training data, with privacy filters applied.
5. **Telemetry IDs**: propagate `telemetry_id` in responses for traceability across requests.

## 4. Instrumentation Plan

- **Backend**: Fire events from services/controllers (`WomenListingService`, `MortgageRepaymentService`, `WomenCohortService`).
- **Frontend**: Use JS analytics client (Segment/Amplitude) integrated into Blade layouts; fallback to server events for non-JS scenarios.
- **AI Pipelines**: `AIInferenceLog` entries mirrored to analytics for latency, error, satisfaction tracking.
- **Mortgage Engine**: `MortgageIntelligenceTelemetry` extended with rate freshness, scenario complexities.
- **Social Interactions**: `WomenListingSocialShare` update triggers `SocialInteractionRecorded` events.

## 5. Dashboards & Reporting

- **Executive Dashboard**: summary of all pillars, ARR projections, trust metrics via Looker/Data Studio.
- **Operations Dashboard**: verification queue health, incident response times, cohort engagement.
- **Growth Dashboard**: referral funnels, social amplification performance, conversion cohorts.
- **AI Quality Dashboard**: accuracy, satisfaction, cost per pipeline, drift detection.
- **Mortgage Insights Dashboard**: rate change alerts, scenario usage, grant uptake.

## 6. Alerting & SLAs

- PagerDuty/Slack alerts for:
  - Verification SLA breach (>24h pending cases).
  - Mortgage data stale (>24h without refresh).
  - AI error rate >10% or latency >5s.
  - Safety incident spike (threshold configurable).
- Mortgage rate discrepancy alert triggered when provider feed differs from displayed rate >0.2%.
- Auto-escalate severe trust events to on-call moderators.

## 7. Privacy & Compliance

- Respect user opt-outs (`user.analytics_opt_in`).
- Pseudonymise personal identifiers before exporting to external analytics systems.
- Document data retention (default 24 months; AI logs 12 months) and purge processes.
- Provide self-serve data export + deletion tools aligning with GDPR/CCPA.

## 8. Testing & Validation

- Automated tests verifying event firing with expected payloads (`Event::fake()` patterns).
- Staging environment runs synthetic scenarios to confirm dashboard ingestion.
- Periodic reconciliation between source-of-truth (database) and analytics counts.
- Data quality monitors (missing fields, null anomalies) built into ETL jobs.

## 9. Tooling & Integrations

- Analytics destinations: Segment → Mixpanel/Amplitude, Looker for BI.
- Logging: centralised via ELK/Datadog; filter sensitive data before logging.
- Feature flag analytics: integrate `FeatureService` toggles to evaluate feature success.
- Experimentation: integrate with `ABTestingService` results for aggregated reporting.

## 10. Documentation & Runbooks

- Update `docs/analytics.md` with new event taxonomy and naming conventions.
- Provide event dictionary for engineering/product teams.
- On-call guide for trust & safety analytics alerts.
- AI telemetry handbook explaining fields, thresholds, remediation steps.

## 11. Open Questions

- Preferred analytics warehouse stack (existing vs. new)?
- Do we need offline kiosks/mobile caching metrics for remote communities?
- Should we expose analytics APIs to verified partners (premium tier)?
- Strategy for cohort-specific data sovereignty requirements?
