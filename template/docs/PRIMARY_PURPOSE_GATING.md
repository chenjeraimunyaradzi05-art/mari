# Primary Purpose Signup Gating

Athena now enforces a dedicated purpose capture wizard between account creation and the rest of onboarding. This satisfies Track A2 (5–10%) requirements from the Mutiro execution plan.

## Objectives

- Force members to declare one of the nine sanctioned primary purposes before any dashboard is unlocked.
- Capture secondary intents + identity alignment data points that power role-aware feature flags.
- Provide telemetry to guardian teams so they can observe drop-offs or suspicious male-signal inputs.

## Data Model

| Table | Purpose |
| --- | --- |
| `user_primary_purposes` | Stores the canonical purpose record per user, including the selected role, secondary intents, identity alignment, feature flags, and guardian notes. |

Key columns:

- `user_id` (unique FK)
- `primary_purpose` (enum-like string: public_sector, candidate, company, mentor, tafe_university, business_network, real_estate, trades, financial_literacy)
- `secondary_intents` (JSON array of intents such as `career_growth`, `launch_business`, etc.)
- `feature_flags` (JSON bag of feature switches derived from config)
- `identity_alignment` (woman_identifying, gender_diverse, ally_male_employer)
- `purpose_story` / `male_signal_notes` (free-form text for guardians)
- `completed_at` timestamp used by middleware gating

See migration `database/migrations/2025_11_26_000500_create_user_primary_purposes_table.php` for schema details.

## Flow Overview

1. **Registration** – user submits the existing `/register` form.
2. **Primary Purpose Wizard** – authenticated user is redirected to `/setup/primary-purpose` and must:
   - Choose a primary purpose card (radio style).
   - Select at least one secondary intent.
   - Declare identity alignment (women, gender-diverse, or ally employer) and optional notes for male-signal review.
   - Optionally add story/context for guardians.
3. **Role Selection** – only after saving the purpose record do we redirect to the existing `/setup/role-selection` screen.
4. **Dashboards** – `EnsureOnboardingCompleted` middleware continues to enforce completion of later steps before unlocking dashboards.

## Telemetry & Drop-Off Tracking

- Each visit to the wizard records `primary_purpose_wizard_viewed` in `onboarding_events` with payload metadata.
- Successful submissions log `primary_purpose_wizard_completed` (+ `primary_purpose_wizard_first_completion` on first save).
- These events are consumable via existing onboarding insights APIs/dashboards for funnel analysis.

## Middleware Enforcement

`App\Http\Middleware\EnsureOnboardingCompleted` now checks `User::hasCompletedPrimaryPurpose()` before evaluating the remainder of the onboarding flags. Any attempt to hit authenticated routes without a completed purpose record redirects to `/setup/primary-purpose` (or returns HTTP 409 for JSON clients).

## Configuration

The shared copy and metadata for this flow live in `config/signup.php`:

- `primary_purposes`: title, summary, icon, default role, and feature flags for each option.
- `secondary_intents`: human-readable labels used by both the registration form and wizard.
- `identity_alignment_options`: copy for male-signal intake.

Updating the config automatically refreshes the wizard UI and validation rules.

## Tests

`tests/Feature/Auth/PrimaryPurposeWizardTest.php` covers:

- Redirect behaviour when a user skips purpose capture.
- Happy-path submission storing data and updating classification/role.
- Validation enforcement for missing intents.

`tests/Feature/Account/PurposeSettingsControllerTest.php` covers:

- Rendering the settings UI for a completed member.
- Guardian/admin updates with lookup/target override logic.

`tests/Feature/Api/Onboarding/PrimaryPurposeApiTest.php` ensures the mobile JSON endpoints can read + update the record and emit both onboarding + analytics telemetry.

Run the suite with:

```bash
php artisan test tests/Feature/Auth/PrimaryPurposeWizardTest.php
php artisan test tests/Feature/Account/PurposeSettingsControllerTest.php
php artisan test tests/Feature/Api/Onboarding/PrimaryPurposeApiTest.php
```

## Guardian/Policy Notes

- Ally/male employers are still allowed but must explicitly select the corresponding identity alignment and notes so guardians can monitor their downstream access.
- Purpose selection is now editable via **Settings → Purpose & Access** (`account/purpose`). Members can adjust their own record, while guardians/admins can lookup any member and apply corrections without database access.
- The wizard copy emphasises privacy and outlines how data is used, aligning with the women-first enforcement principles in Track A.

## Settings UI & Telemetry Panel

- Controller: `App\Http\Controllers\Account\PurposeSettingsController`
- View: `resources/views/account/purpose/edit.blade.php`
- Routes: `account/purpose` (GET + PUT) protected by `auth` middleware

Features:

- Lookup box lets guardians search by ID or email (requires `review primary purposes` ability or elevated role).
- Side panel shows event log sourced from `onboarding_events` (`primary_purpose_*` actions) for quick auditing.
- Form shares validation rules with the wizard and reuses `UserPrimaryPurposeService` so classification + feature flags remain consistent.

## Analytics & Dashboards

- Both the settings UI and the mobile API emit analytics events via `PurposeAnalyticsReporter`, so the `analytics_events` dashboard now tracks:
   - `primary_purpose_settings_updated` (source `account-settings`).
   - `primary_purpose_api_updated` (source `mobile-api`).
- Each analytics event carries actor/target IDs, intent counts, and alignment data, letting `/api/v1/analytics/events/summary` surface purpose adjustments without querying `onboarding_events` manually.

## Mobile API Endpoints

- Controller: `App\Http\Controllers\Api\V1\PrimaryPurposeApiController`
- Routes:
   - `GET /api/v1/onboarding/purpose` → returns the member record plus purpose/intent/alignment catalogues.
   - `PUT/PATCH /api/v1/onboarding/purpose` → upserts the record, logs `primary_purpose_api_updated`, and mirrors analytics telemetry.
- Native apps can now finish or edit the gating flow without rendering Blade views.
- Guardians/admins can pass `user_id` (GET) or `target_user_id` (PUT/PATCH) when they possess the `review primary purposes` ability or matching role, enabling case management from mobile tooling.
