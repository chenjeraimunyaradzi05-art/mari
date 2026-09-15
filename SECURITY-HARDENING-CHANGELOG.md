# ATHENA Security Hardening & Cleanup — Change Log

> Paths in the entries below name the earlier multi-repository layout (`athena-frontend`, `app-backend`).
> The frontend now lives in `athena-platform/client` and the API in `athena-platform/server`; the
> retired backend was moved out by `cleanup-quarantine.ps1`. Entries are kept as the record of what changed.
_Applied 2026-08-18 by Claude (Cowork). Companion to `ATHENA_GAP_REPORT.md` and `CLEANUP-MANIFEST.md`._

Every change below was made in place and is revertible via git (`git diff`,
`git restore <file>`). Files were syntax-checked (`node --check`, `esbuild`)
after editing. No secrets were rotated and no destructive migrations were run —
those require your explicit action (see "Still requires your action").

## Code changes

### Correctness fix (was a live bug)
- **Legacy frontend auth/me route handler** — the handler called
  `response.json()` twice; the body was already consumed, so every successful
  `/api/auth/me` lookup threw and returned **500**. Now reuses the parsed body.
  This route backs "am I logged in?" for the whole app.

### Authentication hardening
- **Legacy app-backend jwtAuth middleware** — removed an **authentication
  bypass**: the middleware unconditionally trusted an `x-user-id` request
  header and granted admin when it equalled `admin`. Header auth is now
  disabled unless `NODE_ENV!==production` **and** `DEV_HEADER_AUTH=true`.
  Also: JWT verification is pinned to `HS256`, and the guessable default
  secret (`'secret'`) no longer applies in production (fails closed).
- **Legacy app-backend JWTAuthMiddleware** — pinned token
  verification to `HS256` only (was `['HS256','RS256']`, enabling
  algorithm-confusion attacks) and made the class throw in production when
  `JWT_SECRET` is unset instead of defaulting to `'your-secret-key'`.
- **Legacy auth-service entrypoint** — the dev auth mock now: refuses to boot in
  production without `AUTH_JWT_SECRET`; raises bcrypt cost 10→12; enforces an
  8-char minimum password; pins verification to `HS256`; adds baseline
  security headers, a body-size limit, an in-memory rate limiter on
  `/login` and `/register`, a constant-time dummy-hash compare to stop
  email enumeration, and a `/logout` endpoint the frontend already calls.
- **Legacy auth-service JSON user store** — removed a hard-coded plaintext
  `recovery_code` from the seeded admin account.

### Request integrity
- **Legacy frontend backend proxy utility** — the proxy forwarded
  all client headers to the backend. It now strips `x-user-id`,
  `x-internal-service-token`, and `x-forwarded-host` before forwarding, so a
  client can't spoof identity/trust headers to the backend.
- **`athena-platform/client/src/middleware.ts`** — stopped trusting a client-writable
  JSON `session` cookie as proof of authentication (a forged
  `{"userId":…}` cookie previously passed the auth gate); the httpOnly
  `auth_token` cookie is used as the coarse gate instead. Security headers
  (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, COOP,
  Permissions-Policy, and HSTS in production) are now attached to **every**
  middleware response path, not just the happy path.

### Defence-in-depth headers
- **`athena-platform/client/next.config.js`** — added a `headers()` block applying the
  same security header set app-wide and set `poweredByHeader:false`, so the
  headers hold for `next start`/previews and any non-Netlify host (Netlify
  already sets them via `netlify.toml`).

### Filled-in stubs that silently weakened security
- **Legacy app-backend validation middleware** (since retired to quarantine) — was `next()` no-ops that
  accepted every request. Now integrates with `express-validator`:
  `validateRequest` enforces prior chains and `validate(chains)` runs and
  enforces them, returning `422` on failure (degrades to pass-through only if
  the library is absent, matching prior behaviour without crashing).
- **Legacy app-backend security and auth configuration modules** — were
  `module.exports = {}` skeletons. Now real, env-driven configuration for JWT,
  password policy, lockout, rate limiting, CORS, CSRF, HSTS, uploads, and
  provider selection (local HS256 vs Auth0).
- **Legacy app-backend SecurityService** — was an empty class. Now
  provides timing-safe compare, secure token generation/hashing, password
  strength assessment, and header/HTML sanitisation.
- **Legacy app-backend SecurityAuditService** — was a no-op stub.
  Now writes structured audit entries and best-effort-persists them to the
  existing `security_audit_logs` table via Prisma, never throwing on the
  request path.

### Secrets hygiene in examples
- **`app-backend/.env.example`** — replaced the real-looking placeholder
  values `AUTH0_MANAGEMENT_CLIENT_ID=mansamusa` /
  `AUTH0_MANAGEMENT_CLIENT_SECRET=stacie` with neutral placeholders.

## New governance/disclosure files (addressing gap report §3 items 15–16)
- **`SECURITY.md`** — vulnerability-reporting policy, supported components,
  key controls, production requirements.
- **`athena-platform/client/public/.well-known/security.txt`** — machine-readable
  disclosure endpoint (was flagged missing in the audit).
- **`.gitignore`** — now also ignores `playwright-report*/`, `e2e/.auth/*`,
  `.codex-logs/*`, `cookiejar.txt`, `__pycache__/`, `.swc/*`, and the
  `_to_delete/*` quarantine folder.

## Cleanup tooling (nothing deleted)
- **`cleanup-quarantine.ps1`** + **`CLEANUP-MANIFEST.md`** — reversible
  PowerShell script that moves superseded projects, build caches, logs, and
  stray data files into `_to_delete\` for your review. Dry-run by default;
  `-Apply` to move.

## Still requires your action (cannot be done safely from code)
1. **Rotate every credential** that has lived in a `.env*` file in this
   OneDrive-synced tree, and remove those files from git history.
2. Set `JWT_SECRET` / `AUTH_JWT_SECRET` in every environment — services now
   fail closed without them.
3. Work the P0 list in `ATHENA_CODEX_AUDIT_AND_ROADMAP.md` (unowned
   `athena.com` domain, pricing math, fabricated metrics, safety-route 404s,
   pause transactions) — none of these can be resolved by refactoring.
4. Decide on **one** primary code line; the three-way duplication
   (athena-platform / athena-frontend+mock-api / app-backend) is itself a
   security-maintenance liability.
5. Add server-side authorization (IDOR/cross-tenant) tests before launch.

## 2026-09-15 — The gaps behind the audit's sixteen findings

Applied after the S1–S16 fixes of 14–15 September, from a second reading of the
perimeter. Every item has tests; `PROXY_SHARED_SECRET` and `TOTP_ENCRYPTION_KEY`
are the two new environment variables (both documented in the `.env.example`
files and `athena-platform/DEPLOY.md`).

- **The API now sees each visitor, not the web host.** Every browser call reaches
  the API through the Next.js route handlers on Netlify, which fetch from their
  own addresses, so the API had one shared budget of a hundred requests a quarter
  hour for the whole site, a login lockout keyed on the proxy, and new-device
  alerts comparing the proxy's browser. `athena-platform/client/src/app/api/proxy-identity.ts`
  forwards the visitor's address and user agent with a shared secret;
  `athena-platform/server/src/middleware/trustedProxy.ts` believes the address only
  when the secret matches, compared in constant time. **Set `PROXY_SHARED_SECRET`
  to the same value on both hosts.**
- **Staff two-factor is enforced at authentication.** Forty-odd routes check the
  admin role inline rather than through the role middleware, so an admin without
  a second factor still reached them. `authenticate` in
  `athena-platform/server/src/middleware/auth.ts` now refuses a staff account
  without a factor everywhere except the `/api/auth/*` routes that enrol one.
- **One-time codes are one-time.** An authenticator code was accepted any number
  of times inside its ninety-second window; the matched step is now claimed
  (`athena-platform/server/src/utils/totp-replay.ts`) and a repeat is refused.
- **Authenticator seeds are sealed at rest** with AES-256-GCM
  (`athena-platform/server/src/utils/secret-box.ts`) under `TOTP_ENCRYPTION_KEY`,
  falling back to `DV_ENCRYPTION_KEY`; seeds written before sealing are read as
  they are.
- **Tokens carry their kind.** Access and refresh tokens are typed and verified
  against the type, with HS256 pinned, so one cannot stand in for the other.
- **Login lockout without Redis** counts in the process instead of not at all.
- **Sessions end everywhere.** Revoking a session, logging out of all devices,
  changing or resetting a password and being suspended now close that account's
  live sockets (`athena-platform/server/src/utils/session-events.ts`).
- **Refresh cookie is `SameSite=Lax`** by default, since the browser only reaches
  the API through the web app's own route handlers; `COOKIE_SAMESITE=none` remains
  for a split deployment.
- **Forgot-password and resend-verification** answer before the mail is sent, so
  their timing no longer says whether the address has an account.
- **Rate limits are shared across instances.** The four boot-time limiters count
  in Redis when it is configured (`athena-platform/server/src/utils/rate-limit-store.ts`),
  and the upload, AI and search limiters that were defined but never applied now
  are. Each upload is read with its own kind's ceiling rather than the video
  ceiling for everything.
- **Outbound fetches** of member-supplied links (link previews, the video
  pipeline's source download) go through one guard
  (`athena-platform/server/src/utils/outbound-url.ts`): public hosts only, every
  redirect hop checked, credentials refused, and the video source streamed to
  disk under the 500 MB ceiling with a timeout. Before this the pipeline fetched
  any URL a reel named, into memory, with no host check.
- **Served files are sandboxed**: `/uploads` and `/api/media/local` answer with
  `Content-Security-Policy: sandbox`, `nosniff`, no dotfiles or listings, and
  private documents as downloads.
- **Diagnostics for operators only**: `/health/detailed` needs the diagnostics
  token in production; the metrics, health and legacy-webhook tokens are compared
  in constant time (`athena-platform/server/src/utils/secret-compare.ts`).
- **Logs carry no secrets**: passwords, tokens, cookies, authenticator codes and
  keys are masked by name at any depth (`athena-platform/server/src/utils/logger.ts`).
- **Errors from the libraries in front of the handlers** (a file over its limit,
  a body over the JSON limit, malformed JSON, a failed zod parse) answer 413 or
  400 with a plain sentence rather than a 500 logged as a server failure.
- Housekeeping with security weight: a caller's `X-Request-Id` is echoed only
  when it looks like one; the profile update bounds its fields; `Expect-CT` is
  gone and `X-XSS-Protection` is `0` on both tiers.

Still yours to do: S7 (a development database branch) and S16 (GitHub billing,
which restores CI and the weekly advisory sweep). DNS rebinding between the
outbound host check and the fetch remains the residual risk on link fetches.

## 2026-09-06 — Upload content sniffing (`athena-platform/server`)

- **Uploads must be what they claim.** The media routes checked only the MIME
  type the browser sent. `athena-platform/server/src/utils/file-signature.ts`
  now reads each upload's first bytes and `athena-platform/server/src/routes/media.routes.ts`
  refuses the file when they disagree with the declared type (a JPEG sent as
  PNG, a ZIP sent as PDF), when the file is a program (MZ, ELF, Mach-O), or
  when it is HTML or SVG, which can carry scripts, whatever it claims to be.
  Applies to profile and cover images, post images, videos, thumbnails,
  captions, sounds, documents and resumes. Unknown declared types fail closed.
  Images were already re-encoded through sharp, which strips metadata; that
  is unchanged. Direct-to-S3 presigned uploads are not covered by this check.
