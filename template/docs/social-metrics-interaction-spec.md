# Social Metrics Interaction Contract

## Goal

Lock the interaction patterns (filters, timeframe toggles, async states) for persona and admin views so the ETL/API pipelines can be designed once without downstream rework. This spec is source-of-truth until UX issues a superseding version.

## Global Controls

- **Capture Date Selector**: Calendar input (default today) shared by Connections Hub and Admin dashboards. API parameter `date=YYYY-MM-DD`. Required before hitting ETL endpoints to avoid ambiguous ranges.
- **Persona Filter**: Numeric input or search for admin persona table (`persona_id`). Optional query parameter; when omitted, results aggregate across all personas.
- **Timeframe Toggle**: Quick switch between **Day (default)** and **7-Day Rolling**. Day view pulls single `captured_on`; rolling view sums the last 7 rows at query time. API flag `range=day|rolling7`. Future **30-Day** view references the persisted `connection_heatmap_bins_30d` column so FE can render extended heatmaps without recomputing.
- **Cohort/Segment Filter (future)**: Placeholder select (Mentors, Founders, Advocates). Storage now includes indexed `primary_cohort`, so once UX green-lights the filter the API can query via `cohort_slug` without another migration.

## Persona View (Connections Hub)

- **Header Date Picker**: Mirrors global capture date; when user adjusts, FE refetches `/api/social-metrics/:persona?date=...&range=day`.
- **Invite Funnel Segments**: Toggle between absolute counts and percentage view. Parameter `view_mode=counts|percent` returned to keep data consistent with UI selection.
- **Heatmap Range Buttons**: `7D` (default) and `30D`. The 30D toggle reads directly from `connection_heatmap_bins_30d` so responses stay lightweight; backend still returns the legacy `connection_heatmap_bins.daily_30` field for backward compatibility.
- **Pending Filters**: Buttons “Incoming” / “Outgoing” open filtered invites modal; no API impact beyond existing query strings.

## Admin Dashboard

- **Date & Persona Controls**: Sticky filter bar at top; submitting reloads KPIs, chart, and table in sync. Each downstream component receives same parameters.
- **Trend Range Toggle**: Buttons `7D` and `28D`. Changing toggle triggers aggregated query; API request includes `trend_range=7|28` so backend can sum correct window.
- **Table Sorting**: Default sort by connections desc; clickable headers send `sort=connections|invites|civility&direction=asc|desc`. API must respect allowlist and fall back gracefully.
- **Export Action**: Button “Export CSV” uses same filters; backend endpoint `/admin/social-metrics/export?date=...&persona=...` streams current view.

## Loading & Empty States

- **Skeletons**: Cards and charts show skeleton placeholders for 500ms or until response returns.
- **Empty Data**: If ETL has not produced rows for selected date, display friendly message and CTA to run `social:metrics-daily`. API should return `204` or `{ data: [] }` with metadata flag `missing_etl=true`.
- **Error Handling**: Surface toast + link to logs when ETL pipeline fails; API includes `error_reference_id` for correlation.

## Lock Confirmation

- Publish this spec alongside `docs/social-metrics-wireframes.md` and reference it in the ETL/API tickets.
- Engineering should not start new endpoints until Product + UX confirm no further interaction changes (deadline: end of current sprint). Use this doc’s Git history to track updates.
