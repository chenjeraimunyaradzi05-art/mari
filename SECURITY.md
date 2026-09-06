# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in any ATHENA component, please email
**chenjeraimunyaradzi05@gmail.com** with:

- A description of the issue and the affected component (athena-frontend, athena-platform, app-backend, auth-service, packages/*)
- Steps to reproduce
- Any proof-of-concept code

Please do not open a public issue for security reports, and do not access data
that is not your own while testing. You should receive an acknowledgement
within 72 hours. A machine-readable disclosure file is published at the standard
well-known security.txt URL on the deployed site (source file:
`athena-platform/client/public/.well-known/security.txt`).

## Supported components

| Component | Status |
|---|---|
| athena-frontend | Active — deployed via Netlify |
| athena-platform (client/server/mobile/ml) | Active |
| app-backend | Active (Laravel-to-Node conversion in progress) |
| auth-service | Development mock only — never deploy to production |

## Key security controls

- JWT authentication with session revocation and refresh-token-reuse detection (athena-platform/server)
- TOTP-based MFA (athena-platform/server/src/utils/totp.ts)
- Per-account login lockout and bcrypt cost 12 password hashing
- Tiered rate limiting (athena-frontend/lib/rate-limit.ts, app-backend express-rate-limit)
- Stripe/PayPal webhook signature verification
- Security headers + CSP via netlify.toml, Next middleware, and Express securityHeaders middleware

## Operational requirements (production)

- `JWT_SECRET` / `AUTH_JWT_SECRET` MUST be set — services fail closed without them
- All `.env*` files are git-ignored; never commit real credentials. Rotate any
  secret that has ever been present in a working tree synced to cloud storage.
- `DEV_HEADER_AUTH` must never be enabled outside local development.
