# Women Real Estate Platform — AI Pipeline RFC (Step 04)

## 1. Goal

Establish world-class AI capabilities that power the women-first real estate experience, covering recommendation engines, mortgage guidance, moderation, and social amplification with resilience and observability.

## 2. Pipeline Catalogue & Ownership

- **Listing Intelligence Pipeline** (`AI_PIPELINE_LISTING_INTELLIGENCE`)
  - Owner: Women Real Estate squad + AI Platform team.
  - Function: enrich listings with safety checks, highlights, social captions, investor personas.
  - Trigger: listing draft save/publish, scheduled refresh every 24h.

- **Mortgage Guidance Pipeline** (`AI_PIPELINE_MORTGAGE_GUIDANCE`)
  - Owner: Finance Intelligence pod.
  - Function: calculate repayment scenarios, deposit strategies, grant eligibility commentary.
  - Trigger: user dashboard load, mortgage snapshot updates, cohort milestone changes.

- **Partner Matching Pipeline** (`AI_PIPELINE_PARTNER_MATCH`)
  - Owner: Partnerships pod.
  - Function: cluster investor/developer intents, recommend introductions, score compatibility.
  - Trigger: new intent posted, profile update, cohort enrollment.

- **Mentorship & Learning Pipeline** (`AI_PIPELINE_MENTOR_MATCH`)
  - Owner: Learning & Careers squad.
  - Function: pair learners with mentors, surface learning content, schedule nudges.
  - Trigger: onboarding completion, cohort transitions, mentor availability change.

- **Social Amplification Pipeline** (`AI_PIPELINE_SOCIAL_AMPLIFY`)
  - Owner: Social Growth team.
  - Function: craft cross-network captions, choose optimal share windows, monitor engagement.
  - Trigger: listing publish, milestone achievements, campaign launches.

- **Trust & Moderation Pipeline** (`AI_PIPELINE_TRUST_SHIELD`)
  - Owner: Trust & Safety.
  - Function: scan uploads/comments for policy violations, detect fraud patterns, escalate anomalies.
  - Trigger: user-generated content submission, verification payload update.

## 3. Architecture & Data Flow

1. **Event Source**: Laravel events (`ListingPublished`, `MortgageSnapshotUpdated`, `PartnerIntentCreated`) dispatched into queue workers.
2. **Orchestration Layer**: `AIWorkflowOrchestrator` service selects provider based on pipeline config in `config/ai.php`, applies prompt templates, handles retries/fallbacks.
3. **Provider Interface**: unified contract for OpenAI, Anthropic; additional connectors (Cohere, local LLM) pluggable.
4. **Caching**: `AICacheService` stores deterministic outputs (summaries, captions) keyed by hashing input payload. TTL varies (listing 24h, mortgage 15m, partner match 6h).
5. **Telemetry**: `AIInferenceLog` records prompt hash, provider, latency, token usage, score, user feedback.
6. **Downstream Consumers**: stored outputs persisted to relevant models (`ai_insights` JSON, `WomenListingSocialShare`), queued notifications, analytics streams.

## 4. Prompt & Template Strategy

- Prompts versioned in `resources/ai/prompts/*.json` with metadata (language, tone, compliance instructions).
- Dynamic context injection via `PromptContextBuilder` assembling:
  - Structured data (listing attributes, financial metrics) serialised to JSON block.
  - User persona tags (agent, renter, investor) for tone adaptation.
  - Safety guardrails: explicit instructions to avoid bias, reinforce women-first focus.
- Multi-turn conversations avoided; each inference stateless to simplify caching.
- A/B testing: `ABTestingService` randomly assigns prompt variants, logs performance in `AdvancedAnalyticsService`.

## 5. Model Selection & Routing

- Default provider: OpenAI `gpt-4.1-mini` for cost-effectiveness; upgrade to `gpt-4.1` for high-sensitivity outputs (mortgage explanations, trust decisions).
- Fallback: Anthropic `claude-3-5-sonnet-20241022` when OpenAI latency >3s or error rate >5% in rolling window.
- Fast path models: potential adoption of `o4-mini` (reasoning) for compliance tasks pending cost evaluation.
- Embeddings: `text-embedding-3-large` to generate vector representations stored in Pinecone/pgvector (phase 2) for similarity search (partner matching, content retrieval).

## 6. Real-Time Mortgage Algorithm Enhancement

- Combine deterministic calculation (`MortgageRepaymentService`) with AI narrative overlay.
- Fetch live rate snapshots via `MortgageSnapshotIngestionService`; pipeline validates data freshness (<30m) and triggers fallback to previous snapshot if stale.
- AI produces:
  - Summary text (plain language explanation).
  - Risk assessment (lender requirements, LMI risk, interest rate trajectory) with confidence score.
  - Action plan (e.g., increase deposit by AU$X, apply for grant Y, schedule mentor session).
- Outputs stored in `WomenListingMortgageSnapshot.ai_commentary` and `WomenCohortProfile.financial_ai_insights`.

## 7. Social Amplification Intelligence

- AI selects top three caption variants (motivational, factual, investment-focused); `SocialPostModerationPipeline` screens for compliance.
- Optimal share timing computed by blending historical engagement analytics with AI predictions.
- Social platform connectors (phase 2) call APIs with curated content; fallback to manual share suggestions when tokens missing.
- Engagement feedback loop writes metrics to `WomenListingSocialShare`, retraining prompts every 2 weeks.

## 8. Trust & Safety Guardrails

- Prompt hardening: include anti-discrimination clauses, enforce friendly yet professional tone, avoid financial or legal guarantees.
- Automated moderation uses lightweight classifier before LLM call to short-circuit obvious violations.
- Human-in-the-loop: flagged outputs (confidence <0.6, or mention of restricted topics) routed to reviewers via `TrustAlertService`.
- Maintain red-team tests quarterly; store test cases in `tests/AIPipelines/TrustShieldTest.php`.

## 9. Observability & SLAs

- Metrics tracked in `AIMetricsBroadcaster`: latency (p50/p95), success rate, token consumption, cache hit rate, satisfaction score (user feedback form).
- Alerts configured in Grafana/Datadog: latency >5s for 5m, error rate >10%, zero outputs produced.
- Cost monitoring: `AICostTracker` aggregates spend per pipeline, agent, and cohort to inform pricing strategies.

## 10. Privacy & Compliance Considerations

- PII stripped before prompt submission; sensitive numbers masked (`XXXX-1234`).
- No raw POI documents fed to LLMs; use extracted metadata only.
- Opt-out preferences respected; pipeline checks `user.ai_opt_in` flag.
- Retention: rotate cached outputs every 90 days unless explicitly pinned for audits.

## 11. Implementation Roadmap (Step Dependencies)

1. Create prompt repository + context builder utilities.
2. Implement `AIWorkflowOrchestrator` facade and register pipeline configs.
3. Extend existing services (listing analytics, mortgage) to call orchestrator with new prompts.
4. Build telemetry persistence (migration for `ai_inference_logs`).
5. Wire caching, fallbacks, and A/B testing harness.
6. Integrate outputs into dashboards and notifications (Livewire components, event listeners).
7. Finalise trust guardrails and run QA red-team scenarios.

## 12. Open Questions

- Do we need multilingual support in v1? (If yes, extend prompts with locale switching.)
- Preferred vector store for partner matching? Evaluate pgvector vs. external embeddings service.
- Mortgage data licensing constraints: confirm allowable usage of scraped rates.
- Budget allocation for premium model usage (estimate monthly spend, thresholds for downgrade/upgrade).
