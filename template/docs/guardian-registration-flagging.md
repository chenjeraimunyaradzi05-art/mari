# Guardian Registration Flagging

> Implementation reference for the male-signal gate introduced in the "Male Registration Flagging & Guardian Rules" increment (30–35% in `way-forward.md`).

## Purpose

- Detect male-coded signals during `/register` submissions.
- Persist a reviewable record (`identity_flags` table) for guardian teams.
- Automatically place high-risk accounts on a `guardian_hold` participant profile type while allowing ally employers to proceed only after review.
- Notify guardian/admin surfaces plus the AI analytics dashboard.

## Data Model

### Table: `identity_flags`
| Column | Notes |
| --- | --- |
| `user_id` | FK → `users.id`, cascades on delete. |
| `source` | String (default `registration`). |
| `type` | String (default `male_signal`). |
| `status` | Backed enum (`pending`, `cleared`, `escalated`, `dismissed`). |
| `severity` | `low`/`medium`/`high`, derived from score thresholds. |
| `score` | Decimal, sum of triggered heuristics. |
| `reason` | Short label for the flag. |
| `signals` | JSON audit of the heuristics that fired. |
| `metadata` | JSON context (IP, UA, intent, account type, email domain). |
| `actions_taken` | JSON describing automated guardrails (e.g., guardian hold). |
| `flagged_at` | Timestamp of detection. |
| `resolved_by_admin_id` | Nullable FK → `admins.id`. |
| `resolved_at`, `resolution_notes` | Manual guardian workflow columns. |

## Detection Logic

Implemented in `App\Services\Guardians\RegistrationIdentityFlagger`:

| Heuristic | Weight | Notes |
| --- | --- | --- |
| Male-coded pronouns (`he/him`, `he/they`, `he_him_they`) | 0.65–0.70 | Directly mapped via `config/guardian.php`. |
| Masculine honorifics in name (`Mr`, `Sir`, etc.) | 0.20 | `title_tokens` list. |
| Male-coded first name match | 0.25 | Short curated dataset (`name_tokens`). |
| Email handle tokens (`mr`, `king`, `dude`, `bro`, etc.) | 0.20 | Looks at the local part only. |
| Ally account types (`company`, `business_network`, etc.) when any other signal fired | 0.15 | Nudges employer/provider flows into review. |

Thresholds (env-overridable):

```env
GUARDIAN_MALE_FLAGGING_ENABLED=true
GUARDIAN_MALE_FLAGGING_NOTIFY=0.45
GUARDIAN_MALE_FLAGGING_HOLD=0.80
```

- `notify_threshold` ⇒ persisted flag + guardian notifications.
- `auto_hold_threshold` ⇒ applies `participant_profile_type = guardian_hold` and marks severity `high`.

## Workflow

1. `RegisteredUserController::store()` now injects `RegistrationIdentityFlagger` and passes the registration payload, IP, and UA immediately after creating the `User` record.
2. When the score exceeds `notify_threshold`:
   - `identity_flags` row is created with pending status.
   - `onboarding_events` receives `identity_flag_created` telemetry.
   - Guardian admins (roles `guardian`, `guardian_team`) get an in-app notification (`guardian.identity_flagged`).
   - `ai_client_alerts` records a `guardian.identity` alert so the AI analytics dashboard surfaces the incident.
3. Scores ≥ `auto_hold_threshold` also apply the `guardian_hold` participant profile type so the member is gated until a guardian resolves the flag.
4. Guardians can clear/escalate flags by updating `identity_flags` (future admin UI will drive this flow).

## Extensibility Hooks

- **Config:** `config/guardian.php` centralises tokens/weights. Update the lists or thresholds and run `php artisan config:clear`.
- **Service overrides:** Bind a different implementation of `RegistrationIdentityFlagger` if we need ML-backed scoring (interface-compatible signature `handle(User $user, array $payload)`).
- **Notifications:** `InAppNotifier::notifyAdmin` is used so existing admin notification UI picks up identity flags automatically.
- **Analytics:** Because alerts land in `ai_client_alerts`, the admin AI analytics console inherits visibility without additional wiring.

## Testing

`tests/Feature/Auth/RegistrationTest.php` now includes `test_male_signal_registration_gets_flagged` to ensure:
- A `guardian_hold` profile type is applied for high-risk signups.
- `identity_flags` persists with a pending status for the new member.

Run the targeted suite:

```bash
php artisan test tests/Feature/Auth/RegistrationTest.php
```

## Next Steps

- Build the guardian triage UI (queue + resolution actions).
- Pipe male-signal summaries into the role dashboards (guardian persona) for SLA tracking.
- Extend identity flagging to post-registration changes (purpose wizard, profile edits) to catch late male pivots.
