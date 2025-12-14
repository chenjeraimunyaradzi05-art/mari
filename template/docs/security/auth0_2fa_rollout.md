# Auth0 + 2FA Rollout Plan

## Overview

Auth0 will become the single source of truth for admin and user authentication while Laravel continues to own authorization, auditing, and transparency logging. This plan phases the rollout to minimize risk and ensure regulatory compliance for the women-only social platform.

## Phase 0 — Prerequisites

- **Tenant alignment:** Provision staging + production Auth0 tenants, enable Adaptive MFA, and upload branded email/SMS templates.
- **Environment variables:** Add `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `AUTH0_MANAGEMENT_TOKEN` to `.env.example`.
- **SDK:** Install `auth0/login` + `auth0/auth0-php` and publish the config (`config/auth0.php`).

## Phase 1 — Guard & Middleware Wiring

1. **New guard:**
   - Update `config/auth.php` with an `auth0` guard that uses a custom user provider.
   - Implement `App\Auth\Auth0UserProvider` to map Auth0 profile claims to local `users` records (auto-provision social profiles if missing).
2. **Middleware:**
   - Add `EnsureAuth0Session` middleware that validates the JWT signature, required scopes, and token freshness.
   - Gate all admin routes with `['auth:admin', 'auth0.session']` once confidence is high.
3. **Session bridging:**
   - Store Auth0 `sub`, `amr`, and `auth_time` on the session for downstream analytics and transparency logging.

## Phase 2 — Mandatory 2FA (Adaptive MFA)

1. **Enrollment UX:**
   - Extend the onboarding wizard to surface an “Enable MFA” step if Auth0 reports `mfa` not enrolled.
   - Provide QR setup + SMS/email fallback via Auth0’s hosted pages.
2. **Middleware enforcement:**
   - Add `EnsureTwoFactorConfirmed` middleware (admin + high-risk routes). This checks the `amr` array for `mfa` and, if missing, redirects to Auth0’s MFA challenge.
3. **Recovery codes:**
   - Persist recovery codes locally (encrypted via `Hash::make`) for compliance.

## Phase 3 — Login Alerts & Security Notifications

1. **Event ingestion:**
   - Leverage Auth0 log streams (via webhooks) to capture `success-login`, `failed-login`, `mfa-factor-added`, etc.
   - Store events in `user_login_audits` (already created) with geolocation fingerprinting.
2. **Notifications:**
   - Create `LoginAlertNotification` (mail + in-app) triggered when a login originates from a new device, ASN, or country as per `config/moderation.login_alerts`.
   - Allow users to opt out via `notification_preferences` (respecting compliance rules).

## Phase 4 — Transparency & Compliance

1. **Transparency logging:**
   - Use `TransparencyLogService` to capture every enforcement decision tied to Auth0 assertion ID + reviewer.
   - Publish aggregate stats (successful MFA %, blocked logins) in quarterly regulator pack.
2. **Disaster recovery:**
   - Document break-glass procedure (static admin credential stored in MFA vault, rotated quarterly).
3. **Pen testing & audits:**
   - Run Auth0 attack protection toggles (breached password detection, bot detection) and document results for privacy counsel.

## Timeline & Owners

| Phase | Duration | Owner |
| --- | --- | --- |
| Phase 0 | 3 days | Platform Engineering |
| Phase 1 | 1 week | Platform Engineering + Backend Guild |
| Phase 2 | 1 week | Security Team |
| Phase 3 | 4 days | Security + Messaging Guild |
| Phase 4 | 3 days | Compliance + Platform |

## Acceptance Criteria

- 100% of admin logins route through Auth0 and require MFA.
- Login alerts fire for new device/country events within 60 seconds.
- Transparency logs capture actor, subject, decision, timestamp for every moderation action.
- Compliance receives monthly exports (CSV + dashboard) summarising enforcement + auth anomalies.
