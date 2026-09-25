# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in any ATHENA component, please email
**chenjeraimunyaradzi05@gmail.com** with:

- A description of the issue and the affected component (see the table below)
- Steps to reproduce
- Any proof-of-concept code

Please do not open a public issue for security reports, and do not access data
that is not your own while testing. You should receive an acknowledgement
within 72 hours. A machine-readable disclosure file is published at the standard
well-known security.txt URL on the deployed site (source file:
`athena-platform/client/public/.well-known/security.txt`).

## Supported components

This table used to list `athena-frontend`, `app-backend`, `auth-service` and
`packages/*`. None of those directories exist in this repository — they were
names from an earlier layout, and asking a researcher to report a finding
against a component that is not here wastes the only part of a disclosure that
cannot be redone: the first message. What is actually here:

| Component | Path | Status |
|---|---|---|
| Web app | `athena-platform/client` | Active — Next.js, deployed on Netlify |
| API | `athena-platform/server` | Active — Express, deployed on Render (`render.yaml`) |
| Mobile app | `athena-platform/mobile` | Active — Expo/React Native, built through EAS |
| Shared package | `athena-platform/shared` | Active — consumed by the mobile app |
| ML service | `athena-platform/ml` | **Not deployed.** A FastAPI app with a Dockerfile and a docker-compose entry; nothing in production runs it, and the API treats `ML_SERVICE_URL` as optional and falls back when it is absent. |

Authentication is part of the API (`athena-platform/server/src/middleware/auth.ts`
and `src/routes/auth.routes.ts`), not a separate service.

## Key security controls

- JWT authentication with typed access and refresh tokens, per-request session checks, revocation that also closes live sockets, and refresh-token-reuse detection (athena-platform/server)
- TOTP-based MFA with replay protection and seeds sealed at rest, required for every staff role before any staff power (athena-platform/server/src/utils/totp.ts, totp-replay.ts, secret-box.ts, middleware/auth.ts)
- Per-account login lockout (Redis, with an in-process fallback) and bcrypt cost 12 password hashing
- Rate limiting with counters shared across instances (athena-platform/server/src/utils/rate-limit-store.ts), keyed on the visitor's real address, which the web proxy forwards under a shared secret (middleware/trustedProxy.ts)
- Outbound fetches of member-supplied links restricted to public hosts, every redirect checked (athena-platform/server/src/utils/outbound-url.ts)
- Uploads content-sniffed, read under per-kind size ceilings, and served sandboxed
- Stripe webhook signature verification
- Nonce-based CSP on the web app (athena-platform/client/src/proxy.ts), security headers on both tiers, secrets masked in logs

## Operational requirements (production)

- `JWT_SECRET` / `AUTH_JWT_SECRET` MUST be set — services fail closed without them
- All `.env*` files are git-ignored; never commit real credentials. Rotate any
  secret that has ever been present in a working tree synced to cloud storage.
- `DEV_HEADER_AUTH` must never be enabled outside local development.
