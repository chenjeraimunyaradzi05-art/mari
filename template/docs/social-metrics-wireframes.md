# Social Metrics Wireframes & Prototype Notes

## Objective

Translate the `social_metrics_daily` fact table into clear persona-facing insights and admin/tust dashboards. These annotated wireframes describe layout, data bindings, and accessibility notes so Product/UX can create high-fidelity comps. Engineering can validate API payloads at each call-out. Async feedback is requested within 48 hours of circulation.

## Wireframe A — Connections Hub Persona Panel

```text
+------------------------------------------------------------+
| Persona Snapshot (avatar + display name + cohort tag)      |
|------------------------------------------------------------|
|  [Connections Card]   [Invite Funnel Card]  [Civility Chip]|
|  Total: ####          Sent: ##   Accepted: ##              |
|                       Conversion: ##%                      |
|                                                            |
|  [Heatmap Ribbon - 7 day mini calendar w/ tooltips]        |
|                                                            |
|  Pending: Incoming ## | Outgoing ## | CTA: Review Invites  |
+------------------------------------------------------------+
```

### Annotations — Connections Hub Persona Panel

1. **Connections Card**
   - Data: `total_connections` from `social_metrics_daily` for selected `captured_on`.
   - Behavior: Tap expands to show top connection sources; requires GET `/api/social-metrics/{persona}?date=YYYY-MM-DD`.
2. **Invite Funnel Card**
   - Data: `invite_funnel_bins.sent`, `.accepted`, `.conversion_rate`.
   - Visualization: stacked progress or paired bar; include microcopy for target conversion.
3. **Civility Chip**
   - Data: `messaging_civility_score`; color-coded thresholds (≥90 green, 75-89 amber, <75 red).
   - Accessibility: WCAG contrast, tooltip describing calculation (incidents vs. messages).
4. **Heatmap Ribbon**
   - Data: `connection_heatmap_bins.daily` (rolling dictionary of ISO date => count).
   - Interaction: Hover/focus states show date & count; keyboard arrow navigation across cells.
5. **Pending Counters**
   - Data: `connection_heatmap_bins.pending.incoming/outgoing`.
   - CTA deep links into invites queue with relevant filters.

## Wireframe B — Admin Social Metrics Dashboard

```text
+--------------------------+  +---------------------------+
| KPI Card: Personas       |  | KPI Card: Connections     |
| Count: ####              |  | Total: #####              |
+--------------------------+  +---------------------------+
| KPI Card: Invites        |  | KPI Card: Avg Civility    |
+--------------------------+  +---------------------------+

+-------------------------------------------------------------+
| 7-Day Trend (Lines: Connections vs Invites)                  |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
| Persona Table (top 50)                                       |
| Persona | Connections | Sent | Accepted | Civility | Pending |
+-------------------------------------------------------------+
```

### Annotations — Admin Dashboard

1. **KPI Cards**
   - Aggregate queries: sums/averages over selected `captured_on` via `SocialMetricsDashboardController`.
   - Include date picker + persona filter in header; ensure screen reader labels.
2. **Trend Chart**
   - Data: last 7 `captured_on` rows aggregated (`SUM(total_connections)`, `SUM(total_invites_sent)`).
   - Chart states: empty (no data), loading, error; mention server-provided dataset to Chart.js.
3. **Persona Table**
   - Source: eager-loaded `SocialMetricsDaily` models with `persona.user` relationship.
   - Columns include pending incoming/outgoing extracted from JSON bins; use icons + text for clarity.
   - Sorting by connections by default; allow civility sort to spotlight risks.
4. **Accessibility**
   - Provide offscreen description for chart; ensure table supports keyboard row focus and sticky header.

## Wireframe C — ETL Monitoring Stub

```text
+---------------------------+  +---------------------------+
| Last Capture: YYYY-MM-DD  |  | Personas Processed: ###   |
+---------------------------+  +---------------------------+

+-------------------------------------------------------------+
| Pipelines Table                                              |
| Name | Last Run | Personas | Command                        |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
| Recent Fact Loads Table (last 7 dates, totals)               |
+-------------------------------------------------------------+
```

### Annotations — ETL Monitoring

1. Shows operational health; data from `SocialMetricsDaily` grouped per date.
2. Include instructions for running `php artisan social:metrics-daily --force`.
3. Provide link to logs (storage/logs/etl.log) and Grafana panel (future).

## Prototype Handoff

- **Figma/Whiteboard**: Use this document as annotation layer; replicate layout in Figma with component names matching metric fields.
- **API Contracts**: Ensure `/admin/social-metrics` and `/api/social-metrics/:persona` return JSON matching the above callouts (see inline references).
- **Responsive Behavior**: Cards stack on mobile; charts collapse to sparklines; tables switch to key-value cards.

## Async Feedback Plan (48 hours)

1. Publish this doc plus linked low-fidelity frames in the Social Graph Slack channel and Asana ticket `SOCIAL-ETL-UI`.
2. Collect comments directly in the doc (GitHub PR review or Notion mirror) by **T+48h**; tag Product, UX, and Engineering owners explicitly.
3. Summarize decisions + open questions in the workshop doc (`docs/social-visualization-workshop.md`) and convert approved items into design/engineering subtasks.
4. Escalate unresolved blockers to the weekly social graph standup.
