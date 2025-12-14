# Home & Member Dashboard Redesign — Step 4 (Feature Toggle Scaffolding & Service Clients)

Date: 2025-11-09  
Reference: Step 3 Implementation Checklist

## 1. Feature Toggle Implementation

- Added home and member dashboard feature flags in `config/features.php`:
  - `features.home.pillar_band`
  - `features.home.vertical_gateway`
  - `features.candidate_dashboard.welcome_pulse`
  - `features.candidate_dashboard.persona_echo`
  - `features.candidate_dashboard.opportunity_streams`
- Flags read from `.env` entries (`FEATURE_HOME_PILLAR_BAND`, etc.) to support staged rollouts.

## 2. Service Client Scaffolding

- Introduced API client services (`App\Services`):
  - `CareerIntelligencePulseService`
  - `PersonaNudgeService`
  - `VerticalAggregatorService`
  - `OpportunityStreamService`
- Each client normalises payloads, applies graceful fallbacks, and logs degraded states for observability.
- Added configuration stubs in `config/services.php` for base URLs/timeouts, enabling environment-specific overrides.

## 3. Tests

- Added HTTP facade unit tests covering success and failure paths for each client service (e.g. `tests/Unit/Services/CareerIntelligencePulseServiceTest.php`).
- Tests ensure consistent payload shape even when upstream services return errors.

## 4. Next Steps (Step 5 Preview)

1. Create database migrations and seeders for `career_intelligence_snapshots`, `vertical_insights`, `creator_payouts`.
2. Wire dashboard/home view composers to hydrate with new service data under feature flags.
3. Implement monitoring hooks (Datadog dashboards, Sentry breadcrumbs) around feature toggles.
4. Draft API documentation for internal teams (Confluence update with payload contracts).
