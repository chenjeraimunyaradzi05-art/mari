# Women Real Estate Platform — Data & Migration Plan RFC (Step 07)

## 1. Objectives

- Define database schema evolution supporting women-focused real estate workflows without disrupting existing services.
- Ensure migrations are idempotent, reversible, and performance aware with clear indexing strategy.
- Provide seeding approach for test fixtures and staged rollouts.

## 2. Migration Overview

| Area | Tables / Changes | Notes |
| --- | --- | --- |
| Listings | `women_listings` (augment), `women_listing_media`, `women_listing_audience_pivots`, `women_listing_social_shares`, `women_listing_partner_intentions` | Existing tables audited; new columns for AI insights, status flags. |
| Mortgage | `women_mortgage_market_rates`, `women_listing_mortgage_snapshots`, `mortgage_rate_snapshots` | Support Step 05 algorithm requirements. |
| Verification | `women_verified_agents` (augment), `women_agent_leads`, `women_agent_verification_audits` (new) | Audits capture reviewer actions + AI summaries. |
| Cohorts & Profiles | `women_cohort_profiles`, `women_cohort_enrolments`, `women_cohort_preferences` (optional) | Support learner/investor onboarding journeys. |
| AI Telemetry | `ai_inference_logs` (shared table) | Track prompts, providers, latency, outcomes. |
| Dashboards | `women_dashboard_preferences`, `women_dashboard_widgets` | Store layout/config per persona. |
| Auxiliary | `women_partner_projects`, `women_partner_matches`, `women_goal_trackers` | Enable partnership and goal tracking workflows. |

## 3. Migration Sequencing

1. **Phase A — Safety Preparation**
   - Add feature flags (`FeatureService`) and config toggles for women real estate modules.
   - Introduce baseline audit tables (`ai_inference_logs`, `women_agent_verification_audits`).

2. **Phase B — Core Schema**
   - Create new women real estate tables for cohorts, partner projects, dashboard preferences.
   - Augment existing listings and agent tables with new columns (AI insights, verification metadata, trust scores).
   - Migrate data types where necessary (e.g., `price` decimal precision) using transactional scripts.

3. **Phase C — Mortgage Enhancements**
   - Add mortgage market rate and snapshot tables with indexes for provider, effective date.
   - Seed initial provider data via migration or seeder stub to ensure non-empty datasets for QA.

4. **Phase D — Social & Analytics**
   - Introduce social share, partner match tables, AI telemetry.
   - Backfill historical listing events into analytics tables (optional) via queued job post-migration.

5. **Phase E — Cleanup & Optimisation**
   - Create database views or materialized views (depending on DB) for analytics dashboards.
   - Tune indexes after observing query plans in staging.

## 4. Table Specifications

### women_listings (augment)

- Add columns: `ai_insights` (JSON), `is_ai_safe` (boolean), `trust_score` (decimal 3,2), `market_score` (decimal 5,2), `published_via_social` (boolean), `social_boosted_at` (datetime).
- Indexes: composite index on (`intent`, `primary_audience`, `published_at`), GIN/JSON index on `ai_insights` (if supported).

### women_listing_media

- Fields: `listing_id`, `uuid`, `type`, `path`, `meta` (JSON), `ordering`, `is_primary`.
- Index: (`listing_id`, `ordering`).
- Add cascade delete constraints.

### women_listing_partner_intentions

- Fields: `listing_id`, `user_id`, `intent_type`, `payload` (JSON), `status`, timestamps.
- Indexes: (`user_id`, `status`), full-text on textual intent (if MySQL 8/Postgres).

### women_verified_agents (augment)

- Add: `verification_stage` (enum), `trust_badge_level` (tinyint), `compliance_score` (decimal 3,2), `last_reviewed_at` (datetime).
- Index: (`status`, `verification_stage`).

### women_agent_verification_audits (new)

- Fields: `agent_id`, `reviewer_id`, `status_before`, `status_after`, `notes`, `ai_summary` (JSON), `created_at`.
- Foreign keys to `users` and `women_verified_agents`.

### women_cohort_profiles

- Fields: `user_id`, `persona` (enum), `financial_profile` (JSON), `education_profile` (JSON), `ai_insights` (JSON), `preferences` (JSON).
- Index: (`persona`), (`user_id`).

### women_cohort_enrolments

- Fields: `cohort_slug`, `profile_id`, `role` (`learner`, `mentor`), `joined_at`, `status`.
- Index: (`cohort_slug`, `status`).

### women_partner_projects

- Fields: `owner_id`, `title`, `summary`, `capital_stack` (JSON), `status`, `target_launch_at`, `ai_insights` (JSON).
- Index: (`owner_id`, `status`).

### women_partner_matches

- Fields: `project_id`, `profile_id`, `match_score` (decimal 3,2), `confidence`, `status`, `notes` (JSON).
- Index: (`project_id`, `status`).

### women_goal_trackers

- Fields: `profile_id`, `goal_type`, `target_amount`, `current_amount`, `due_at`, `ai_nudges` (JSON), `progress_percent`.
- Index: (`profile_id`, `goal_type`).

### ai_inference_logs

- Fields: `pipeline`, `provider`, `prompt_hash`, `duration_ms`, `tokens_in`, `tokens_out`, `confidence`, `result_status`, `meta` (JSON).
- Index: (`pipeline`, `created_at`), (`provider`, `created_at`).

## 5. Foreign Keys & Integrity

- Use `foreignId()->constrained()` where possible; soft delete support with cascades to prevent orphaned data.
- Define enum columns via DB-native enums when supported; fallback to string with constraints.
- For cross-domain references (e.g., `users` table), ensure on-delete `cascade` or `set null` based on business rules.

## 6. Performance Considerations

- Batch migrations to avoid long locks; use intermediate tables for heavy transformations if needed.
- Run `analyze`/`optimize table` in production-like environments post-migration.
- Monitor query plans during staging QA; refine indexes accordingly.
- Add background job to recompute derived metrics (trust scores) after schema changes.

## 7. Seeding Strategy

- Create dedicated seeder classes (`WomenRealEstateSeeder`, `WomenMortgageRateSeeder`, `WomenCohortSeeder`) using factories.
- Seed minimal data in production migrations only when required (e.g., feature flags).
- Provide data fixtures for integration tests and local development (factories with states, scenario-specific seeders).

## 8. Testing & Rollout

- Write migration unit tests verifying column existence, defaults, foreign key constraints (using `Schema::hasColumn`, `DB::select` checks).
- Smoke test against staging dataset: run migrations, run critical queries, rollback, and migrate again to ensure reversibility.
- Feature flag each major module; gradual rollout by enabling for internal users first.
- Maintain rollback plan including snapshot of affected tables before destructive changes.

## 9. Documentation

- Update `docs/women-real-estate-models.md` post-migration with new relationships.
- Share ERD updates in architectural diagrams (draw.io or Lucidchart) linked from Step 02 RFC.
- Provide runbook for ops teams detailing migration order, monitoring, and rollback steps.

## 10. Open Questions

- Do we need multi-tenant sharding support in early phases? (Impacts key structure.)
- Preferred naming convention for AI telemetry table (shared vs. domain-specific)?
- Should cohort enrolments reference future `organizations` (TAFE/Uni) for reporting?
- Any legacy data requiring backfill scripts beyond new feature scope?
