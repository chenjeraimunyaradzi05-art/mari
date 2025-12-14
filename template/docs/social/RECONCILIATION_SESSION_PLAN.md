# Social Graph Reconciliation Session

## Purpose

Bring product, data, and engineering leads into a single 60-minute working session to reconcile the social graph backlog with the newly implemented schema/models. The session will focus on aligning (1) career intelligence surfaces, (2) advertising/creator monetisation hooks, and (3) vertical UX narratives (mortgage, property social, training communities) so downstream teams can continue the 10%+ delivery increments without ambiguity.

## Proposed Logistics

- **Date (target):** Tuesday, 18 Feb 2025
- **Time:** 10:00–11:00 AEDT (60 minutes)
- **Host:** Social Platform PM (T. Mensah)
- **Facilitator:** Lead Social Engineer (You)
- **Notes & Recording:** Product Ops (assigned during session)

## Participants

| Role | Name | Coverage |
| --- | --- | --- |
| Engineering | Lead Social Engineer | Model/factory walkthrough, tech debt queue |
| Data & AI | Career Intelligence Lead | Signal ingestion, AI tagging, scoring |
| Product | Social Product PM | Experience goals, roadmap trade-offs |
| Advertising | Growth / Ads Lead | Sponsorship hooks, reporting needs |
| Design | Vertical UX Lead | Mortgage/property specific workflows |
| QA | Social QA Lead | Test data coverage, regression grid |

## Agenda (draft)

1. **5 min** – Recap of the 0–10% increments (schema, models, factories, seeding)
2. **10 min** – Career Intelligence overlays: feed ranking inputs, AI engagement scoring, telemetry gaps
3. **10 min** – Advertising + creator monetisation contracts: placement inventory, sponsorship flags, moderation hand-offs
4. **10 min** – Vertical UX checkpoints: mortgage dashboard, property social widgets, training/cohort timelines
5. **15 min** – Open issues & dependency burn-down (controllers, notifications, analytics events)
6. **10 min** – Decision log + next increment definition (10–15% scope, owners, due dates)

## Pre-work

- **Review** `docs/social/SCHEMA_SETUP.md` to understand the canonical data model.
- **Sync** the latest migrations/factories and run `php artisan migrate --seed --class=SocialSampleSeeder` to explore seeded demo data.
- **Prepare** top backlog items/questions from each domain (career intelligence, ads, vertical UX) so we can resolve them live.
- **Collect** any API or UI contracts that could be impacted by the social feed changes.

## Agenda Inputs

Please add your discussion topics or blockers here by **Friday, 21 Nov 2025** so we can finalize the run sheet. Feel free to append rows directly in this table or drop comments that link to supporting docs/dashboards.

| Domain / Track | Question or Decision Needed | Prep Owner | Status / Notes |
| --- | --- | --- | --- |
| Career Intelligence | _e.g., confirm telemetry gaps for AI engagement scoring_ |  |  |
| Advertising & Monetisation | _e.g., sponsorship flag propagation across controllers_ |  |  |
| Vertical UX | _e.g., mortgage dashboard feed contract updates_ |  |  |
| Analytics / QA | _e.g., seeded data coverage for regression grid_ |  |  |

> **Add more rows as needed.** If your topic needs pre-reading, link it in the second column so everyone can review ahead of the call.

## Expected Outputs

- Decision log covering schema or API adjustments needed for the next increment.
- Confirmed list of controller/service layer stories required to unlock notifications, moderation, and analytics wiring.
- Alignment on how seeded data will be reused for QA and demo environments (owners + timelines).
- Updated delivery checkpoint (10–15% increment) committed in project tracker within 24 hours.
