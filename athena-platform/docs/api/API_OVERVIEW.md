# API Overview

**Base URL:** the API host's public URL — `NEXT_PUBLIC_API_URL` on the web tier, written as `https://api.your-domain.com` below  
**Stack:** Express + TypeScript + Prisma ORM + PostgreSQL  
**Auth:** JWT Bearer tokens (access) + HttpOnly cookies (refresh)

---

## Authentication

All protected endpoints require: `Authorization: Bearer <accessToken>`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | None | Create account. Opens no session: the answer is the same `201 { verificationRequired: true }` for a new address and a taken one, with no token and no cookie, and the link that finishes sign-up is in an email. Sign-in is refused (`403`) until it is followed |
| `/api/auth/login` | POST | None | Login (returns accessToken + sets refreshToken cookie; a native app gets the refreshToken in the body instead). An account with two-factor on is answered `401 Two-factor code required` until `twoFactorCode` is sent: an authenticator code, or one unused recovery code (spent by use) |
| `/api/auth/google`, `/api/auth/facebook` | POST | None | Sign in or sign up with the provider's credential. For an account with two-factor on, send the same credential again with `twoFactorCode` (same answers and the same lockout as login); a sign-up carries no code |
| `/api/auth/2fa/status`, `/2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/recovery-codes` | GET, POST | Bearer | Turn two-factor on and off and re-issue the ten recovery codes. `enable` needs the password (when the account has one) and the code from the authenticator just set up, and returns the ten codes in the clear once. `disable` and `recovery-codes` need the password (when the account has one) and a live code or an unused recovery code. A wrong password or code on any of these, on `POST /api/auth/change-password`, and on `DELETE /api/users/me` and `POST /api/gdpr/dsar/delete`, is answered `403` (a wrong code `400`), never `401`, so a client does not refresh the session and send the same wrong answer again. The credential checks (change password, enable, disable, recovery codes, and account deletion) share one failure counter per member: five wrong answers across them lock all of them for fifteen minutes (`429`), in a bucket apart from the sign-in lockout |
| `/api/auth/refresh` | POST | Cookie, or body for a native app | Rotate tokens using the HttpOnly refreshToken cookie (browsers, from a trusted origin), or the `refreshToken` in the request body (native apps) |
| `/api/auth/logout` | POST | Bearer + Cookie | Revoke session |
| `/api/auth/me` | GET | Bearer | Get current user |
| `/api/auth/forgot-password` | POST | None | Send password reset email |
| `/api/auth/reset-password` | POST | None | Reset password with token |
| `/api/auth/verify-email` | POST | None | Verify email with token |
| `/api/auth/resend-verification` | POST | None | A new confirmation link for an address that has not been confirmed. Answers the same for every address |
| `/api/auth/lock` | POST | Bearer | Lock the account now: ends every session (live sockets included) and refuses password, Google, Facebook and refresh sign-in until it is unlocked from a link mailed to the address on the account |
| `/api/auth/lock-by-token` | POST | None | The same lock, from the one-time "this was not me" link in a new-device sign-in email, for a member who has no session. The token is the proof; it works once |
| `/api/auth/unlock` | POST | None | Unlock with the link mailed when the account was locked. Works once, for 24 hours, and opens no session: the member signs in again |
| `/api/auth/request-unlock` | POST | None | A new unlock link, for one that was lost or has expired. Answers the same for every address |
| `/api/admin/users/:id/two-factor/reset` | POST | Bearer, ADMIN | Remove two-factor from an account whose owner has lost the authenticator and the recovery codes. Body `{ reason, identityChecked: true }`. Never on your own account (`409`). Ends every session, emails the member, tells the other administrators if the account is staff, and is audited as `USER_TWO_FACTOR_RESET`. See `docs/runbooks/TWO-FACTOR-RESET.md` |
| `/api/users/me` | DELETE | Bearer | Close the account: the full erasure, the same as `POST /api/gdpr/dsar/delete`, carried out at once. Body `{ confirm: true, currentPassword?, code? }`: the password when the account has one and a live second factor when it is on. Ends any Stripe membership first and refuses (`409`, nothing erased) if that cannot be done, or under a legal hold |
| `/api/users/me/date-of-birth` | POST | Bearer | Give a date of birth, once, for an account made before one was asked for. Every other write from such an account is refused `403 DATE_OF_BIRTH_REQUIRED` until it is given; an account whose date is under the minimum is refused `403 MINIMUM_AGE_NOT_MET` |

**Token details:**
- Access token: 15-minute expiry, stored in-memory on client (not localStorage)
- Refresh token: 7-day expiry, HttpOnly Secure SameSite=Lax cookie
- Refresh rotation: each refresh issues a new refresh token and revokes the old one
- Reuse: presenting a refresh token that was already rotated revokes every session of the account (401). A request that arrives within 10 seconds of the rotation from the same client, such as a second tab, or that loses a race with the refresh that won, is answered `409` with `code: REFRESH_IN_PROGRESS` and nothing is revoked: ask again with the new token
- Native apps: send `X-Athena-Client: mobile`. Sign-in, Google, Facebook and refresh then return `refreshToken` in the response body and set no cookie, and `/api/auth/refresh` takes `{ "refreshToken": "..." }` and ignores any cookie. The app must save the new pair after every refresh, because the old refresh token stops working the moment it is used
- Lifetimes come from `JWT_EXPIRES_IN` (default `15m`) and `JWT_REFRESH_EXPIRES_IN` (default `7d`)

---

## API Route Groups

| Group | Prefix | Auth | Description |
|-------|--------|------|-------------|
| Auth | `/api/auth/*` | Mixed | Registration, login, token management |
| Users | `/api/users/*` | Bearer | Profile, preferences, skills, follow |
| Jobs | `/api/jobs/*` | Bearer | Job search, apply, recommendations |
| Posts | `/api/posts/*` | Bearer | Social feed, likes, comments |
| Organizations | `/api/organizations/*` | Bearer | Company pages |
| Courses | `/api/courses/*` | Bearer | Education, enrollment |
| Mentors | `/api/mentors/*` | Bearer | Mentorship programs |
| Subscriptions | `/api/subscriptions/*` | Bearer | Stripe billing |
| AI | `/api/ai/*` | Bearer | Career coach, resume optimizer, interview prep |
| Media | `/api/media/*` | Bearer | File uploads, sent through the API (size limit per kind, file-type and content checks, image moderation), and access to private files (résumés, documents). There are no presigned upload URLs |
| Notifications | `/api/notifications/*` | Bearer | In-app notifications |
| Messages | `/api/messages/*` | Bearer | Direct messaging |
| Referrals | `/api/referrals/*` | Bearer | Referral codes, leaderboard |
| Search | `/api/search/*` | Bearer | Unified search across entities |
| Safety | `/api/safety/*` | Bearer | Reports, blocks, safe mode |
| Groups | `/api/groups/*` | Bearer | Community groups |
| Events | `/api/events/*` | Bearer | Community events |
| Employer | `/api/employer/*` | Bearer | Employer dashboard, job management |
| Education | `/api/education/*` | Bearer | Education providers, applications |
| Business | `/api/business/*` | Bearer | Accelerators, grants, investors, vendors |
| Housing | `/api/housing/*` | Mixed | Safe housing listings. DV-safe, emergency and transitional listings are shown to eligible members only, held for a staff check, and badged only while the lister's provider check stands; staff queues for both checks (ADMIN). Every answer is `Cache-Control: private, no-store` |
| Finance | `/api/finance/*` | Bearer | Savings, insurance, superannuation |
| Strategy | `/api/strategy/*` | Mixed | Housing, business, tax and investment calculators (open); saved plans, holdings, net worth and grant matching (Bearer) |
| Wellness | `/api/wellness/*` | Mixed | Health trackers (encrypted) with imports from Apple Health, Google Fit or CSV, cycle, insights, doctor report and share links (optionally anonymous), medications, mental load, forums (verified practitioners marked; a post or reply can be reported, self-harm included), support circles, crisis support (words that sound like self-harm in a post, reply, circle check-in, mental load task or check-in note come back with the crisis lines in `crisis`, and where other people can read them a moderator is told as well; a private record raises nothing), practitioner directory with bookings, calendar files, verified and moderated reviews, habits, challenges, goals and badges (Bearer); reference, library, K10 and share links by token (open) |
| Automotive | `/api/automotive/*` | Mixed | New-car catalogue with dated ANCAP status, tailpipe emissions, reviews from women and spec comparison; finance, insurance (estimate and quote comparison) and valuation calculators; pre-loved listings with price guides and checks; workshop and dealership directories with price filters; fleet programme enquiries (open). Garage with service history and reminders, listings, inspections, purchases under buyer protection (escrow), workshop bookings, quotes and payment, test drives (with sales reported for the referral ledger), trade-in quotes, finance pre-approvals, and the admin queues and referral ledger (Bearer) |
| Impact | `/api/impact/*` | Bearer | Social impact metrics, DV services |
| Community Support | `/api/community-support/*` | Bearer | Support programs, indigenous communities |
| GDPR | `/api/gdpr/*` | Bearer | DSAR, consents, cookie preferences |
| Compliance | `/api/compliance/*` | Mixed | Region config, pricing |
| Admin | `/api/admin/*` | Bearer (Admin) | Platform administration |

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message (i18n-aware)",
  "i18nKey": "errors.auth.invalidCredentials",
  "statusCode": 401,
  "requestId": "req-abc123"
}
```

In development, or in production for a caller who sends a valid `X-Debug-Auth` header (the `DEBUG_SECRET`, compared in constant time), additional debug fields appear:
```json
{
  "debugMessage": "Raw error message",
  "debugStack": "Error stack trace..."
}
```

In production without that header a 500 never carries them: it answers a generic message and the `requestId`, and the message and stack go only to the server log and the error tracker. A request body over its size limit is answered `413`, and a body or query string that fails its schema is answered `400` with the field and what is wrong with it.

---

## Request Limits and Validation

- A JSON request body is limited to 256kb; a larger one is answered `413`. The few routes that take a spreadsheet or an article have a larger limit of their own, named with the reason in `src/config/body-limits.ts` (bank statement import, housing and car catalogue CSV import, wellness import, marketing lead import, articles, breach notices and legal holds). The larger limit is read only for a request carrying a signed, unexpired access token. Without one, a body within 256kb is read as on any other route and the route answers; a body past 256kb is answered `401` before it is read (`No token provided`, `Token expired` or `Invalid token`, as the route's own check would say), so a stranger cannot make the API buffer megabytes, and a member whose fifteen-minute token lapsed while she wrote gets the `401` her client refreshes on and retries, not a `413` that blames the file. File uploads are multipart and have their own size limit per kind.
- Every list takes `?page=` and `?limit=`. A limit above the route's ceiling (100 for most lists, 50 for search and recommendations) is the ceiling, a limit that is not a number, or is negative, is the route's usual page or the smallest (never "from the end"), and on the lists that use the shared clamp (`clampPage`, `parsePagination`) a page past 10,000 is page 10,000. A few lists that declared a stricter rule answer `400` instead (the mentor directory refuses a limit over 100).
- A body is read through a schema (`src/middleware/validate.ts`): a field of the wrong kind, or one missing, is answered `400` with the field named (`amount: must be a number`). Where the body goes to the database the schema is strict, and a field the route did not name is refused by name (`Unknown field: userId`) instead of being dropped.

---

## Rate Limiting

The budget follows the caller, in a 15-minute window (`middleware/apiBudget.ts`):

| Caller | Budget per window | Counted by |
|---|---|---|
| No valid access token | 100 (`RATE_LIMIT_MAX`) | the visitor's address (an IPv6 address counts as its /64) |
| A signed-in member | 1,500 (`RATE_LIMIT_MEMBER_MAX`) | the member, on whatever address she is on |
| Staff (moderator, admin) | 5,000 (`RATE_LIMIT_STAFF_MAX`) | the account |

A token that is forged, expired or is a refresh token is not an identity; it is counted by address like any other caller. Outside production the budgets are relaxed (2,000, 6,000 and 10,000). The counters are shared by every instance when `REDIS_URL` is set.

- Sign-in and sign-up: 10 attempts per 15 minutes per address, each on its own counter. Password reset and resend-verification: 5 per hour. Locking an account and unlocking it from an emailed link (`/auth/lock`, `/auth/lock-by-token`, `/auth/unlock`, `/auth/request-unlock`): 10 per hour per address, on a counter of their own. Session refresh: 30 per minute per address, outside the overall budget.
- Particular actions have their own, tighter limits: posting, commenting, following, messaging, reporting, search, uploads and AI requests.
- `RATE_LIMIT_ENABLED` only switches limits off outside production; production ignores it.
- Response headers on every call: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (the standard form) and `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. A 429 also carries `Retry-After`, in seconds. The sign-in, sign-up and password-reset limiters send the standard `RateLimit-*` headers only.
- The web app waits the `Retry-After` (up to 20 seconds) and repeats a read once; a longer wait, or a write, is shown to the member instead.

---

## Health & Ops Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | None | The process is up. Answers `status` and a timestamp only |
| `GET /health/live` | None | Liveness probe |
| `GET /health/ready` | None | Readiness (checks the database). A failure is `503` with `status: not_ready` and no error text; the reason is in the server log |
| `GET /health/version` | None | Service name and package version. The Node version, build time and commit are added for a caller with the diagnostics token |
| `GET /health/detailed` | Diagnostics token | All dependency statuses, queue depths and the money paths. `404` in production without `HEALTH_DIAGNOSTICS_TOKEN`, `DEBUG_SECRET` or `METRICS_TOKEN` |
| `GET /health/launch-readiness` | Diagnostics token | Every setting a production launch needs, each marked required or recommended. `503` `not_ready` when a required one is missing (the Stripe keys and both webhook secrets, SendGrid, the AI key, the media bucket, Redis); `?probe=media` also tests that private uploads cannot be read without signing in. `404` in production without the token |
| `GET /health/auth-diag` | Diagnostics token | Auth flow diagnostics (12 checks). `404` in production without the token |
| `GET /livez` | None | Process liveness probe: the host's health check |
| `GET /readyz` | None | Readiness probe: `200` only when the database answers, `503` otherwise and while shutting down; no error text |
| `GET /metrics` | Token | Prometheus metrics (`METRICS_TOKEN` required) |

---

## Local Development

```bash
# Backend
cd athena-platform/server
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev          # http://localhost:5000

# Frontend
cd athena-platform/client
npm ci
npm run dev          # http://localhost:3000
```

Environment variables: see `server/.env.example` and `client/.env.local.example`

---

## Testing

```bash
# Server unit tests (22 suites, 99 tests)
cd athena-platform/server
NODE_ENV=test npm test

# Client E2E smoke tests (Playwright)
cd athena-platform/client
npm run e2e
```
