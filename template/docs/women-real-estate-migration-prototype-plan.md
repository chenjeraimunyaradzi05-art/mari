# Women Real Estate Platform — Migration & Seeding Prototype Plan (Step 11)

## 1. Goal

Produce a proof-of-concept branch that introduces the new schema, seed data, and validation scripts to de-risk full implementation before broader rollout.

## 2. Workstream Breakdown

1. **Schema Drafting**
   - Scaffold migration stubs for high-priority tables: `women_agent_verification_audits`, `women_cohort_profiles`, `women_cohort_enrolments`, `women_partner_projects`, `women_partner_matches`, `women_goal_trackers`, `ai_inference_logs`.
   - Augment existing tables (`women_listings`, `women_verified_agents`, `women_mortgage_market_rates`) with new columns using `Schema::table` migrations.
   - Apply indexing plan from Step 07 using `->index()` / `->unique()` calls.

2. **Factory & Seeder Suite**
   - Extend existing factories or create new ones under `database/factories/WomenRealEstate`.
   - Build scenario-based seeders: `WomenVerificationSeeder`, `WomenMortgageScenarioSeeder`, `WomenCohortSeeder`.
   - Compose `WomenRealEstatePrototypeSeeder` to wire all domain data for local/staging testing.

3. **Data Validation Scripts**
   - Artisan command `women:validate-schema` to confirm column presence, indexes, and foreign keys.
   - Artisan command `women:seed-prototype` to truncate + reseed relevant tables safely for QA environments.

4. **Testing Harness**
   - Migration tests ensuring `Schema::hasColumns` returns expected values.
   - Seeder integration tests verifying relationships (e.g., cohort enrolments attach to profiles, partner matches link to projects).
   - Snapshot baseline metrics after seeding (counts per table) for regression detection.

5. **CI Integration**
   - Update pipeline to run prototype seeder on feature branch (flagged via env variable) followed by PHPStan/PHPUnit.
   - Add `php artisan migrate --path=/database/migrations/women_real_estate` job to focus on new migrations first.

## 3. Branch & Release Strategy

- Create feature branch `feature/women-real-estate-schema-prototype`.
- Keep migrations isolated; rebase frequently to avoid drift.
- Use feature flags to prevent new tables from impacting production traffic until final rollout.

## 4. Acceptance Checklist

- [ ] All migrations run up/down successfully on fresh and existing databases.
- [ ] Seeders produce coherent demo data covering agents, listings, cohorts, mortgages, partnerships.
- [ ] Validation commands pass without error.
- [ ] CI pipeline includes new steps and remains green.
- [ ] Documentation updated (`docs/women-real-estate-migration-plan-rfc.md`, readmes).

## 5. Next Steps

- Once prototype validated, promote migrations into mainline implementation tasks (Step 12 onwards).
- Coordinate with QA to populate staging environment using prototype seeder for UX reviews.
- Gather feedback from product/legal on seeded data realism and compliance messaging.
