# Women Real Estate Platform — Real-Time Mortgage Algorithm RFC (Step 05)

## 1. Mission Statement

Deliver a transparent, real-time mortgage intelligence engine tailored for women buyers, students, and investors, combining deterministic finance calculations with AI-driven narrative guidance grounded in up-to-date market data.

## 2. Data Source Strategy

- **Primary Providers**
  - Existing `MortgageSnapshotIngestionService` templates (Aurora Mutual, EquiHome Cooperative, Nova First Home, InvestHer Capital).
  - Expand to include major Australian institutions (Commonwealth Bank, NAB, ANZ, Westpac) via API or structured scraping.
  - Regional credit unions and women-focused lenders (HerBank, Athena) sourced via CSV/API partnerships.
- **Secondary Datasets**
  - Reserve Bank of Australia (RBA) cash rate feeds.
  - Australian Bureau of Statistics (ABS) housing affordability indexes.
  - Government grant repositories (First Home Owner Grant, HomeBuilder programs).
- **Data Ingestion Cadence**
  - Provider rates: hourly where possible; fallback to daily snapshots.
  - Macroeconomic indicators: daily retrieval with change detection.
  - Grants: weekly refresh with change notifications.

## 3. Normalisation & Storage

1. **Schema**
   - `women_mortgage_market_rates`: canonical lender products, including `rate_type`, `max_lvr`, `fees`, `feature_flags`.
   - `mortgage_rate_snapshots`: raw provider ingest history with checksum for auditing.
   - `women_listing_mortgage_snapshots`: listing-specific overlays (principal, deposit, repayments, AI commentary).
2. **Transformation Pipeline**
   - Ingestion job fetches raw payload → validator ensures schema conformity → normaliser harmonises terminology (e.g., "comparison_rate" vs "apr") → deduplicator merges identical products.
   - Enrichment step attaches macroeconomic context (cash rate delta) and grant eligibility tags.
3. **Versioning**
   - Each rate record stamped with `effective_at` and `source_version`; maintain history for compliance and trend analysis.
   - Soft-delete policy ensures legacy records remain queryable for historical charts.

## 4. Calculation Engine

- Deterministic component built atop `MortgageRepaymentService` extended to support:
  - Variable vs fixed splits, interest-only phases, offset accounts.
  - Multiple repayment frequencies (weekly, fortnightly, monthly) with rounding rules per lender.
  - Fees and insurance premiums (LMI) factored into APR and repayments.
- Dynamic inputs:
  - Loan amount derived from listing price + user deposit scenarios (5%, 10%, 20%).
  - Interest rate scenario matrix: base, +0.5%, -0.5% to model rate movement sensitivity.
- Output payload:
  - `repayment_schedule`: JSON array with frequency, amount, rate assumption.
  - `deposit_requirements`: recommended deposit tiers with savings milestones.
  - `risk_rating`: low/medium/high from deposit ratio + debt-to-income heuristics.
  - `grant_applicability`: list of relevant grants with eligibility verdict.

## 5. AI Narrative Layer

- AI pipeline summarises calculations in plain English, addressing:
  - Affordability overview in audience-appropriate tone (students vs investors).
  - Risk alerts (e.g., high LVR may trigger LMI) and suggested mitigations.
  - Confidence score referencing data recency and lender track record.
- Prompt context includes structured financial outputs, user persona tags, and macroeconomic trends.
- Deploy guardrails preventing deterministic errors (AI proposals validated against calculated numbers before persisting).

## 6. Real-Time Refresh & Caching

- Mortgage snapshot recalculation triggered by:
  - New listing publish or price update.
  - Data source refresh event (rate change, grant update).
  - User interaction requesting personalised scenario.
- Cache tiers:
  - Short-term cache (Redis) for identical queries within 15 minutes.
  - Persistent snapshots stored per listing to avoid recalculating historical views.
- Staleness detection: highlight when data older than 24 hours and provide fallback messaging.

## 7. Exposure & UX Integration

- **Listings**: display mortgage widget with repayment sliders, AI commentary, grant badges.
- **Agent Dashboard**: insight cards showing buyer affordability distribution, recommended marketing angles.
- **Learner Dashboard**: savings progress bar, recommended actions, mentor prompts.
- **Investor Workspace**: ROI projections including rental yield vs mortgage cost, partnership financing suggestions.

## 8. Observability & Quality Metrics

- Track metrics via `MortgageIntelligenceTelemetry`:
  - Data freshness, calculation latency, AI narrative latency, error rates.
  - User feedback rating on mortgage guidance (thumbs up/down, comments).
- Alert thresholds:
  - Rate discrepancy >0.2% between provider feed and displayed rate.
  - Calculation failure rate >1% over 10-minute window.
  - AI narrative deferral (fallback text) >5% of requests.
- Quarterly audits comparing displayed repayment figures with lender calculators for accuracy validation.

## 9. Compliance & Ethical Considerations

- Financial advice disclaimer attached to outputs; clarify guidance is informational, not a loan offer.
- Option to connect certified mortgage brokers for personalised consultation.
- Data governance: store lender terms of use, ensure scraped data rights are respected.
- Accessibility: ensure mortgage widget accessible (ARIA labels, alternative text, color contrast).

## 10. Implementation Roadmap

1. Extend ingestion service with new providers + create monitoring dashboards.
2. Build enhanced calculation engine modules (fees, scenarios, grants).
3. Design AI prompt templates and validation hooks for narrative layer.
4. Implement caching + staleness indicators within service layer.
5. Develop UI components (Blade/Livewire) for listing and dashboard integrations.
6. Ship telemetry dashboards and automated accuracy tests.
7. Conduct beta with select agents/investors before general rollout.

## 11. Open Questions

- Provider API access: confirm partnership agreements and rate limits.
- Should we model refinancing scenarios or focus on first-time mortgages first?
- How do we handle multi-region expansion (currency, regulatory differences)?
- What level of personalization requires user consent for credit profile integration?
