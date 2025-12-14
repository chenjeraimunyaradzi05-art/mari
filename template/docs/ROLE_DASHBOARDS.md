# Role Dashboards v1

> Development artifact for the "Role Dashboards & Privacy Controls" increment (10–15% in `way-forward.md` and Track A3 in `mutiro.md`).

## Purpose

Deliver nine persona-specific dashboards that surface the exact operational and strategic signals each role needs, while respecting Athena's privacy and women-first enforcement rules. Every dashboard ships with:

- Shared layout at `resources/views/dashboards/role/index.blade.php`
- Data orchestration via `App\Services\Dashboards\RoleDashboardService`
- RBAC + feature-flag enforcement through `RoleDashboardPolicy`
- Feature flag per role so we can soft-launch cohorts

## Access Flow

1. Members finish the primary purpose wizard (`UserPrimaryPurpose` record).
2. `DashboardRouterController` detects that the member has a role dashboard feature flag and routes `/dashboard` → `dashboards.role.show`.
3. `RoleDashboardPolicy` ensures members only see their own role dashboard unless they hold an override role (`admin`, `guardian`, etc.).
4. Feature flags live in two places:
   - Config: `config/dashboard_roles.php` (canonical flag per role)
   - Member profile seed: `config/signup.php` (ensures the flag is assigned during onboarding)

## Roles & Widgets

| Role Key | Title | Feature Flag | Widgets |
| --- | --- | --- | --- |
| `candidate` | Candidate Mission Control | `candidate_dashboard_v1` | Career Pulse, Persona Echo, Pathway Progress, Opportunity Stream, Wellbeing Snapshot |
| `company` | Employer Talent Command | `company_dashboard_v1` | Requisition Health, Equity Snapshot |
| `public_sector` | Public Sector Impact | `public_sector_dashboard_v1` | Opportunity Radar, Civic Playbook |
| `mentor` | Mentor Guidance Hub | `mentor_dashboard_v1` | Session Pipeline, Relationship Health |
| `tafe_university` | TAFE & University Operations | `education_dashboard_v1` | Program Health, AI Recommendations |
| `business_network` | Business Network Exchange | `business_network_dashboard_v1` | Momentum Snapshot, Community Pulse |
| `real_estate` | Real Estate Safety Desk | `real_estate_dashboard_v1` | Pipeline Overview, Safety Compliance |
| `trades` | Trades & Apprenticeships Ops | `trades_dashboard_v1` | Apprenticeship View, Equipment Financing |
| `financial_literacy` | Financial Literacy Observatory | `financial_dashboard_v1` | Savings Milestones, Workshop Flow |

Each widget is declared in `config/dashboard_roles.php` and backed by a resolver inside `RoleDashboardService` that assembles the DTO exposed to Blade.

## Deployment Checklist

- [x] Config-driven role definitions (`config/dashboard_roles.php`).
- [x] Feature flag assignment during primary purpose onboarding (`config/signup.php`).
- [x] Router upgrade to send `/dashboard` traffic into the correct role dashboard when enabled.
- [x] Policy enforcement to keep dashboards private per persona.
- [x] Navigation entry point so members can always reach their mission control.
- [x] PHPUnit coverage for routing + policy enforcement.
- [x] Historical backfill to guarantee `_dashboard_v1` flags for existing members (`2025_11_26_142000_backfill_dashboard_feature_flags`).
- [x] Telemetry instrumentation via `RealTimeAnalyticsEngine` (role adoption + widget render timings).
- [x] Observability wiring: Grafana import (`docs/observability/grafana/role-dashboard-telemetry.json`) and Impact dashboard view at `/impact/role-dashboards`.

## Adding A New Dashboard

1. **Define role + widgets:** extend `config/dashboard_roles.php` with the new role block and widget keys.
2. **Add signup metadata:** ensure `config/signup.php` assigns the feature flag when members choose that purpose.
3. **Create resolvers:** implement widget builders in `RoleDashboardService` returning DTOs.
4. **Authorize:** update policy / gates if new override rules are needed.
5. **Seed data:** update factories or seeders if demo data is required.
6. **Test:** add feature + unit coverage for controller, router, and service.
7. **Document:** append to this file and the public roadmap as needed.

## Observability & Impact surfaces

- **Grafana:** Import `docs/observability/grafana/role-dashboard-telemetry.json` into the `Athena Prod MySQL` data source. Panel 1 charts daily adoption per role, panel 2 tracks widget SLA breach rates (>400 ms by default).
- **Impact dashboard:** Authenticated teams can visit `/impact/role-dashboards` (also linked from the signed-in navigation) to see live hero metrics, per-role adoption cards, and widget SLA callouts. Query parameters (`window_days`, `sla_window_days`, `sla_threshold_ms`) feed straight into the telemetry service for ad‑hoc reviews.
- **API:** `GET /api/v1/analytics/role-dashboards` remains the canonical machine interface—Grafana or partner exports can hit it directly if they prefer HTTP over SQL views.
