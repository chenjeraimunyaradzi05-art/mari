# How an /api request actually reaches the backend

**Written 2026-08-24 after a production-only bug. Read before adding anything
under `client/src/app/api/`.**

The client's axios instance uses `baseURL = '/api'`, so every call goes to the
**Next.js origin**, not to the API host. What forwards it to the backend differs
between local development and production, and that difference has already
shipped one class of bug.

## The two paths

| | Local dev | Netlify (production) |
|---|---|---|
| `/api/auth/*` | `app/api/auth/*` route handlers | `app/api/auth/*` route handlers |
| `/api/*` | `src/middleware.ts` rewrite → backend | `app/api/[...path]` catch-all → backend |
| `/uploads/*` | `next.config.js` rewrite → backend | `app/uploads/[...path]` → backend |

Locally, `middleware.ts` rewrites everything under `/api` **except**
`/api/auth/*` straight to `NEXT_PUBLIC_API_URL`. The route handlers are never
reached.

On Netlify, both `middleware.ts` and `next.config.js` deliberately skip their
rewrites (`if (process.env.NETLIFY) return []`). Nothing in `netlify.toml` or
`public/_redirects` proxies `/api/*` either — a rule in those files cannot read
an environment variable, so proxying from there would mean hardcoding the
API host in two more places. The route handlers do the work instead.

**So the route handlers are dead code locally and load-bearing in production.**
That asymmetry is the whole hazard.

## Why `/api/auth/*` is special

Auth responses carry `Set-Cookie` (the HttpOnly refresh token).
`NextResponse.rewrite()` to an external URL on Netlify Edge does not reliably
forward it, so auth cannot use the rewrite path. Those handlers proxy manually
and call `forwardSetCookieHeaders`, and they add
`rejectUntrustedSameOriginRequest` — a CSRF guard the generic catch-all has no
equivalent for. They are not redundant; do not fold them into the catch-all.

`app/api/health/route.ts` is also deliberate: it maps `/api/health` to the
backend's `/health`, which is mounted outside `/api`.

## The trap: a partial handler returns 405 in production only

Next's App Router matches the most specific route, and a route handler that does
not export a verb answers **405** for it. It does not fall through to
`[...path]`.

That produced this bug: `app/api/channels/[id]/route.ts` exported `GET` only, so
`PATCH /api/channels/:id` and `DELETE /api/channels/:id` returned 405 in
production and never reached the backend — while working perfectly in local dev,
where the middleware bypassed the handler entirely. The same applied to
`POST /api/mentors/me` and `POST /api/jobs`.

Twenty-three such handlers existed. Every one was a byte-for-byte pass-through
to the identical backend path, so all of them were deleted in favour of the
catch-all, which forwards any method with its query, headers and body.

Confirm the mechanism yourself:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/auth/me
```

`app/api/auth/me/route.ts` exports `GET` only, and `/api/auth/*` is not
rewritten locally, so this prints `405` — the same failure the deleted handlers
caused in production.

## Rules

1. **Do not add a per-resource handler under `app/api/`** to proxy a backend
   route. `[...path]` already does it for every verb. A new handler can only
   narrow what works.
2. Add one only for behaviour the catch-all cannot express — a different
   upstream path (`health`), or response handling it cannot do (`auth`). Say
   which in a comment at the top of the file.
3. If you do add one, **export every verb that path accepts**, or you have
   built a production-only 405.
4. Testing production routing locally means setting `NETLIFY=1`, which turns
   both rewrites off and puts the route handlers in charge.

## Related

- `athena-platform/server/scripts/check-api-contract.js` — CI check that every
  client call resolves to a real route. It reads both the axios calls and the
  `fetch` calls in these handlers, so a broken proxy path fails the build.
- [CLIENT-API-SURFACE-GAPS.md](../api/CLIENT-API-SURFACE-GAPS.md)
