# Social Visualization Alignment Workshop

## Purpose

Align Product, UX, and Engineering on the visualization requirements for the social metrics surfaces (heatmap, invite funnel, civility trend) while confirming accessibility constraints and the API contracts that feed those widgets.

## Participants

- **Product**: Social Graph PM, Growth PM
- **UX**: Lead product designer, Accessibility specialist
- **Engineering**: Social services lead, Frontend engineer for Connections Hub, Admin dashboard engineer
- **Data/Analytics (optional)**: Analyst supporting `social_metrics_daily`

## Agenda (60 minutes)

1. **Context recap (5 min)** – Product shares success metrics tied to Connections Hub and admin dashboards.
2. **Current data model review (10 min)** – Engineering walks through `SocialMetricsAggregationService`, `SocialMetricsEtlPipeline`, and fact fields (connections, invites, civility, heatmap bins).
3. **Visualization requirements (20 min)**
   - Heatmap granularity (daily vs. hourly), color scale, hover states, timezone handling.
   - Invite funnel views (sent vs. accepted vs. conversion), cohort segmentation needs.
   - Civility trend expectations (threshold markers, alert states, annotations).
4. **Accessibility + UX constraints (10 min)** – UX team details contrast ratios, keyboard interactions, screen-reader copy, and fallback views when charts fail.
5. **API contract confirmation (10 min)** – Engineering confirms endpoints/GraphQL resources, caching windows, pagination, and payload shape for each widget.
6. **Next steps & owners (5 min)** – Assign actions for visual specs, API updates, and usability testing.

## Pre-Work & Inputs

- Latest `docs/social-metrics-one-pager.md` for definitions and destinations.
- Screenshots or wireframes of Connections Hub cards and admin analytics dashboard.
- Accessibility checklist (WCAG 2.1 AA) for charts.
- Sample payloads from `SocialMetricsDaily` (heatmap bins, invite funnel bins, civility scores).

## Outcomes & Deliverables

- Signed-off visualization spec covering heatmap, funnel, and civility trend (including responsive breakpoints & empty states).
- Accessibility acceptance criteria documented for each visualization.
- API contract note capturing required fields, filtering, and SLAs (including any adjustments to `social-metrics` endpoints).
- Follow-up tasks logged for engineering (API gaps), UX (detailed mockups), and Product (success metrics & rollout plan).

## Logistics

- Suggested date: within the next sprint (target mid-week to unblock design refresh).
- Format: 60-minute video workshop with collaborative whiteboard (FigJam or Miro) and access to staging dashboards for reference.
- Meeting notes owner: Engineering lead; action tracker in existing social-graph Asana project.
