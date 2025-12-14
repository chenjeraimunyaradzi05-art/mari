# Women Real Estate Platform — Architecture RFC (Step 02)

## 1. Purpose & Scope

- Consolidate the end-to-end domain architecture for women-first real estate experiences.
- Cover data domains, service boundaries, AI integrations, and social/media touchpoints.
- Serve as the blueprint for subsequent implementation steps (dashboards, APIs, UI).

## 2. Domain Pillars & Bounded Contexts

- **Listings & Discovery**: manages `WomenListing` lifecycle, media assets, audience filters, and publication workflows.
- **Mortgages & Financing**: curates `WomenMortgageMarketRate`, `WomenListingMortgageSnapshot`, real-time repayment models, and financial guidance AI.
- **Agent Verification & Compliance**: handles `WomenVerifiedAgent`, verification payloads, licensure states, escalation workflows.
- **Partnerships & Collaboration**: coordinates co-investment intents, study cohorts, mentorship matching, and partner projects.
- **Engagement & Social Distribution**: extends social feed, notifications, share pipelines, and trust badges.
- **Analytics & Insights**: aggregates listing metrics, AI observability, mortgage performance, cohort KPIs.

## 3. Target ERD Snapshot (High-Level)

```text
Users (App\Models\User)
  └─< WomenVerifiedAgent ─< WomenListing
         │                    ├─< WomenListingMedia
         │                    ├─< WomenListingAudiencePivot
         │                    ├─< WomenListingMortgageSnapshot >─ WomenMortgageMarketRate
         │                    ├─< WomenListingPartnerIntention
         │                    └─< WomenListingSocialShare
  └─< WomenAgentLead
  └─< PartnershipProfile (new)

WomenCohortProfile (new) ─< WomenCohortEnrolment (new)
WomenAgentVerificationAudit (new)
MortgageRateSnapshot (existing) ─< WomenMortgageMarketRate (imports)
AIInferenceLog (new shared table)
```

- **Notes**: introduce `PartnershipProfile` for developer collaborations; `WomenCohortProfile` for learners/investors; `AIInferenceLog` consolidates prompts/responses across AI touchpoints.

## 4. Service Architecture Overview

- **API Layer**: Laravel controllers (REST + Livewire) per context with policy gating.
- **Application Services**: existing `WomenListingAnalyticsService`, `MortgageRepaymentService`, `MortgageSnapshotIngestionService` extended with cohort + social boosters.
- **AI Pipelines**:
  - *Listing Intelligence*: summarise listings, generate safety/compliance tags, produce social captions.
  - *Mortgage Guidance*: real-time repayment suggestions, deposit advice, risk assessment.
  - *Career & Partnership*: match mentors/investors, recommend study pathways, detect collaboration fit.
- **Integration Points**:
  - Payment & invoicing systems for premium agent tiers (reuse existing billing services).
  - Notification stack (`RealTimeNotificationService`, email campaigns) for updates.
  - Analytics bus feeding `AdvancedAnalyticsService` and data warehouse exports.

## 5. Event & Workflow Flows

1. **Listing Publish Flow**
   - Agent creates listing → verification check (automated + manual) → AI moderation → publish → social amplification jobs queued.
2. **Mortgage Snapshot Refresh**
   - Scheduler runs ingestion → normalises providers → updates `WomenMortgageMarketRate` → recalculates repayment snapshots → notifies impacted dashboards.
3. **Agent Verification**
   - Submission → document OCR (AI assist) → regulator API check (future) → compliance review → status update + audit trail.
4. **Partnership Matchmaking**
   - Partner intent posted → AI clustering based on goals/capital → notifications to compatible users → optional intro call scheduling.
5. **Learning Cohort Enrollment**
   - User selects study/investment pathway → AI advisor recommends content → progress tracked in cohort dashboards.

## 6. AI Touchpoints & Observability

- Define prompt templates per pipeline with versioning stored in config or database.
- Cache layers via `AICacheService` to manage TTL-sensitive queries (mortgage vs. partner matches).
- Expand telemetry: log latency, token usage, satisfaction scores in `MortgageIntelligenceTelemetry` and new `AIInferenceLog`.
- Implement fallback routing (OpenAI → Anthropic) using existing `config/ai.php` pipeline definitions.

## 7. Social & Community Integration Plan

- Embed share hooks in listing publish events to queue content for:
  - Internal social feed (personalised by audience, location, intent).
  - External networks (LinkedIn, Instagram) via queued webhooks (phase 2).
- Extend `WomenListingSocialShare` model to capture platform, reach metrics, UTM parameters.
- Provide in-app referral loops (agents invite clients, investors invite partners) with reward tracking via `GamificationService`.

## 8. Real-Time Mortgage Data Strategy

- Primary data: extend `MortgageSnapshotIngestionService` with additional AU providers (banks, credit unions, grants) via API scrapers or CSV drops.
- Secondary sources: government grant APIs, ABS housing stats, Reserve Bank rate feeds.
- Normalisation: map to unified schema (`rate_type`, `max_lvr`, `deposit_percent`, `fees`) and versioned by `effective_at`.
- Risk & Recommendation Engine: combine `MortgageRepaymentService` outputs with AI commentary to produce personalised dashboards.

## 9. Security, Compliance, & Trust

- Enforce role-based policies (agents, mentors, learners) using Laravel policies + `Gate::define` with audit logging.
- Encrypt sensitive verification payloads (license documents, IDs) at rest; integrate with secrets manager for regulator API keys.
- Implement content safety filters (AI + human moderation) to protect women-only spaces.
- Ensure GDPR/CCPA readiness: consent tracking, data export, deletion workflows.

## 10. Open Questions & Next Steps

- Confirm regulator integrations per region (initially AU: NSW Fair Trading, VIC CAV, QLD OFT?).
- Decide messaging stack for partner collab (reuse existing DM vs. dedicated forum?).
- Validate whether to embed blockchain-proof-of-verification (mentioned in PRD) in phase 1 or defer.
- Next Step: Step 03 — define detailed verification + onboarding pathways, dashboard IA, and compliance processes.
