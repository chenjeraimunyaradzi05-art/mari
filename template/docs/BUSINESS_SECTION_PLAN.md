# Business Section Architecture

_References absorbed:_ `moneyman-v3.0-COMPLETE.md` for the four-pillar vision, `exported-assets/*.md` for AI & social building blocks, `laravel-social-starter` for feed interactions, and `styles-improved.css` for the feminine palette / tokens.

## Goals

- Launch a dedicated `/business-network` public page and an authenticated `/business/dashboard` hub.
- Automatically provision data (models + seed defaults) so every new member lands on a working Business dashboard immediately after registration.
- Reuse existing social + AI capabilities (OpenAI-backed `AIContentService`, social posts, follows) but wrap them in Business-specific services/widgets.
- Keep UI consistent with the luxe/feminine brand tokens defined in `styles-improved.css`.

## Domain Model

- **BusinessProfile**: `user_id`, `slug`, `venture_name`, `tagline`, `hero_theme`, JSON focus pillars, support needs, metrics, etc. Boot hook guarantees a matching `SocialProfile` flagged as `profile_type = business`.
- **BusinessMilestone**: child records for each profile with status, due date, progress %, AI nudge text.
- **BusinessResource**: curated index of grants, templates, partners with tags + CTA meta. Global, not per-user, but filtered by industry/stage heuristics.

## Services

- **BusinessAiAdvisor** (`App\Services\Business\BusinessAiAdvisor`): wraps AI provider config to output a structured "venture playbook" (north star, 3 actions, 3 community prompts, social caption ideas). Falls back to deterministic content when AI disabled.
- **BusinessFeedService** (`App\Services\Business\BusinessFeedService`): pulls trending `SocialPost`s for `profile_type in ['business','company']`, merges in follower posts, surfaces recommended profiles + tags.

## HTTP Layer

- **DashboardController** (invokable) ensures a profile exists, hydrates starter milestones/resources, fetches AI plan + feed slices, and renders `business/dashboard.blade.php`.
- **PostController@store** lets founders publish quick updates to the social graph without leaving the dashboard (uses `ManagesSocialProfiles`).
- **NetworkLandingController** renders the public marketing page hooking into `BusinessResource` data so guests can explore before signing in.

## Routing & Flow

- `/business-network` (public) → `business.network`.
- `/business/dashboard` (auth) + nested POST route for updates (throttled by `auth` + `verified`).
- `RouteServiceProvider::BUSINESS_DASHBOARD = '/business/dashboard'` and `RegisteredUserController@store` redirects every freshly registered account here after any specialised flows (TAFE, real estate) run.

## Views & Styling

- `resources/views/business/dashboard.blade.php`: hero, AI coach, milestone timeline, curated resources, live social feed, partner carousel.
- `resources/views/business/network.blade.php`: marketing hero, partner grid, AI snippet, CTA to register. Inline CSS pulls color tokens from `styles-improved.css` (rose/teal gradients, layered cards, glassmorphism accents) to keep the feminine aesthetic consistent.

## QA / DX

- Feature test to assert `/business/dashboard` boots a profile + seeds defaults.
- Seeder helpers (`BusinessResource::ensureStarterSet`, `BusinessProfile::seedDefaultMilestones`) keep local/dev instances deterministic without manual SQL.

This scaffold keeps the surface area focused while leaving hooks to expand (e.g., dedicated mentor matching, deal rooms, analytics) without reworking the foundation.
