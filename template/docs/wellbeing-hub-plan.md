# Wellbeing & Vipassana Hub Design

## Goals

- Give every member a calm wellness space that mirrors the intents described in the Problem Map and Critical Problems research.
- Cover the three user-facing pillars requested by stakeholders:
  - Events calendar that highlights women-first runs, yoga, strength, meditation, and Vipassana-friendly retreats.
  - Partner banners for aligned brands (eg. Nike, Asics, wellness studios) with discount codes and eligibility notes.
  - Bite-sized health blog cards that reinforce evidence-based, non-medical education around mind/body topics.
- Tie the experience into the existing `users.interests` array so recommendations feel personal and so the broader dashboard can surface the hub only when relevant.

## Domain Objects

| Object | Purpose | Key Fields |
| --- | --- | --- |
| `WellbeingProfile` | Stores each member's preferences, constraints, and tone requests. | `movement_level`, `pref_*` booleans, `goals`, `constraints`, `health_topics`, `availability`, `energy_pattern` |
| `WellbeingEvent` | Canonical events/classes/runs across Australia that can be filtered by type + region. | `title`, `type`, `mode`, `starts_at`, `location_region`, `summary`, `intensity`, `women_only`, `interest_tags[]` |
| `WellbeingPartnerOffer` | Partner discount banners with CTA + guardrails. | `brand`, `headline`, `description`, `cta_label`, `cta_url`, `discount_code`, `interest_tags[]`, `valid_until`, `priority` |

Blog cards will be served from a curated config file so that content updates do not require schema changes.

## API Contract

| Endpoint | Method | Notes |
| --- | --- | --- |
| `/api/wellbeing/profile` | `GET` | Returns the authenticated user's stored profile (or null) plus derived `interest_tags`. |
| `/api/wellbeing/profile` | `POST` | Validates payload, upserts profile, syncs the parent `users.interests` array. |
| `/api/wellbeing/events` | `GET` | Supports `type`, `mode`, `region`, `after`, `limit`, `interest`. Defaults to the member's interest tags when not specified. |
| `/api/wellbeing/offers` | `GET` | Optional `interest` filter; automatically prioritises tags that match the member profile. |
| `/api/wellbeing/articles` | `GET` | Returns static cards from `config/wellbeing.php`, filtered against the member interest tags. |

All endpoints live inside the existing Sanctum-protected API group.

## Front-End Experience

- Blade mount at `/wellbeing` with `#wellbeing-dashboard-root` data attributes (`user`, `interests`).
- Vue single-file component (`resources/js/components/wellbeing/WellbeingDashboard.vue`) renders:
  - Profile editor chips + save CTA.
  - Events calendar list grouped by date with quick "Ask Athena" prompts prefilled with profile context.
  - Partner banners carousel (auto-filters based on preferences).
  - Health blog card grid sourced from config.
- Component uses Axios with the existing CSRF setup.
- App bootstrap updates `resources/js/app.js` to mount the new component when the root div is present.

## Member Interest Sync

- When a profile is saved, collect tags like `wellness`, `wellness:yoga`, `wellness:vipassana`, etc.
- Merge them into `user.interests` without dropping unrelated interests.
- Provide helper on `WellbeingProfile` to expose `preferredTags(): array` so controllers and Vue can reuse the logic.

## Safety & Tone

- Reuse the AI concierge infrastructure with a new `wellbeing_fitness_system_prompt` in `config/athena_ai.php` so every AI interaction repeats the trauma-aware guardrails described in the research docs.
- Add disclaimers to the UI (education-only, not medical advice) and ensure CTA buttons open partner sites in new tabs.

## Testing

- Feature test for profile upsert and interest sync.
- Feature test for events endpoint filtering by type + interest tags.
- Feature test for offers endpoint returning prioritised banners.

This plan keeps the implementation grounded in the documents you asked us to read while shipping the concrete hub experience in the current codebase.

## Admin Content Operations

### Option A – Native Admin CRUD (recommended short-term)

1. **Controllers & Routes**: Add `Admin\WellbeingEventController` and `Admin\WellbeingPartnerOfferController` alongside existing admin controllers so the current middleware, layouts, and permission gates continue to apply.
2. **Policies & Roles**: Gate both resources behind `permission:manage wellbeing hub` (spatie/laravel-permission) and seed that permission for Ops/Admin roles.
3. **Form Requests**: Create `Store/UpdateWellbeingEventRequest` + `Store/UpdateWellbeingPartnerOfferRequest` to enforce tag arrays, date windows, CTA URLs, and women-only flags.
4. **Blade Views**: Follow the existing admin design system (tables + slide-over create/edit forms) including preview chips for `interest_tags`, `valid_until`, priority ordering, and feature toggles.
5. **List Features**: Provide filters for type, region, and published status; include bulk enable/disable actions so Ops can hide items without deleting rows.
6. **Audit Hooks**: Emit `WellbeingEventUpdated`/`WellbeingPartnerOfferUpdated` events so the AI concierge cache + frontend stale data can be invalidated via broadcasting/job dispatch.

### Option B – Laravel Nova (long-term scalability)

1. Acquire/validate Nova license and add `laravel/nova` to `composer.json` (private repo) with the existing app namespace.
2. Scaffold `WellbeingEvent` and `WellbeingPartnerOffer` resources with lenses for "Upcoming Women-Only" and "Expiring Offers" to match Ops workflows.
3. Use `NovaJson` fields for `interest_tags` and `Flexible`/`KeyValue` fields for metadata; include `BelongsTo` to the user who created the record for accountability.
4. Register custom actions for "Duplicate Event" and "Publish/Unpublish" so Ops can reuse templates quickly.
5. Wire Nova policies to the same `manage wellbeing hub` permission so rollout is consistent across admin surfaces.

> Decision trigger: default to Option A now (zero licensing friction, mirrors current admin UX). Revisit Nova if we need multi-team moderation, per-field metrics, or inline analytics later.

## Post-Adoption Enhancements

These items unlock only after the wellbeing hub operates for at least one full sprint with ≥60% of targeted members opening it (same adoption gating mentioned in stakeholder notes).

1. **AI History Drawer (per athena-comprehensive-plan.md)**

- Extend the existing Athena concierge store to persist the last 5 context payloads (`context_payload`, `prompt_seed`, `selection_snapshot`).
- Add `/api/v1/ai-context/history` endpoints for fetching/restoring history, backed by a lightweight table (e.g., `ai_context_histories`).
- Update the bank inbox Vue screen with a drawer component so users can reopen AI guidance without re-selecting transactions.
- Include wellbeing hub context types so cross-domain AI sessions show up in the same drawer once enabled.

1. **CSV Import Improvements**

- Expand the current `maatwebsite/excel` import job to support additional schemas (ANZ, Westpac, Wise) using strategy classes per format.
- Add column mapping UI so Ops can save presets, then persist them in `csv_import_mappings` for reuse.
- Hook imports into the wellbeing events/offers admin so Ops can upload batches (e.g., seasonal retreat CSV) after validation.
- Document reconciliation flow (diff preview, duplicate skipping, audit trail) before enabling for non-admin roles.

Both tracks require analytics from the first release (profile saves, event/offer clicks, AI concierge launches). Capture those metrics via the existing telemetry service so Product can sign off before we commit to the larger build.

### Telemetry & Adoption Gate

- `WellbeingTelemetryService` records hub visits, profile saves, RSVP clicks, offer engagements, and AI concierge opens to `analytics_events` with user_id metadata.
- `/api/v1/wellbeing/telemetry/adoption` returns the 30-day snapshot (targeted members vs. unique visitors) so Ops can confirm when ≥60% adoption is met.
- Vue dashboard pings `/api/v1/wellbeing/telemetry` for RSVP, offer, and “Ask Athena” events; backend controllers handle page views and profile saves automatically.
- Targeted cohort definition: users with `interests` containing `wellness` plus anyone with a `wellbeing_profiles` record (service deduplicates IDs).

## Post-Adoption Story Backlog (unlock once ≥60% adoption)

1. **WBH-201 – AI History Persistence Layer**

- Migration for `ai_context_histories` with `user_id`, `context`, `prompt`, `source`, and retention policy.
- Repository/service to save and prune entries when AI concierge posts payloads.

1. **WBH-202 – AI History API + Drawer UI**

- `/api/v1/bank-transactions/ai-contexts` enhancements for pagination + delete.
- Vue drawer component in the bank inbox referencing telemetry events; includes cross-domain contexts (bank + wellbeing hub).

1. **WBH-301 – CSV Import Strategy Extensions**

- Strategy classes per bank format (ANZ, Westpac, Wise) plugged into the existing `maatwebsite/excel` pipeline.
- Preset mapping UI stored in `csv_import_mappings` so Ops can reapply column mappings.

1. **WBH-302 – Wellness Batch Import Admin Flow**

- Admin upload form for events/offers CSVs with validation preview, duplicate detection, and telemetry hooks for auditing.
- Background job to insert/update `wellbeing_events` and `wellbeing_partner_offers` from validated rows.
