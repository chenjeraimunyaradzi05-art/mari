# Global Gap Backlog Implementation Plan

Updated: 2025-11-19

## 1. Objectives

1. Close remaining **Global Gap** scope for interactive social formats (polls, live streaming), saved collections, and block lists by extending the `social_posts` contract and wiring each surface into the existing AI moderation workflow documented in `exported-assets/ai-services-5-features.md`.
2. Land messaging, community, and commerce primitives that reuse polymorphic bindings + the prioritized queue strategy from `RUNBOOK_SOCIAL_FEED.md` so downstream squads can attach automation without reinventing transport.
3. Ship dedicated Livewire admin consoles for **Trust & Safety**, **Verification**, **Ad Review**, and **Revenue Ops** (analytics + payouts) so operations teams can triage incidents without touching generic dashboards.
4. Add warehouse export + creator payout jobs that run on `queue:work-prioritized` to keep analytics fresh while protecting the interactive queues.

## 2. Data Model Additions

| Area | Tables / Changes | Notes |
| --- | --- | --- |
| Social posts | Extend `social_posts.post_type` enum with `poll`, `live_stream`, `commerce_drop`, `community_alert`, `ai_digest`. Add `content_format`, `stream_context`, `ai_moderation_meta` JSON columns for richer classification. | Keeps For You / Following logic untouched while allowing new layouts downstream. |
| Polls | `social_post_polls`, `social_post_poll_options`, `social_post_poll_votes` | `social_post_polls` stores question + closing time + AI moderation snapshot. Options table enforces ordering, votes table uses `(poll_option_id, voter_id)` unique index and AI trust score for anomaly detection. |
| Live streaming | `social_live_streams`, `social_live_stream_metrics`, `social_live_stream_gifts` | Sessions reference `social_post_id` + `community_group_id`. Metrics table ingests periodic stats, `gifts` table captures commerce hooks for tipping / sponsorship. |
| Saves | `social_post_collections`, `social_post_collection_items` | Users can group saves into named collections (e.g., “Interview Prep”). Items reuse existing `social_post_saves` data to avoid duplication. |
| Block lists | `social_block_lists`, `social_block_list_entries` | Admin and profile level block catalogs (muted keywords, org-level suppressions). Entries reference `blockable_type` (profile, org, keyword). |
| Messaging ⇄ Commerce bridge | `social_thread_bindings` | Polymorphic pivot between `social_threads` and `bindable` records (commerce orders, live streams, community events). Surfaces conversation context in one query. |
| Commerce scaffolding | `commerce_channels`, `commerce_collections`, `commerce_products`, `commerce_product_variants`, `commerce_orders`, `commerce_order_items`, `commerce_order_events`, `commerce_payout_batches` | Minimal SKU + order stack scoped to social sellers. Orders capture `source_social_post_id` to close attribution; events feed warehouse + payouts. |

## 3. Service + Queue Integrations

- **AI moderation**: New poll/live-stream creation flows call `AIContentService::moderateContent` to hydrate `ai_moderation_meta`. Fallback to safe defaults when AI disabled.
- **Jobs**:
  - `StreamEngagementIngestJob` (queue: `social-feed`) ingests live metrics into `social_live_stream_metrics`.
  - `WarehouseAnalyticsExportJob` (queue: `analytics`) batches `analytics_events` + commerce snapshots into S3 / warehouse every 15 minutes.
  - `DisburseCreatorPayoutsJob` (queue: `revenue`) aggregates `creator_payouts` + `commerce_payout_batches` nightly.
- **Schedulers**: Register the two warehouse/payout jobs via `app/Console/Kernel.php` using `queue:work-prioritized` friendly queues per runbook guidance.

## 4. Livewire Admin Surfaces

| View | Purpose |
| --- | --- |
| `resources/views/livewire/admin/trust-safety-dashboard.blade.php` | Unified moderation queue (reports, block lists, poll/live stream flags). Shows queue health + shortcuts to enforcement actions. |
| `resources/views/livewire/admin/verification-hub.blade.php` | Social + org verification triage with status filters + reviewer assignments. |
| `resources/views/livewire/admin/ad-review-console.blade.php` | Tracks sponsored posts, ad creatives, AI risk scores, and queue backlogs. |
| `resources/views/livewire/admin/revenue-ops-center.blade.php` | Analytics + payout KPIs, job run statuses, export history. |

Each view will ship with placeholders + Livewire-friendly markup (cards, tables, queue badges) so engineering + ops can hook in real data incrementally.

## 5. Implementation Sequence

1. **Schema**: introduce enum + table migrations in `2025_11_19_232000_create_commerce_structures_and_thread_bindings.php` plus dedicated poll/live-stream migrations. Keep operations idempotent via `Schema::hasTable/column` guards.
2. **Models**: create Eloquent models (`SocialPostPoll`, `SocialPostPollOption`, `SocialPostPollVote`, `SocialLiveStream`, `SocialLiveStreamMetric`, `SocialLiveStreamGift`, `SocialPostCollection`, `SocialPostCollectionItem`, `SocialBlockList`, `SocialBlockListEntry`, `SocialThreadBinding`, `Commerce*` models) with casts + relationships back to `SocialPost`, `SocialProfile`, and `SocialThread`.
3. **Services**: extend AI moderation + feed services to understand new `post_type` values without breaking existing scopes.
4. **Jobs + Scheduling**: add ingestion/export/payout jobs and register them inside the console kernel to ensure the prioritized worker picks them up.
5. **Livewire Views**: drop new admin dashboard stubs with components + queue health badges.
6. **Docs + Tests**: update this plan status, `RUNBOOK_SOCIAL_FEED.md` appendices (queue + admin references), and add feature tests for poll voting + live stream model relationships.

## 6. Risk / Mitigation

- **Enum drift**: guard migrations with `Schema::getColumnType` checks + raw SQL `MODIFY COLUMN` statements only when needed.
- **Queue starvation**: new jobs default to `analytics` / `revenue` queues so `social-feed` stays clear; schedule windows keep concurrency predictable.
- **AI outages**: `AIContentService` already has safe defaults; new models store `ai_moderation_meta['status'] = 'fallback'` so ops know when a human pass is required.
- **Warehouse lag**: export job slices payloads by `limit` + `after_id` to avoid locking the `analytics_events` table.

This plan keeps the backlog aligned with `moneyman-v3.0-COMPLETE.md` pillars while leveraging the infrastructure already present in the repo.
