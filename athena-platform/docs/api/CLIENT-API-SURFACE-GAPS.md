# Client API surface gaps

Generated 2026-08-23 by cross-checking every `api.get/post/patch/delete` call in
`client/src/lib/api.ts` and `client/src/lib/api-extensions.ts` against every
`router.<method>` declaration in `server/src/routes/*.ts`, resolved through the
mount prefixes in `server/src/index.ts`.

**Read this before assuming a method on `apiExtensions` works.** The client API
modules are a superset of what the server implements. The methods below are
defined, exported, and type-safe — and will return **404** if you call them.

## Status

| | Count |
|---|---|
| Client API calls | 323 |
| Server routes | 564 |
| Calls with no matching route | 42 |
| …of those, called from UI code | 1 |
| …of those, never called (listed below) | 41 |

The single remaining UI-reachable one is `mentorApi.become` → `POST /api/mentors/become`.
Its only reference is `useBecomeMentor` in `client/src/lib/hooks.ts`, and no page uses
that hook, so nothing user-facing hits it today. The nearest real routes are
`POST /api/mentors/me` (create/update a mentor profile) and `POST /api/mentors/enable`.

## Unimplemented methods, by module

### `mentorApi`
- `updateProfile` → `PATCH /api/mentors/me` — the server implements **`POST`** `/me`, not `PATCH`.

### `videoApi`
- `report` → `POST /api/video/:id/report`
- `getTrending` → `GET /api/video/trending`
- `getByCategory` → `GET /api/video/category/:category`
- `getUserVideos` → `GET /api/video/user/:userId`
- `getBookmarked` → `GET /api/video/bookmarked`
- `delete` → `DELETE /api/video/:id`

> **Route-ordering trap.** `video.routes.ts` declares `router.get('/:id')` early.
> If `/trending` or `/bookmarked` are added *after* it they will never match —
> Express will bind them to `/:id` and they will 404 as "video not found".
> Declare them **before** `/:id`, the way `/featured` is declared before `/:id`
> in `apprenticeship.routes.ts`.
>
> Trending is already served without these: `GET /api/video/feed?feed=trending`.

### `channelApi`
- `delete` → `DELETE /api/channels/:id`
- `getMembers` / `addMember` / `removeMember` → `/api/channels/:id/members`
- `leave` → `POST /api/channels/:id/leave` — the server implements **`DELETE`** `/:id/leave`.
- `markRead` → `POST /api/channels/:id/read`
- `searchMessages` → `GET /api/channels/:id/search`
- `getPinnedMessages` → `GET /api/channels/:id/pinned`
- `getUnreadCounts` → `GET /api/channels/unread`
- `startTyping` → `POST /api/channels/:id/typing`
- `discover` → `GET /api/channels/discover`

> `/unread` and `/discover` sit behind `router.get('/:id')` — same ordering trap as above.

### `apprenticeshipApi`
- `getApplicationStatus` → `GET /api/apprenticeships/applications/:id`
- `withdrawApplication` → `DELETE /api/apprenticeships/applications/:id`
- `getRecommended` → `GET /api/apprenticeships/recommended`
- `getCategories` → `GET /api/apprenticeships/categories`
- `getProgress` → `GET /api/apprenticeships/:id/progress`
- `submitMilestone` → `POST /api/apprenticeships/:apprenticeshipId/milestones/:milestoneId/submit`
- `getCertificate` → `GET /api/apprenticeships/:id/certificate`

> There is no milestone or certificate model in `schema.prisma`; those two need a
> migration before a route can be written.

### `skillsMarketplaceApi`
- `deleteService` → `DELETE /api/skills-marketplace/services/:id`
- `getMyServices` → `GET /api/skills-marketplace/services/me`
- `getSellerProfile` → `GET /api/skills-marketplace/sellers/:userId`
- `getCategories` → `GET /api/skills-marketplace/categories`
- `getReceivedOrders` → `GET /api/skills-marketplace/orders/received`
- `getOrder` → `GET /api/skills-marketplace/orders/:id`
- `acceptOrder` / `deliverOrder` / `requestRevision` / `completeOrder` / `cancelOrder`
  → `POST /api/skills-marketplace/orders/:id/<action>`
- `leaveReview` → `POST /api/skills-marketplace/orders/:orderId/review` — the server
  implements reviews against the **service** (`POST /services/:id/reviews`), not the order.
- `getServiceReviews` → `GET /api/skills-marketplace/services/:serviceId/reviews` —
  the server implements **`POST`** at that path, not `GET`.
- `sendCustomRequest` / `getCustomRequests` / `submitProposal` — no custom-request
  model exists in `schema.prisma`.

> **Two order models coexist.** `ServiceBooking` buys a block of the provider's
> time (`scheduledAt`, `durationMinutes`, hourly rate). `ServiceOrder` buys a
> fixed-scope package (`packageIndex`, delivery deadline). The order lifecycle
> methods above target `ServiceOrder`; `POST /services/:id/order` and
> `GET /orders/me` are implemented, the rest of the lifecycle is not.

## Reproducing this audit

The checker is not committed. It resolves mount prefixes from `index.ts`, collects
`router.<method>('<path>')` per routes file, normalises `${param}` and `:param` to a
common placeholder, and diffs against the client call sites — then greps
`src/app` and `src/components` to separate UI-reachable calls from dead exports.
Re-run it after adding routes to confirm the count drops.
