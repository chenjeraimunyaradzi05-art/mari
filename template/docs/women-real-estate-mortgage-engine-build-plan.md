# Women Real Estate Platform — Real-Time Mortgage Engine Build Plan (Step 17)

## 1. Objectives

- Implement the realtime mortgage engine based on Step 05 RFC, blending deterministic calculations with AI commentary and live data ingestion.
- Deliver performant APIs and widgets for listings, dashboards, and analytics stakeholders.

## 2. Core Components

1. **Data Ingestion Layer**
   - Extend `MortgageSnapshotIngestionService` to consume provider APIs, CSV feeds, scraping jobs.
   - Normalise into `mortgage_rate_snapshots` and `women_mortgage_market_rates`.
   - Schedule ingestion via Laravel scheduler/Horizon queues with retry logic and alerting.

2. **Calculation Engine**
   - Enhance `MortgageRepaymentService` to support variable/fixed mixes, interest-only periods, LMI fees, scenario matrices.
   - Introduce `MortgageScenarioBuilder` to generate common scenarios (5/10/20% deposit, rate +/- 0.5%).
   - Persist snapshot outputs in `women_listing_mortgage_snapshots` including AI commentary placeholder.

3. **AI Narrative Layer**
   - Integrate with AI orchestrator (Step 16) to produce summaries, risk assessments, action plans.
   - Validate outputs via `AIOutputValidator`, ensure numeric references match calculated amounts.
   - Store results in `ai_commentary` and `WomenCohortProfile.financial_ai_insights` for dashboards.

4. **API & Services**
   - Create `WomenMortgageController` endpoints: `GET /women/mortgages/{listing}` and `POST /women/mortgages/scenario` for personalised calc.
   - Service-level caching for repeated queries; allow `refresh=true` to bypass cache.
   - Expose GraphQL or data exports if required for analytics/growth teams.

5. **Dashboard & Widget Integration**
   - Livewire component updates for listing show page and learner/investor dashboards.
   - Display rate freshness indicator and fallback messaging when data stale.
   - Add grant eligibility panel linked to `GrantEligibilityService`.

6. **Telemetry & Monitoring**
   - Extend `MortgageIntelligenceTelemetry` with fields for data source, freshness, calculation duration, AI duration, user satisfaction.
   - Alerts for stale data, calculation failures, AI narrative fallback rate.
   - Observability dashboards (Grafana/Datadog) for ingestion success, cost, latency.

## 3. Data Quality & Compliance

- Implement checksum/duplicate detection in ingestion.
- Perform reconciliation with provider published rates (if API accessible).
- Store provider ToS references and ensure usage compliance.
- Attach disclosures to UI (informational only, not financial advice).

## 4. Testing Strategy

- Unit tests for `MortgageRepaymentService` covering numerous scenarios (edge cases, zero rates, high rates).
- Integration tests for ingestion service using mocked APIs/fixtures.
- API feature tests verifying endpoints, caching, and validation.
- Livewire component tests confirming UI updates upon scenario changes.
- Data accuracy regression tests comparing computed outputs with known ground truth samples.

## 5. Rollout Plan

1. **Prototype**: run ingestion against sandbox providers; store snapshots in dev DB.
2. **Feature Flag**: gate new engine behind `women_real_estate_mortgage_engine` flag.
3. **Staging QA**: verify rates, AI commentary, and latency with real provider data.
4. **Beta Launch**: enable for subset of users; collect feedback and monitor telemetry.
5. **Full Launch**: enable globally with ongoing monitoring and scheduled data refresh.

## 6. Documentation & Runbooks

- Update `docs/women-real-estate-mortgage-algorithm-rfc.md` with implementation specifics.
- Provide operational runbook detailing ingestion jobs, troubleshooting, escalation paths.
- Document API usage for frontend/mobile teams and partner integrations.

## 7. Open Questions

- Provider data licensing agreements finalised?
- Need for historical rate visualisations (line charts) at launch or phase 2?
- Handling multi-currency support when expanding internationally?
- Process for user feedback corrections (report inaccurate rate) and rapid remediation?
