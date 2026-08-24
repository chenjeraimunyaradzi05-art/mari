# Client/server API contract

**Status as of 2026-08-24: no gaps. Enforced in CI.**

This document used to list 42 client API methods that were defined, exported and
type-safe but returned 404 because the route had never been built. All of them
have since been implemented or repointed, and the audit that produced the list
is now a committed check that runs on every build.

```bash
npm --prefix athena-platform/server run check:api-contract
```

It walks the mount table in `server/src/index.ts`, joins it to the
`router.<verb>()` declarations in each route file, and matches that against
every `api.<verb>()` and `fetch()` call under `client/src` the way Express
actually resolves. It fails the build on three classes:

| | Meaning | Fix |
|---|---|---|
| `MISSING` | No route matches at all | Build the route, or point the client at one that exists |
| `SHADOWED` | Only a `:param` route matches a literal path | Move the literal route **above** the `/:id` one |
| `WRONG_VERB` | Path exists, not for that method | Correct one side |

`--unreachable` reports the reverse — server routes no client call reaches.
That one is a report, never a failure: a webhook or an operator endpoint is
supposed to be unreachable from the app.

Known-good exceptions live in an `ALLOWED` map in the script, each with a
reason. The check also fails on a *stale* allowance, so an exception cannot
outlive the call it was written for.

## Traps this codebase has actually hit

Kept because each one cost real debugging time.

### Route ordering

Express matches in declaration order, so a literal path declared after a
parameterised one is unreachable. `router.get('/:id')` appears early in
`video.routes.ts`, `channel.routes.ts` and `skills-marketplace.routes.ts`;
`/trending`, `/bookmarked`, `/discover`, `/unread`, `/services/me` and
`/orders/received` all have to sit above it. They 404 as "not found" rather
than failing loudly, which is what makes this expensive to spot.
`/featured` in `apprenticeship.routes.ts` is the pattern to copy.

The `SHADOWED` class above exists specifically to catch this.

### Two order models coexist in the marketplace

`ServiceBooking` buys a block of the provider's time (`scheduledAt`,
`durationMinutes`, hourly rate). `ServiceOrder` buys a fixed-scope package
(`packageIndex`, delivery deadline). They are separate tables with separate
lifecycles — check which one a route means before touching it.

`ServiceReview.bookingId` is the generic "what is this review attached to" slot
and holds a **`ServiceOrder` id** for order reviews. There is no `orderId`
column; the `(serviceId, clientId, bookingId)` unique constraint is what makes
a review one-per-order.

### Video has no category column

`type` is a `VideoType` enum and `hashtags` is the free-form topic field.
`GET /video/category/:x` filters on `type` when `x` names a VideoType and falls
back to a hashtag otherwise.

### Reports go through one pipeline

Reporting anything posts to `POST /api/safety/reports`, which handles trust
scoring and the moderation queue. Do not add per-module report endpoints.

### The completion record is not a qualification

`GET /api/apprenticeships/:id/certificate` returns an ATHENA record of
completion, not a nationally recognised AQF qualification — only an RTO awards
those. It carries a `statement` field saying so. Keep it.

## The request path is not obvious

Every client call goes to the Next.js origin (`baseURL = '/api'`), and what
forwards it to the backend differs between local dev and production. Adding a
route handler under `client/src/app/api/` can silently break production while
working locally. Read
[../runbooks/API-REQUEST-PATH.md](../runbooks/API-REQUEST-PATH.md) first.
