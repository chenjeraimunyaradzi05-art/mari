# Women Real Estate API

## Authentication & Onboarding Guard

All endpoints documented here require an authenticated Sanctum token **and** a completed WomenRise real-estate onboarding snapshot. A new middleware (`EnsureRealEstateOnboarded`) now blocks every request from users whose `real_estate_onboarded_at` is still `null` and responds with HTTP 409 so clients can drive the correct CTA.

### 409 Conflict Response

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
    "message": "Complete WomenRise real estate onboarding to continue.",
    "redirect": "https://app.womenrise.com/women/real-estate/onboarding"
}
```

Client guidance:

- Treat the 409 as a soft-block rather than a hard error. Do not retry the same call until the user finishes onboarding.
- Use the `redirect` URL to deep-link into the Journey Hub (web, mobile webview, or in-app browser). For SDKs, expose the URL so host apps can decide whether to open Safari/Chrome Custom Tabs or render an embedded screen.
- Show a contextual message (for example, “Finish setting up your WomenRise property profile to continue”) and offer a button that follows the redirect link.
- Once onboarding is complete the middleware allows API traffic again—no scopes or tokens need to change.
- If you maintain offline caches, keep serving cached data but disable mutation actions until onboarding succeeds.

> ℹ️ 409s can still bubble up alongside other validation or authorization errors. Always branch on the status code first so onboarding prompts do not mask real problems (403/422/500).

The remainder of this document assumes the caller has already completed onboarding.

## Listings Index `GET /api/women/real-estate/listings`

Query Parameters:

- `per_page` (int, optional, 1-50): Pagination size. Default 15.
- `intent` (string, optional): Filter by `ListingIntent` value (`rent`, `co_living`, `sale`, `investment`, `development_partner`).
- `primary_audience` (string, optional): Filter by `ListingAudience` value (for example `women_only`, `students`).
- `published` (bool, optional): `true` returns published listings, `false` returns drafts. Omit for all.
- `owner_id` (int, moderators only): Restrict results to a specific listing owner.
- `agent_id` (int, moderators only): Restrict results to listings assigned to a specific verified agent.
- `search` (string, optional): Case-insensitive search across `title` and `summary`.
- `created_from` / `created_to` (date string, optional): Limit results to listings created within the supplied window.
- `published_from` / `published_to` (date string, optional): Limit results to listings published within the supplied window.
- `refresh_cache` (bool, optional): When `true`, recomputes the metrics payload and refreshes the cache for the provided filter set.
- `include_agent_details` (bool, optional): Default `true`. Set to `false` to omit the nested `agent` metadata within each `by_agent` bucket for lighter responses.

Behaviour:

- Non-moderators automatically see only their own listings regardless of filter values.
- Moderators (`Super Admin`, `Admin`, `Moderator`) can combine `owner_id`, `agent_id`, and the standard filters.

## Listings Metrics `GET /api/women/real-estate/listings/metrics`

Accepts the same query parameters as the listings index, minus pagination. Returns aggregate counts for the filtered dataset:

- `total`: Total listings after filters are applied.
- `published`: Count of listings with a non-null `published_at`.
- `draft`: Listings still in draft (`total - published`).
- `verified`: Listings flagged as verified for the filtered scope.
- `unverified`: Listings still pending verification (`total - verified`).
- `by_intent`: Object keyed by `ListingIntent` values. Each entry includes `total`, `published`, `draft`, `verified`, and `unverified` counts.
- `by_primary_audience`: Object keyed by `ListingAudience` values. Structure matches `by_intent`.
- `by_agent`: Object keyed by the agent id (or `unassigned`). Each entry contains `agent` metadata (`id`, `user_id`, `status`, `verified_at`, and optional `user` summary) plus `total`, `published`, `draft`, `verified`, and `unverified` counts.
- All rollups are sorted in descending order of `total` so the busiest segments appear first in the payload.
- `_cache`: Metadata describing cache usage (`hit`, `refreshed`, `cached_at`, `expires_at`, `ttl`, a `key` identifying the cache entry, and `duration_ms` measuring how long the metrics computation took when cached).

Set `include_agent_details=false` when you only need rollups; each agent bucket will still include counts but the `agent` field will be `null`, keeping payloads lean for dashboards.

Responses are cached per filter set for up to 60 seconds (`WOMEN_LISTING_METRICS_CACHE_TTL`) to keep dashboards responsive. Pass `0` to disable caching when troubleshooting. Cache entries automatically clear whenever a listing is created, updated, restored, or deleted so analytics never serve stale totals. Send `refresh_cache=true` on the metrics endpoint to bypass and refresh a single cache entry, or run `php artisan women:listings:metrics-clear` to flush everything. Each cache key encodes the `include_agent_details` preference so lightweight and detailed payloads are stored separately.

Role behaviour mirrors the index endpoint—non-moderators only see their own listings while moderators can scope by `owner_id`/`agent_id`.

## Listing Detail `GET /api/women/real-estate/listings/{listing}`

Returns the listing resource with related agent, category, location, and audience pivots. Authorization enforces `WomenListingPolicy@view`.

## Create Listing `POST /api/women/real-estate/listings`

Accepts the payload defined in `WomenListingStoreRequest`. Creates the listing for the authenticated owner and hydrates audience pivots.

## Update Listing `PUT|PATCH /api/women/real-estate/listings/{listing}`

Accepts partial payload matching `WomenListingUpdateRequest`. Syncs audience pivots after save. Authorization uses `WomenListingPolicy@update`.

## Publish Listing `POST /api/women/real-estate/listings/{listing}/publish`

Body Parameters:

- `published_at` (ISO-8601 datetime, optional): Explicit publish timestamp. Defaults to now when omitted.

Rules:

- Requires `WomenListingPolicy@publish` (owner or moderator plus verified agent).
- Observer ensures verified agent gating remains enforced.

## Unpublish Listing `DELETE /api/women/real-estate/listings/{listing}/publish`

Clears `published_at` after the same `publish` authorization check.

Both publish endpoints return the refreshed `WomenListingResource` payload so clients can update state immediately.
