# Social Platform v2 — Design Updates (Nov 17, 2025)

This document translates the outstanding PRD items (see `PRD-v2.0-Complete.md` §2.3 *Social Graph & Interaction*, §10 *AI Assist & Safety*, and the verification RFCs under `docs/`) into concrete implementation plans. It focuses on four backlog items called out during the last review:

1. Multi-profile switcher for women personas.
2. Expanded verification workflow with document upload + reviewer queue.
3. Invite + friend-sync endpoints to grow the graph.
4. Privacy tier toggles aligned to the PRD safety commitments.

Each section below outlines objectives, required code changes, data impacts, UI notes, analytics hooks, and open questions.

---

## 1. Multi-Profile Switcher

### Objectives & Success Metrics

- Allow each user to create, view, and switch between personas (personal, professional, creator, business) without leaving the current surface.
- Keep org- and member-facing UI in sync with `profiles.active_profile_id` and reflect persona metadata surfaced in `app/Enums/OrganizationPageType`.
- Instrument switching to understand adoption by vertical, persona type, and context.

### Data Model & Services

- `profiles` table already has `is_primary`, `is_active`, and `women_safety_mode`. Add:

  - `last_switched_at` (nullable timestamp) for analytics.
  - `switch_context` (enum: `global_nav`, `composer`, `org_page`, `lead_form`) to understand intent.

- Extend `App\Models\User::switchActiveProfile()` to update both columns and emit `PersonaSwitched` domain event (queued, for analytics + cache busting).
- Update `App\Services\Social\SocialProfileProvisioner` to ensure `social_profile_id` hydration when switch occurs (skip provisioning if already linked).

### API & Controller Layer

- `PersonaController@index` and `switchActive` already exist. Add:

  - `GET /api/account/personas/active-context` returning `{ active_profile, persona_meta, available_personas[] }` for nav hydration.
  - `POST /api/account/personas/{profile}/switch` to accept optional `context` payload, update `last_switched_at`, emit event, and broadcast over websockets for live UI refresh (channel: `private-users.{id}.personas`).

- Add rate limiting (max 40 switches/hour) via middleware to prevent abuse.

### Frontend / UX

- Build a `PersonaSwitcher` Blade+Alpine component for shared nav (`resources/views/layouts/app.blade.php`) showing avatar chips, persona badges (from `OrganizationPageType::personaMeta()`), and quick links.
- Inline switcher entrypoint inside share/composer modals so users can swap personas before posting.
- Add empty state when only one persona exists, linking to `POST /account/personas` (existing wizard) and surfacing benefits (per PRD persona highlights).

### Analytics & Tests

- Track switches via `analytics.track('persona.switch', { persona_type, context, profile_id })` (RealTimeAnalyticsEngine pipeline) for PRD §11 KPI coverage.
- Feature tests: extend `tests/Feature/Account/PersonaControllerTest.php` to cover context payloads, rate limiting, and event dispatch.
- Contract tests for new response resource.

### Dependencies & Risks

- Requires websocket infrastructure (Pusher or Ably) already configured for notifications; confirm channels.
- Need to ensure `active_profile_id` updates propagate to caches (feed, AI personalization). Consider invalidating feed caches keyed by `user:{id}:persona:{profile_id}`.
- UX complexity on mobile — confirm design tokens match design system.

---

## 2. Verification Workflow Expansion

### Objectives & Scope (Verification)

- Implement the verification flow detailed in `docs/women-real-estate-verification-onboarding-rfc.md` and `docs/women-real-estate-agent-verification-plan.md` (submission → automated screen → manual review → decision → monitoring).
- Support document uploads, AI summaries, reviewer queue, and reminders outlined in PRD §10 (AI Assist & Safety).

### Data Model & Artifacts (Verification)

- Extend `profile_verifications` with:

  - `user_id`, `risk_score` (decimal), `submitted_at`, `decision_at`, `decision_reason`, `attachment_manifest` (JSON), `fraud_flags` (JSON), `license_expires_at`, `assigned_reviewer_id`.

- New tables:

  1. `verification_documents` (`verification_id`, `disk`, `path`, `mime`, `checksum`, `redacted_preview_path`).
  2. `verification_audits` (`verification_id`, `action`, `actor_id`, `notes`, `ai_summary`, `created_at`).
  3. `verification_queue_assignments` for reviewer workload management.

- Add indexes for `status`, `risk_score`, `assigned_reviewer_id`, `license_expires_at` (for scheduled jobs).

### Services & Jobs (Verification)

- `WomenVerificationService` orchestrates intake, writing to `profile_verifications` and dispatching `ProcessAgentVerificationJob`.
- `FraudDetectionService` returns `risk_score` + `fraud_flags` stored in submission.
- `GenerateVerificationSummaryJob` uses AI provider to summarize docs and stores result in `verification_audits`.
- Monitoring jobs:

  - `SendVerificationReminderJob` (90/30/7-day cadence) for upcoming expirations.
  - `AutoSuspendExpiredAgentsJob` to toggle profile badges + `social_profile.verification_status`.

### Controller / Route Updates

- Member side: extend `Account\ProfileVerificationController` to support multi-step Livewire wizard, file uploads via chunked endpoints, and `draft` state.
- Admin: new routes under `routes/admin.php`:

  - `GET /admin/verifications` (queue filters by risk, status, assigned reviewer).
  - `POST /admin/verifications/{id}/decision` (approve/reject/request-info) with mandatory reason + optional attachments.

- API responses should use `ProfileVerificationResource` with nested documents + audits.

### UI / UX

-- Member wizard (Blade + Livewire) with progress tracker, upload dropzones, AI helper text, and safety copy.
- Admin console showing AI summary cards, document viewer (render redacted preview), timeline, and quick actions.
- Status badges surface on profile cards + `social.profile.verification` page (existing view) with history table.

### Security & Compliance

- Store files on encrypted disk (S3 SSE or local at-rest encryption). Keep metadata hashed for tamper detection per RFC.
- Enforce policies: only reviewer role may see personally identifiable info; audit all actions.
- Rate-limit submissions (max 3 outstanding per profile) to prevent spam.

### Testing & Observability

- Feature tests for submission, upload, AI summary fallback, reviewer decision transitions.
- Queue tests for jobs + reminders.
- Metrics: SLA timers (time from submitted_at → decision), risk bucket distribution, false-positive rate.

### Open Questions

- Confirm regulator API availability for automated license lookups (placeholder adapters now?).
- Determine AI provider + budget for summaries; need fallback copy when provider fails.

---

## 3. Invite + Friend-Sync Endpoints

### Objectives & Scope (Graph Growth)

- Deliver the sharing/invite mechanics described in PRD §2.3 (*Sharing & Invitations*), enabling members to invite cohorts + sync external contacts.
- Support referrals for org pages (per `POST /org/{slug}/invite` contract) and user-level friend graph seeding.

### Data Model & Sync Stores

- Enhance `invites` table:

  - Add `sender_profile_id`, `channel` (`email`, `sms`, `deeplink`, `share_link`), `payload` (JSON storing org slug, note, referral tags), `accepted_at`, `accepted_user_id`.

- Create `contact_sync_sessions` to log OAuth provider imports (Google, Outlook). Fields: `user_id`, `provider`, `status`, `synced_contacts_count`, `error_payload`.
- `contact_sync_contacts` child table storing hashed email/phone (SHA-256 + salt) + `matched_user_id` for friend suggestions.

### API Surface

1. `POST /api/social/invites` — accepts `{ recipients: [{ email|phone }], message, org_slug?, tags?, channel }`, generates invite tokens, and dispatches notifications (email/SMS) with optional org referral metadata.

1. `POST /api/social/invites/{token}/accept` — links to signup/onboarding, marks an invite accepted, and ties it to the registering user.

1. `POST /api/social/contacts/sync` — initiates OAuth with the selected provider and returns an `auth_url` for user consent.

1. `POST /api/social/contacts/sync/{session}/callback` — handles provider callbacks, stores hashed contacts, and queues the matching job.

1. `GET /api/social/contacts/suggestions` — returns deduplicated matches plus invite status, filtered by privacy tier and persona visibility rules.

### Services & Jobs (Graph Growth)

- `InviteDispatchService` orchestrates template selection (per channel) + throttle (max 50 invites/day, 200/mo per user).
- `ContactSyncIngestJob` processes provider payloads asynchronously, dedupes, and pushes matches into `FriendSuggestion` cache.
- `FriendSyncNotifier` surfaces UI nudges when contacts join (per PRD referral tracking requirements).

### UI

- Member dashboard (`resources/views/frontend/candidate-dashboard/social/connections.blade.php`) already has invite empty state. Extend with:

  - OAuth-style modal for Google/Outlook contact sync with consent copy.
  - Invite composer (searchable multi-select, message preview) referencing personas + org slug when context is an org page.
  - Activity cards showing accepted invites + referral credit.

- Org page `Follow` CTA (`resources/views/frontend/org-pages/show.blade.php`) gets "Invite cohort" button when user has >1 persona.

### Privacy & Compliance

- Hash stored contacts; never persist raw external address book entries beyond 30 days.
- Provide opt-out for invite emails (unsubscribe link) and respect `privacy_level` (contacts marked private should not appear in suggestions unless mutual follow).
- Policies for referral incentives (avoid spam) — integrate reCAPTCHA for large invite batches.

### Analytics

- Track funnel: invites sent → delivered → accepted; contact sync completions; referral-driven follows/enquiries.
- Link to `org_followers` and `leads` for reward attribution.

### Open Items

- Need copy + legal approval for contact import consent language.
- Confirm SMS provider quota + cost before enabling phone invites at scale.

---

## 4. Privacy Tier Toggles

### Objectives & Scope (Privacy)

- Align user controls with PRD §2.3 safety callouts and internal safety presets (`Profile::applySafetyPresets`).
- Provide an explicit UI + API for toggling privacy tiers per persona, covering feed visibility, DM controls, tagging, and location.

### Data & Business Logic

- `Profile` already holds `privacy_level`, `dm_policy`, `tag_policy`, `mention_policy`, `location_visibility`, `women_safety_mode`.
- Add computed accessors: `privacy_tier_summary` (derived from the combination) and `is_max_privacy` to expose in API responses (`ProfileResource`).
- Introduce `ProfilePrivacyService` to encapsulate transitions, enforce floors (teens + safety mode), and emit `PrivacyTierChanged` events for audit.
- Persist historical changes in `profile_privacy_audits` (profile_id, previous_state, new_state, actor_id, reason, created_at) for compliance.

### API & UI Changes

- Extend `ProfileResource` with `privacy_controls` object: `{ level, dm_policy, tag_policy, mention_policy, location_visibility, effective_level, locked_fields[] }`.
- Add `PATCH /api/account/personas/{profile}/privacy` endpoint validating requested tier, applying via `ProfilePrivacyService`, and returning updated resource.
- UI: build "Privacy & Safety" panel inside persona settings modal with tier presets:

  1. `Public` (feed + DMs open).
  2. `Followers` (default for adults per safety mode?).
  3. `Trusted` (close friends only for tags, DMs limited).
  4. `Private` (no discovery; per PRD invites require approval).

- Provide contextual help text referencing women safety features (panic toggle, DM shield) and highlight when certain options are locked because of `women_safety_mode` or `age_bracket = teen`.

### Integrations

- Ensure `SocialProfileProvisioner::shouldBePrivate` honors new tiers.
- Update feed queries to respect tier-level visibility (e.g., posts from `private` personas only visible to approved followers) and surface 403 with helpful copy.
- Notification layer must drop events blocked by privacy rules.

### Testing & Monitoring

- Expand `tests/Feature/Account/PersonaControllerTest` to cover privacy updates + enforcement for teen/women-safety scenarios.
- Add policy tests ensuring `ProfilePolicy::view` respects `privacy_level` tiers.
- Instrument `privacy.tier.changed` analytics events with old/new tier, persona type, reason (user action vs. safety automation).

### Risks

- Need migration plan for existing profiles to map legacy settings into new tier presets.
- Rollout should include comms explaining defaults + additional safety context to avoid confusion.

---

## Rollout & QA Checklist

1. **Migrations** for new columns/tables (profile switch metadata, verification artifacts, invites/contact sync, privacy audits).
2. **Feature Flags**: wrap each feature so we can dark launch (e.g., `features.persona_switcher_v2`).
3. **Queue Scaling**: verification processing + contact sync require Horizon queue tuning.
4. **Telemetry**: ensure RealTimeAnalyticsEngine events exist before release so dashboards in PRD §11 can light up.
5. **Docs & Support**: update `QUICK_REFERENCE.md`, `PROPERTY_SOCIAL_IMPLEMENTATION_CHECKLIST.md`, and create help-center entries for privacy controls + verification steps.

## Open Questions for Stakeholders

1. Confirmation of regulator integrations timeline (manual vs. automated license checks at launch?).
2. Final decision on supported contact providers (Google only vs. Google + Outlook + Apple?).
3. Incentive structure for invites (badges vs. monetary referral) — impacts analytics + compliance copy.
4. Localization requirements for verification wizard and privacy copy.

Once the above questions are answered, we can split the implementation into incremental PRs aligned with the 4 scopes outlined here.
