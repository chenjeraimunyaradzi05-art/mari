# Home & Member Dashboard Redesign — Step 9 (Caching, Interactions, Snapshots)

Date: 2025-11-09  
Reference: Step 8 follow-up

## 1. Analytics Caching Layer

- Introduced `config/analytics.php` with dashboard cache TTL controls (pulse, payout, streams, personas).
- Wrapped `DashboardAnalyticsComposer` fetches with cache lookups keyed per-user via the new `App\Support\Analytics\DashboardCache` helper.
- Added helper methods to clear caches for pulse/persona/stream segments so background jobs can bust stale entries.

## 2. Livewire Dashboard Interactions

- Required `livewire/livewire` (v3) and scaffolded a safe fallback alias until dependencies are installed.
- Built `App\Livewire\DashboardPersonaEchoes` with dismiss/refresh actions backed by `PersonaNudgeService` and cache invalidation.
- Built `App\Livewire\DashboardOpportunityStreams` enabling expand/collapse controls and stream refresh signalling.
- Replaced the Blade partials with Livewire components and ensured layout loads Livewire assets plus stacked styles.

## 3. Snapshot Automation

- Added `dashboard:snapshots` artisan command to capture HTML of the member dashboard for enabled/disabled feature permutations, writing to `storage/app/snapshots`.
- Command logs each snapshot path, resets feature flags afterwards, and flushes dashboard caches for deterministic renders.

## 4. Testing & Coverage

- Updated unit coverage for the composer to respect the caching layer and prevent cross-test pollution.
- Added Livewire facade fallback hooks so the suite compiles before installing the Livewire dependency.

## 5. Next Steps (Step 10 Preview)

1. Wire background jobs to call the new cache flush helpers after analytics imports.
2. Add Livewire-powered toast notifications for persona dismissals and stream refresh events.
3. Extend the snapshot command with scenario flags (e.g., pulse-only, personas-only) and integrate into CI as a pre-release artefact.
