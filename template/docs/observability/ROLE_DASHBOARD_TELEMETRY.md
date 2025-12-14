# Role Dashboard Telemetry Wiring

This note explains how the adoption + widget SLA metrics move from analytics events into the two execution dashboards we care about: Grafana (for SRE/alerts) and the Impact dashboard (for program/partner storytelling).

## Data sources

| Layer | Location | Notes |
| --- | --- | --- |
| Raw events | `analytics_events` MySQL table | `role_dashboard.viewed` and `role_dashboard.widget.rendered` emitted inside `RoleDashboardService`. |
| SQL views | `database/migrations/2025_11_26_153500_create_role_dashboard_metrics_views.php` | Creates `role_dashboard_adoption_daily` + `role_dashboard_widget_sla_daily` for simple Grafana queries. |
| Aggregation service | `App\Services\Telemetry\RoleDashboardTelemetryService` | Powers both the API and the Impact dashboard render. |
| API | `GET /api/v1/analytics/role-dashboards` | Authenticated JSON response used by automation/integrations. |
| Impact UI | `GET /impact/role-dashboards` | Human-friendly visualization for partners + internal teams. |

## Grafana wiring

1. Ensure the Athena MySQL data source is available inside Grafana (usually named `Athena Prod MySQL`). Copy its UID and replace `MYSQL_DATASOURCE_UID` inside `docs/observability/grafana/role-dashboard-telemetry.json` if needed.
2. In Grafana, select **Dashboards → Import**, upload the JSON file above, and pick the Athena MySQL data source when prompted.
3. Panel 1 (`Daily role dashboard views`) reads directly from `role_dashboard_adoption_daily` and groups by `role`. Adjust the default time range to 14 days to match the service window.
4. Panel 2 (`Widget SLA`) surfaces render statistics and breach rates (>400ms by default) from `role_dashboard_widget_sla_daily`. Add conditional formatting in Grafana to highlight breach rates >5% if desired.
5. Panel 3 (`SLA breach watchdog`) queries `analytics_events` in five-minute buckets and already contains an alert definition: if the breach rate stays above 5% for 5 minutes the rule fires (tags: `service=role-dashboards`, `severity=high`). Tune the threshold/duration in the JSON if needed.
6. Whenever we tweak thresholds, re-export the dashboard JSON (Grafana → **Share → Export**) and commit the update so infra + product stay in sync.

## Impact dashboard wiring

- Controller: `App\Http\Controllers\Impact\RoleDashboardImpactController` pulls telemetry windows directly from the service and renders `resources/views/impact/role-dashboards.blade.php`.
- Route: `GET /impact/role-dashboards` (behind `auth` + `verified`). It also surfaces in the authenticated navigation bar so impact/ops folks can find it without bookmarking.
- The view shows:
  - Hero metrics (total views, unique members, average widgets/session, SLA threshold).
  - Per-role adoption cards with mini sparklines covering the last 7 days.
  - Widget SLA cards with breach callouts and per-widget latency stats.
- Query parameters (`?window_days=21&sla_window_days=10&sla_threshold_ms=500`) flow through to the telemetry service, so the Impact dashboard can be embedded with custom ranges.

## API consumers / exports

- `GET /api/v1/analytics/role-dashboards` remains the canonical machine interface (Grafana can also hit this if we add an HTTP data source). It returns:
  ```json
  {
    "adoption": { "range": {"from": "2025-11-13", "to": "2025-11-26"}, "series": [...] },
    "widget_sla": { "range": {"from": "2025-11-20", "to": "2025-11-26"}, "roles": [...] }
  }
  ```
- Use the `window_days`, `sla_window_days`, and `sla_threshold_ms` query parameters to match Grafana’s panels if you decide to fetch from the API instead of the SQL views.

With these hooks in place we now have a single telemetry flow (events → views/service → Grafana + Impact dashboard) and no more spreadsheet exports to understand role adoption.
