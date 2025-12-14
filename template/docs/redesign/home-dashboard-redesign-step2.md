# Home & Member Dashboard Redesign — Step 2 (Wireframes & Component Contracts)

Date: 2025-11-09
Reference: `moneyman-v3.0-COMPLETE.md`, Step 1 Scope

## 1. Annotated Wireframe Specs

### 1.1 Home Hero Stack

```text
+----------------------------------------------------------------------------+
| HERO: Gradient backdrop (sunrise palette), subtle motion overlay           |
|----------------------------------------------------------------------------|
| LEFT COLUMN (60%)                                                          |
|  - Headline: "WomenRise: Elevate Your Career Intelligence"                 |
|  - Subhead: "Unlock trusted jobs, apprenticeships, and AI-powered insights"|
|  - CTA Row:                                                                |
|      [ Join WomenRise ] [ Find Apprenticeships ] [ Explore AI Demo ]       |
|  - Trust badges: logos for Govt Partner, Luxury Hospitality Alliance       |
|----------------------------------------------------------------------------|
| RIGHT COLUMN (40%)                                                         |
|  - Interactive card stack (swipe / auto-rotate) showing:                   |
|      • Yachting placement story (video thumb + 5★ rating)                  |
|      • Career Intelligence snapshot (trajectory chart sparkline)           |
|      • Apprenticeship spotlight (open seats count + deadline)              |
|  - Microcopy: "Curated for women, verified daily."                         |
+----------------------------------------------------------------------------+
```

**Notes:**

- Hero cards pull from vertical content blocks, career intelligence summary, and apprenticeship catalog.
- CTA buttons require deep-link routes (`route('register')`, dedicated apprenticeship landing, AI demo page).

### 1.2 Pillar Highlights Band

```text
+----------------------------------------------------------------------------+
| FOUR-COLUMN GRID (desktop) / CAROUSEL (mobile)                             |
|----------------------------------------------------------------------------|
| [Recruitment + Social]                                                     |
|  Icon: fi-rr-users-alt                                                    |
|  Copy: "Premium roles & a supportive social graph."                        |
|  Metric: "92% job satisfaction"                                           |
|  CTA: "Browse curated roles" → `route('jobs.index')`                      |
|----------------------------------------------------------------------------|
| [Education]                                                                |
|  Icon: fi-rr-graduation-cap                                               |
|  Copy: "University & micro-credential pathways."                          |
|  Metric: "1,800+ verified courses"                                        |
|  CTA: "Explore providers" → `route('organizations.courses.index')`        |
|----------------------------------------------------------------------------|
| [Apprenticeships]                                                          |
|  Icon: fi-rr-tools                                                        |
|  Copy: "End-to-end apprenticeships with subsidies."                       |
|  Metric: "320 open intakes"                                               |
|  CTA: "See apprenticeships" → new route                                   |
|----------------------------------------------------------------------------|
| [Strategic Innovations]                                                    |
|  Icon: fi-rr-rocket                                                       |
|  Copy: "Career Intelligence Engine & vertical labs."                      |
|  Metric: "Predictive accuracy 87%"                                        |
|  CTA: "Preview insights" → AI landing                                     |
+----------------------------------------------------------------------------+
```

**Notes:**

- Ensure responsive stacking with consistent card height and gradient borders.
- Metrics configurable via CMS or config array.

### 1.3 Vertical Gateway Section

```text
+----------------------------------------------------------------------------+
| SECTION TITLE: "Choose Your Vertical"                                     |
| Subtitle: "Step into curated pathways built with industry leaders."       |
|----------------------------------------------------------------------------|
| BADGE GRID (3 x 2)                                                         |
|  [Yachting]     [Luxury Hospitality] [Aviation]                            |
|  [Technology]   [Finance]            [Healthcare]                          |
|----------------------------------------------------------------------------|
| Each badge tile:                                                           |
|  - Cover image / gradient icon                                             |
|  - Short descriptor (<= 50 chars)                                          |
|  - Stats chips: {Open roles, Courses, Mentors}                             |
|  - CTA: "Enter Vertical" → `/verticals/{slug}`                            |
|----------------------------------------------------------------------------|
| Secondary CTA: "See all verticals"                                        |
+----------------------------------------------------------------------------+
```

**Notes:**

- Tiles should support video overlays (hover/press) for premium storytelling.
- Stats chips sourced from vertical aggregator service (jobs, courses, mentors counts).

### 1.4 Member Dashboard — Welcome & Persona Echo Row

```text
+----------------------------------------------------------------------------+
| DASHBOARD WELCOME PANEL                                                    |
|----------------------------------------------------------------------------|
| Left:                                                                      |
|  Greeting: "Hi, Aisha" + persona icon stack                               |
|  Main insight: "Your Career Intelligence Pulse: 72% to Product Lead"      |
|  Supporting text: AI-generated summary (<= 160 chars)                      |
|  CTA buttons: [ Resume Journey ] [ View Personas ]                         |
| Right:                                                                     |
|  Circular progress dial (Trajectory Score)                                 |
|  Secondary metrics row: {Learning hours, Network reach, Influence score}   |
+----------------------------------------------------------------------------+
| PERSONA ECHO CARDS (3 across)                                              |
| Each card:                                                                 |
|  - Icon + Persona label (e.g., "Career Returner")                         |
|  - Nudge copy (max 2 bullet points)                                        |
|  - CTA: "Take next step" linking to relevant module                        |
|  - Dismiss/ snooze action                                                  |
+----------------------------------------------------------------------------+
```

**Notes:**

- Persona data pulled from onboarding API (existing endpoints) with caching.
- Influence score sourced from social engagement analytics (new endpoint).

### 1.5 Member Dashboard — Opportunity Streams

```text
+----------------------------------------------------------------------------+
| TABBED STREAMS                                                             |
| Tabs: Jobs | Apprenticeships | Courses | Mentorship | Creator Earnings      |
|----------------------------------------------------------------------------|
| Each tab pane (3-card layout):                                             |
|  Card header: role/course/program title + badge (vertical)                 |
|  Meta row: company/provider | location | compensation/scholarship          |
|  AI tags: Matched skills %, Missing skills, Application deadline           |
|  Actions: [View details] [Save] [Share]                                    |
|  Optional: "AI Coach Tip" microcopy per card                              |
+----------------------------------------------------------------------------+
```

**Notes:**

- Use lazy loading per tab; integrate with existing job/apprenticeship/courses endpoints.
- Creator earnings tab requires advertising/creator payout feed.

## 2. Component Contracts (Draft)

| Component | Type | Location | Props/Data | Notes |
|-----------|------|----------|------------|-------|
| `Home/HeroStack` | Blade partial (`resources/views/frontend/home/sections/hero-stack.blade.php`) | Home layout | `headline`, `subheadline`, `ctas[]`, `trustBadges[]`, `highlightCards[]` | Replace existing hero with new partial; highlight cards expect `type`, `title`, `media`, `stat`, `cta`. |
| `Home/PillarHighlights` | Blade partial | Home layout | `pillars[]` (each: `slug`, `icon`, `copy`, `metric`, `cta`) | Backed by config file `config/pillars.php` for easy updates. |
| `Home/VerticalGateway` | Livewire component (`app/Http/Livewire/VerticalGateway.php`) | Home layout | `verticals` collection eager loaded with counts | Livewire to support hover states and future filters. |
| `Dashboard/WelcomePulse` | Blade partial | Member dashboard | `user`, `trajectoryScore`, `personaIcons[]`, `aiSummary`, `metrics` | Metrics array supports flexible ordering. |
| `Dashboard/PersonaEchoRow` | Livewire component | Member dashboard | API-driven persona nudges, actions emit to onboarding endpoints | Handles dismiss/snooze with optimistic UI updates. |
| `Dashboard/OpportunityStreams` | Livewire component | Member dashboard | `streams` keyed by tab; each entry provides paginated collection | To reuse existing job/course partials; ensures consistent lazy loading. |

## 3. Open Questions / Dependencies

1. **Vertical Landing URLs:** Confirm desired slug pattern (`/verticals/{vertical}` vs `/industries/{vertical}`) and routing guard.
2. **Creator Earnings Feed:** Identify whether data originates from advertising metrics service or manual CMS input.
3. **Trajectory Score Definition:** Align with data science team on calculation cadence (daily vs real-time) and confidence thresholds.
4. **Feature Flag Strategy:** Determine if we need per-section toggles (e.g., `features.home_pillars`, `features.dashboard_persona_echo`).

## 4. Next Slice (Step 3 Preview)

- Formalise feature flag plan and rollout sequencing.
- Map data service contracts to API endpoints (request/response payloads).
- Draft migration/backfill requirements for vertical stats and metrics.
