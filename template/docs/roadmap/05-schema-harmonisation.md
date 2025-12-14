# Schema Harmonisation Sprint (5-10%)

## Scope

- Align database primitives for **social profiles, posts, media, follows, likes, comments** with the Phase 1 spec in `exported-assets/migration-1-profiles.md`.
- Validate **organization, course, intake, apprenticeship, lead, advertising** tables against `moneyman-laravel-stubs` migrations.
- Flag legacy or duplicated tables for retirement before we ship Phase 2 models.

## Reference Inputs

- `exported-assets/migration-1-profiles.md`
- `database/migrations/2025_10_29_001000_create_social_posts_table.php`
- `database/migrations/2025_11_04_000001_create_social_profiles_table.php`
- `database/migrations/2025_10_30_000001_create_organization_pages_table.php` → `2025_10_30_000012_create_ad_metrics_daily_table.php`
- PRD anchors: `moneyman-v3.0-COMPLETE.md` Pillar 1 & 2 summaries

## Audit Findings

### 1. Social Profile Graph

| Spec (`social_profiles`) | Current (`social_profiles`, `social_posts`, etc.) | Gaps |
| --- | --- | --- |
| Polymorphic ownership via `profileable` (candidate, company, org) | Hard link to `users` and optional `candidate_id`; no organisation support | Missing org/gov/education linkage; no soft deletes; no username/handle uniqueness |
| Fields: `username`, `display_name`, `bio`, `avatar`, `cover_photo`, `social_links`, counts | Existing columns are generic (trust_score, engagement_score) with `handle` nullable and no `display_name` | Need to add identity fields, privacy flags, social counts, verification columns |
| Soft deletes required | Not enabled | Introduce soft deletes to support takedowns |

#### Action Items — Social Profiles

- Draft migration to reshape `social_profiles` (add polymorphic columns, rename `handle` → `username`, add `display_name`, add `profile_type`, etc.).
- Introduce computed counters (`followers_count`, `following_count`, `posts_count`).
- Add soft deletes and fulltext index on `username`, `display_name`, `bio` (MySQL).

### 2. Social Posts & Media

| Spec | Current | Gaps |
| --- | --- | --- |
| `social_posts` references `social_profile_id`, enumerated `post_type`, JSON `media`, AI fields, visibility | Current table uses `postable` morph + `user_id`, `type`, `meta`, `moderation_status`; lacks counts and AI columns | Need `social_profile_id`, `post_type`, stats columns, AI fields, story expiry |
| `social_media` table for structured media rows | Present as `social_post_media` with minimal columns (`path`, `meta`, `position`) | Add media metadata (mime, size, dimensions, duration, thumbnails) |
| `social_likes`, `social_comments` tables keyed to profiles | Present as `social_post_reactions` (user-based), `social_post_comments` (user-based) | Align to `social_profile_id` ownership, add likes/replies counts, sentiment data |

#### Action Items — Social Posts & Media

- Plan migration sequence: introduce new columns on existing tables, backfill from current data, then drop legacy `postable`/`user_id` fields once services migrate.
- Standardise naming: rename `social_post_media` → `social_media`, `social_post_reactions` → `social_likes`, `social_post_comments` → `social_comments` (with views/aliases for transition).
- Add story/reel support: `post_type`, `expires_at`, `ai_engagement_score`, `ai_tags`.

### 3. Follow Graph

| Spec (`social_follows`) | Current | Gaps |
| --- | --- | --- |
| `follower_id`, `following_id` (both social profiles) + flags | Current table links `follower_id` to `users` and uses `followable` morph | Rebuild to operate exclusively on `social_profiles` with `is_close_friend`, `notifications_enabled` |

#### Action Items — Follow Graph

- Create new `social_follows` table with profile-to-profile relationship; maintain legacy table during migration, then drop.
- Define migration/backfill plan once `social_profiles` polymorphic is live.

### 4. Legacy Redundancy Snapshot

- Duplicate/obsolete migrations present (`posts`, multiple `groups`, legacy `post_comments`). Confirm active tables before deleting migrations or dropping DB tables.
- `post_likes`, `connections`, `notifications` appear multiple times with different schemas — need clean-up strategy to avoid conflicts when running fresh migrations.
- Recommend creating a `legacy_tables.md` inventory before removal.

### 5. Organization & Ads Tables

- Organization, course, intake, apprenticeships, ad campaign tables match stubs broadly; extras (safety scores, metadata) are additive.
- Minor follow-ups:
  - Ensure indexes align with high-read endpoints (`organization_pages.slug`, `courses.slug`, `leads.status`).
  - Confirm `course_intakes` includes `status`, `apply_by`, `scholarships` as JSON (present ✓).
  - Verify advertising tables `ad_metrics_daily` and `advertising_*` do not conflict; decide on canonical set in Phase 3.

## Recommended Work Breakdown

1. **Schema Design Review (In progress)**
   - Produce ERD diff (draw.io or dbdiagram) comparing spec vs current.
   - Agree on polymorphic approach and naming conventions across engineering & product.
2. **Migration Drafting (Pending)**
   - Author migration stubs for social profile realignment and new follow/like/comment tables.
   - Write data backfill strategy docs (seed scripts or one-off commands).
3. **Legacy Inventory (Pending)**
   - Run DB inspection (`SHOW TABLES`) on staging/prod to list orphaned tables.
   - Create `docs/roadmap/legacy-tables.md` with drop candidates and retention rationale.
4. **Review & Sign-off (Pending)**
   - Schedule review with product/engineering leads to lock schema and migration order.

## Blockers

- Need clarity on existing production data volume to estimate migration downtime.
- Confirm whether polymorphic profiles should extend to `organization_pages` or remain user-centric.
- Decide retention policy for legacy `posts` vs new `social_posts` — determines migration order.

## Next Steps

- Approve the above action list.
- Begin drafting the social profile harmonisation migration (target `database/migrations/2025_11_10_000001_update_social_profiles_table.php`).
- Prepare safeguard tests (Laravel feature tests) to ensure feed endpoints operate with new schema.
