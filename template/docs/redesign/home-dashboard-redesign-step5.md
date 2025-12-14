# Home & Member Dashboard Redesign — Step 5 (Data Layer Foundations)

Date: 2025-11-09  
Reference: Step 4 follow-up

## 1. Database Migrations

- Added `career_intelligence_snapshots` table to persist AI trajectory metrics (`user_id`, `trajectory_score`, `learning_hours`, `network_reach`, `content_influence`, `target_role`, `summary`, `captured_at`).
- Added `vertical_insights` table for per-vertical counts and metadata (`vertical_slug`, `vertical_name`, `open_roles`, `courses`, `mentors`, `meta`, `refreshed_at`).
- Added `creator_payouts` table capturing creator economy earnings (`user_id`, pay period, impressions, payout amount, CPM, currency, status, meta) with uniqueness guard on period.

## 2. Seeders

- `VerticalInsightsSeeder` seeds the six launch verticals (Yachting, Luxury Hospitality, Aviation, Technology, Finance, Healthcare) with zeroed counts and timestamped metadata.
- `CareerIntelligenceSnapshotSeeder` creates a baseline snapshot for the first available candidate/user so dashboards render meaningful data out of the gate.
- `CreatorPayoutSeeder` seeds a representative paid-out earnings record to drive the Creator Earnings stream during demos.
- Registered new seeders inside `DatabaseSeeder` to keep local/staging environments aligned.

## 3. Next Steps (Step 6 Preview)

1. Build Eloquent models + repository helpers for the new tables (with casts/scopes for quick retrieval).
2. Wire feature-flagged controllers/view composers to consume the new services + models.
3. Implement background jobs/cron scripts to backfill and refresh the new tables from analytics sources.
4. Define Datadog dashboards & SLOs for trajectory accuracy, vertical freshness, and creator payouts processing.
