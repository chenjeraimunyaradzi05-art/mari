# Women Real Estate Platform — Application Layer & Routing RFC (Step 08)

## 1. Scope

Define controller structure, routing strategy, policies, middleware, and feature-flagging required to deliver women-first real estate functionality across web and API interfaces.

## 2. Controller & Livewire Structure

| Area | Controller / Component | Responsibility |
| --- | --- | --- |
| Listings | `WomenListingController`, `WomenListingAdminController`, `Livewire\Listings\WomenListingForm`, `Livewire\Listings\WomenListingShow` | CRUD, publish workflow, AI insights display, moderation tools. |
| Mortgage | `WomenMortgageController`, `Livewire\Mortgage\CalculatorWidget`, `Livewire\Mortgage\ScenarioPlanner` | Real-time repayment calculations, AI commentary, grant eligibility. |
| Agents | `WomenAgentVerificationController`, `WomenAgentDashboardController`, `Livewire\Agents\VerificationWizard` | Verification submission, review queues, dashboard overview. |
| Cohorts | `WomenCohortController`, `Livewire\Cohorts\Dashboard`, `Livewire\Cohorts\MentorMatching` | Learner/investor onboarding, cohort management, mentor pairing. |
| Partnerships | `WomenPartnerProjectController`, `WomenPartnerMatchController`, `Livewire\Partners\Workspace` | Project listings, match recommendations, collaboration workflows. |
| Social | `WomenSocialFeedController`, `WomenSocialShareController`, `Livewire\Social\Feed` | Feed rendering, share actions, referral management. |
| Admin Ops | `WomenRealEstateAdminController`, `WomenAIInsightsController` | Cross-domain metrics, AI pipeline monitoring, feature toggles. |
| API | `Api\WomenListingController`, `Api\WomenMortgageController`, etc. | JSON endpoints for mobile apps and partner integrations. |

## 3. Routing Plan

- Web routes grouped under `routes/women-real-estate.php` and loaded via service provider (`WomenRealEstateServiceProvider`).
- Namespace separation: `App\Http\Controllers\WomenRealEstate` to avoid conflicts.
- Route prefixes & middleware:
  - `/women/real-estate` base group using `auth`, `verified`, `feature:women_real_estate`.
  - Agent dashboard: `/women/agents` with `can:access-women-agent-dashboard`.
  - Cohort dashboard: `/women/cohorts` with `can:access-women-cohort-dashboard`.
  - Admin panel: `/admin/women-real-estate` with `auth:admin`, `can:manage-women-real-estate`.
- API routes: `routes/api/women-real-estate.php` with `auth:sanctum`, `throttle:60,1`, `feature` middleware.

## 4. Policy Matrix

| Policy | Target Model | Key Abilities |
| --- | --- | --- |
| `WomenListingPolicy` | `WomenListing` | view, create, update, publish, archive, promote, viewAiInsights. |
| `WomenVerifiedAgentPolicy` | `WomenVerifiedAgent` | submitVerification, viewDashboard, updateLicense, manageListings. |
| `WomenCohortProfilePolicy` | `WomenCohortProfile` | view, update, joinCohort, leaveCohort, accessMentorTools. |
| `WomenPartnerProjectPolicy` | `WomenPartnerProject` | create, invite, acceptMatch, archive. |
| `WomenDashboardPolicy` | Dashboard preferences/widgets | customise, reset, shareAccess. |
| `WomenAIInsightsPolicy` | AI outputs | viewSensitiveInsights, refresh, escalate. |

- Register policies in `AuthServiceProvider`; use `Gate::before` for super-admin override.

## 5. Middleware & Feature Flags

- Feature flags via `FeatureService` keys: `women_real_estate_core`, `women_real_estate_mortgage`, `women_real_estate_social`, `women_real_estate_partnerships`.
- Middleware stack:
  - `EnsureWomenRealEstateEnabled` (checks feature flag).
  - `EnsureVerifiedAgent` (ensures agent status before accessing restricted areas).
  - `EnsureCohortPersona` (validates persona-specific dashboards).
  - `LogWomenRealEstateActivity` (queue audit events for analytics).
- Rate limiting for AI-heavy endpoints (mortgage calculations, partner matches).

## 6. Validation & Request Objects

- Form requests under `App\Http\Requests\WomenRealEstate` (e.g., `StoreWomenListingRequest`, `UpdateWomenMortgageScenarioRequest`).
- Validation rules incorporate enum classes (`ListingIntent`, `ListingAudience`, `MortgageRateSource`).
- Custom validation rules: `ValidRegulatorLicense`, `SafeHtml`, `AcceptableMediaType`.
- Use `prepareForValidation` to normalise currency inputs, decimals, toggles.

## 7. Response & Resource Layer

- API resources under `App\Http\Resources\WomenRealEstate` (e.g., `WomenListingResource`, `WomenMortgageScenarioResource`).
- Standardise meta fields: `ai_insights`, `cache_status`, `telemetry_id` for traceability.
- For Livewire components, pass computed data via view models (`WomenListingViewModel`) to maintain consistency.

## 8. Event & Job Wiring

- Controllers dispatch domain events:
  - `WomenListingPublished`, `WomenListingSocialShared`, `WomenAgentVerified`, `WomenCohortEnrolled`, `WomenMortgageScenarioRequested`.
- Queue jobs handle heavy lifting: `ProcessWomenListingAIJob`, `GenerateMortgageNarrativeJob`, `SyncExternalSocialPostJob`.
- Observers trigger from model changes to invalidate caches and broadcast notifications.

## 9. Error Handling & UX Feedback

- Leverage `AIErrorHandler` for pipeline exceptions, fallback to human-readable messages.
- Validation errors localised under `lang/en/women-real-estate.php` (and other locales as needed).
- Provide toast/alert components integrated into Blade layouts for consistent user feedback.
- Capture domain-specific exceptions (e.g., `AgentVerificationException`) and render via `renderable` closures in `Handler`.

## 10. Testing Strategy

- Feature tests for each controller route (authentication, authorisation, happy-path, failure cases).
- Livewire component tests verifying UI logic, event emissions, policy enforcement.
- API contract tests using `pest` or `phpunit` default; snapshot responses with `assertJsonStructure`.
- Integration tests covering cross-cutting workflows (publish listing → AI job → social share event).

## 11. Documentation & Tooling

- Update `routes/README.md` or create `docs/women-real-estate-routing.md` summarising route map.
- Generate OpenAPI specs for API endpoints (extend `app/Docs` if existing) and publish via `l5-swagger` config.
- Register new commands (e.g., `women:reindex-listings`) where relevant in `app/Console/Commands`.

## 12. Open Questions

- Do we need GraphQL endpoints for partner integrations? (Impacts schema design.)
- Mobile app parity: which controllers require dedicated API pagination formats?
- Should admin dashboards reside in existing admin area or new standalone module?
- How granular should feature flags be for phased rollout (e.g., separate flag per cohort persona)?
