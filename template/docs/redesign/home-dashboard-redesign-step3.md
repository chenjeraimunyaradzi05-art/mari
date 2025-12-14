# Home & Member Dashboard Redesign — Step 3 (Feature Flags, API Contracts, Data Prep)

Date: 2025-11-09  
Reference: Steps 1 & 2, `moneyman-v3.0-COMPLETE.md`

## 1. Feature Flag Strategy

- **`features.home_pillar_band`**: wraps Pillar Highlights band; default `false` for production, `true` on staging.
- **`features.home_vertical_gateway`**: controls vertical tiles (dependent on stats data availability).
- **`features.dashboard_welcome_pulse`**: guards new welcome panel and trajectory metrics; ensure fallback to legacy hero.
- **`features.dashboard_persona_echo`**: toggles persona nudge row; must degrade gracefully when onboarding API down.
- **`features.dashboard_opportunity_streams`**: gates tabbed streams replacing existing job cards.
- **Rollout plan:** enable feature flags sequentially (home → dashboard) with 48-hour monitoring windows; maintain environment overrides via `.env` entries (`FEATURE_HOME_PILLAR_BAND=true`).
- **Observability hooks:** log flag activation events (`info` channel) and attach to existing analytics pipeline (Datadog dashboard) for UX metrics.

## 2. API Contract Mapping

### 2.1 Career Intelligence Service

```json
GET /api/v1/career-intelligence/pulse
Response 200 {
  "user_id": 123,
  "trajectory_score": 0.72,
  "target_role": "Product Lead",
  "summary": "You are 72% aligned with your Product Lead pathway...",
  "metrics": {
    "learning_hours": 18,
    "network_reach": 54,
    "content_influence": 0.31
  },
  "forecast_updated_at": "2025-11-09T04:21:00Z"
}
```

- Consumers: `Dashboard/WelcomePulse` component, optional caching layer (Redis key `ci:pulse:{user}` for 15 min).
- Dependencies: data science job to backfill `trajectory_score` nightly.

### 2.2 Persona Nudges (Onboarding)

```json
GET /api/v1/onboarding/persona-nudges
Response 200 {
  "personas": [
    {
      "id": "career-returner",
      "label": "Career Returner",
      "icon": "fi-rr-refresh",
      "nudges": [
        "Schedule a mentor session",
        "Complete gap analysis module"
      ],
      "cta": {
        "label": "Resume journey",
        "url": "/onboarding?persona=career-returner"
      }
    }
  ]
}
```

- `Dashboard/PersonaEchoRow` polls once on load; snooze/dismiss via `POST /api/v1/onboarding/persona-nudges/{id}/dismiss` with body `{ "snooze_days": 14 }`.
- Error handling: fallback message "Personalised guidance is loading soon." if 5xx.

### 2.3 Vertical Aggregator

```json
GET /api/v1/verticals
Query params: `include=stats,badges`
Response 200 {
  "data": [
    {
      "slug": "yachting",
      "name": "Yachting",
      "tagline": "Superyacht careers across Med & Caribbean",
      "stats": {
        "open_roles": 34,
        "courses": 12,
        "mentors": 7
      },
      "media": {
        "cover_image": "https://.../yachting.jpg"
      }
    }
  ]
}
```

- Cached for 1 hour; supports expansion to include video URLs.
- Additional endpoint `GET /api/v1/verticals/{slug}/spotlight` for hero card content.

### 2.4 Opportunity Streams

- Jobs: existing `GET /api/v1/jobs/recommended?persona=true` (already paginated).
- Apprenticeships: new `GET /api/v1/apprenticeships/recommended` returning structure similar to jobs (fields: `title`, `organization`, `location`, `closing_at`, `match_score`, `missing_skills[]`).
- Courses: existing education service `GET /api/v1/courses/recommended`.
- Mentorship: `GET /api/v1/mentorship/opportunities` (requires analytics team sign-off).
- Creator earnings: `GET /api/v1/creator/earnings/summary` returning `pending_payout`, `last_cpm`, `next_steps` for CTA copy.

## 3. Data Migration & Backfill Plan

- **Trajectory metrics:** create table `career_intelligence_snapshots` with columns (`id`, `user_id`, `trajectory_score`, `learning_hours`, `network_reach`, `content_influence`, `target_role`, `summary`, `captured_at`). Backfill from existing analytics exports.
- **Vertical stats:** schedule nightly job aggregating counts into `vertical_insights` table (`vertical_slug`, `open_roles`, `courses`, `mentors`, `refreshed_at`). Seed with baseline data from `moneyman-laravel` exports.
- **Apprenticeship catalog:** ensure `apprenticeships` table includes `intake_deadline`, `subsidy_type`, `vertical_slug` for filtering; run script to map legacy records via `backups/*/fix-ids-*` dataset.
- **Creator earnings:** integrate advertising metrics to populate `creator_payouts` table (fields `user_id`, `period_start`, `period_end`, `impressions`, `payout_amount`, `cpm`).

## 4. Implementation Checklist (Step 4 Preview)

1. Implement feature flags in config (`config/features.php`) with `.env` hooks.
2. Stub API client classes/services for new endpoints with contract tests.
3. Draft database migrations + seeders for new analytics tables.
4. Prepare monitoring dashboards (Datadog / Sentry alerts) keyed to new UI releases.
