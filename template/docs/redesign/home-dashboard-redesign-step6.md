# Home & Member Dashboard Redesign — Step 6 (Domain Models & Analytics Repositories)

Date: 2025-11-09  
Reference: Step 5 follow-up

## 1. Domain Models

- Added Eloquent models for the new analytics tables:
  - `App\Models\CareerIntelligenceSnapshot`
  - `App\Models\VerticalInsight`
  - `App\Models\CreatorPayout`
- Each model exposes casts, scopes, and relationships (e.g. `User::careerIntelligenceSnapshots()` and `User::creatorPayouts()`) to simplify dashboard hydration.

## 2. Repository Layer

- Introduced lightweight analytics repositories under `app/Support/Analytics/Repositories`:
  - `CareerIntelligenceRepository` → latest/history lookups for trajectory data.
  - `VerticalInsightRepository` → ordered vertical collections and slug lookups.
  - `CreatorPayoutRepository` → most recent earnings + recent history for creator economy widgets.
- Repositories rely on query scopes from the new models, keeping controllers/view composers clean and feature-flag friendly.

## 3. Tests

- Added repository unit tests (`tests/Unit/Support/Analytics/*RepositoryTest.php`) using refreshed databases to guarantee scope ordering and latest-record retrieval.

## 4. Next Steps (Step 7 Preview)

1. Wire home & dashboard composers/controllers to consume repositories (guarded by feature flags).
2. Integrate service clients with the repositories for blended real-time + persisted data.
3. Plan background refresh jobs (e.g. nightly vertical aggregation, hourly trajectory snapshots, payout sync).
4. Document monitoring/alert thresholds for stale data and failing syncs.
