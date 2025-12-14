# Social Metrics Discovery Brief

## Overview

This brief prepares Product and UX leaders for the upcoming social visualization workshop. It captures the problem space, personas, key performance indicators, and technical constraints so stakeholders can align two days before the session and arrive with open questions resolved.

## Objectives

1. Confirm how Connections Hub and admin dashboards should surface persona-level insights (connections, invites, civility, heatmap bins).
2. Align on visualization + accessibility requirements before ETL/API engineering commits to contracts.
3. Identify any data gaps (e.g., 30-day heatmap, cohort filters) that must be prioritized ahead of design finalization.

## Personas & Stakeholders

- **Community Member Personas**: Mentors, Founders, Advocates pulling their own social stats in Connections Hub.
- **Trust & Safety Ops**: Moderators reviewing civility trends and pending queues.
- **Product Leads**: Social Graph PM, Growth PM.
- **UX Leads**: Lead product designer, accessibility specialist.
- **Engineering**: Social services lead, frontend engineer (hub), admin dashboard engineer, data/analytics partner.

## KPIs & Success Metrics

- Connection growth rate per persona cohort.
- Invite conversion percentage (sent vs. accepted).
- Messaging civility score above 85% for 90% of active personas.
- Time-to-detect unhealthy patterns (pending spikes, civility drops) < 24h via admin dashboards.
- Pipeline reliability: `social:metrics-daily` completes within 5 minutes and processes 100% active personas nightly.

## Technical & Design Constraints

- **Data Source**: `social_metrics_daily` fact table populated by `SocialMetricsEtlPipeline`; currently stores 7-day heatmap bins, invite funnel bins, civility scores.
- **API Contracts**: `/api/social-metrics/:persona` and `/admin/social-metrics` to implement filters defined in `docs/social-metrics-interaction-spec.md` (date, range, persona, trend toggles, sorting).
- **Accessibility**: Charts must meet WCAG 2.1 AA contrast, provide keyboard focus states, and include descriptive aria labels.
- **Performance**: Admin table limited to top 50 personas per request; pagination/backfill scoped for future release.
- **Future Enhancements**: 30-day heatmap option and cohort filters reserved—must not block current sprint but should be captured in backlog.

## Pre-Read Materials

- `docs/social-metrics-one-pager.md` (metric definitions and surfaces).
- `docs/social-metrics-wireframes.md` (annotated layouts).
- `docs/social-metrics-interaction-spec.md` (locked filters/timeframes).
- Latest ETL logs or dashboard screenshots if available.

## Circulation Plan

1. Send this brief, plus links above, to Product + UX leads and engineering partners **two days before** the scheduled workshop (target: EOD Monday for Wednesday session).
2. Use Social Graph Slack channel + Asana task `SOCIAL-ETL-ALIGN` to request async questions ahead of the meeting.
3. Capture acknowledgements from each lead confirming they have reviewed the brief; log confirmations in the workshop agenda doc.
4. Update brief if major risks emerge, otherwise treat it as frozen until after the workshop outcomes are documented.
