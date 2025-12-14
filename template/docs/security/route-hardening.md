# Route Security Hardening

## Overview
- `config/route-security.php` now defines layered policies (`sensitive`, `candidate`, `company`) that combine authentication, women-first participation rules, and intent gating.
- `App\Http\Middleware\EnsureRouteSecurity` resolves the active policy for a route, evaluates verification status, policy acceptance, participant type blocks, role/classification allow-lists, company profile completion, and intent requirements, then logs and blocks violations.
- Employer-facing controllers call `App\Support\EmployerAccessGate` to resolve the authenticated company, enforce guardian holds, and scope queries/jobs/orders to the owning company to prevent rivalry data leaks.

## Applying Policies to Routes
- Register the middleware alias in `app/Http/Kernel.php` (already wired up as `route.security`).
- Wrap sensitive route groups with the alias plus policy key, e.g.:
  ```php
  Route::middleware(['auth', 'route.security:company'])
      ->prefix('company')
      ->group(function () {
          // employer dashboard routes
      });
  ```
- Member dashboards should use `route.security:candidate` to guarantee intent alignment and women-first enforcement.

## Rivalry Protections for Employers
- Call `EmployerAccessGate::resolveCompanyId()` when you only need the current employer id.
- Use `EmployerAccessGate::ensureJobAccess($job)` (accepts id or model) in job detail/edit/delete paths to guarantee ownership checks with meaningful 403 messaging.
- Scope job/order listings with `EmployerAccessGate::scopeJobs($query)` or equivalent query filters to ensure employers can only see their own resources.

## Verification & Tests
- Automated coverage lives in:
  - `tests/Feature/Http/Middleware/EnsureRouteSecurityTest.php`
  - `tests/Feature/Company/EmployerRivalryProtectionTest.php`
  - `tests/Feature/Http/Middleware/EnsureTwoFactorConfirmedTest.php`
  - `tests/Feature/Http/Middleware/ScanForSensitiveDataTest.php`
  - `tests/Unit/Services/Security/SessionSecurityServiceTest.php`
- Run the targeted suite with:
  ```pwsh
  php artisan test tests/Feature/Http/Middleware/EnsureRouteSecurityTest.php \
      tests/Feature/Company/EmployerRivalryProtectionTest.php \
      tests/Feature/Http/Middleware/EnsureTwoFactorConfirmedTest.php \
      tests/Feature/Http/Middleware/ScanForSensitiveDataTest.php \
      tests/Unit/Services/Security/SessionSecurityServiceTest.php
  ```
- Both suites must pass before shipping routing/auth changes; they cover baseline policy enforcement, guardian hold blocks, missing company profile checks, and rivalry protections for applications/orders.

## Adaptive MFA & Session Tracking
- All authenticated dashboards now include the `session.security` middleware which calls `SessionSecurityService` to capture device/IP/geo metadata in `sessions_extended`, raise adaptive risk reasons (`multiple_countries_detected`, `unrecognized_device`), and log warnings into `security_audit_logs`.
- `EnsureTwoFactorConfirmed` evaluates route patterns from `config/auth0.php`, adaptive risk flags, and Auth0 session grace windows. Routes matching `auth0.mfa.routes` or surfacing a session risk force an immediate re-challenge via `admin.auth0.challenge`.
- Security events are persisted through `SecurityAuditService`, powering downstream SIEM exports and providing chain-of-custody for dashboard access decisions.

## Data-Loss Prevention Controls
- The `security.dlp` middleware (backed by `DlpService`) scans POST/PUT/PATCH payloads for PII such as SSNs, card numbers, Medicare/TFN identifiers, emails, phones, and addresses. Matches are redacted, logged, and—if critical—blocked with a 422/redirect response.
- Configure behaviour via `config/security.php` (`security.dlp.*` knobs for allowed methods, ignored fields, route exemptions).
- Violations fan out to `security_audit_logs` so privacy & compliance teams can triage submissions without exposing the raw sensitive values.

## Next Steps
- Extend the DLP middleware to media ingestion endpoints and admin tooling, and feed audit rows into the central SIEM pipeline described in `way-forward.md`.
- Backfill UI to visualise active device sessions + revocation controls using the new `sessions_extended` dataset.
