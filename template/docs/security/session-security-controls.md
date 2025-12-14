# Session Security, SIEM Exports, and DLP Upload Scanning

## Overview
- Admins can now review and revoke member devices with `admin/security/sessions` (controller: `App\Http\Controllers\Admin\SessionSecurityController`).
- Members receive the same telemetry plus self-serve revocation at `account/sessions` (controller: `App\Http\Controllers\Account\SessionSecurityController`).
- Every `SecurityAuditLog` row tracks export metadata so `php artisan security:audit:export` can stream newline-delimited JSON batches to the configured disk/SIEM.
- The DLP middleware inspects both request bodies and supported uploads, blocking or warning on PII before it lands in storage.

## Admin Session Console
- Route name: `admin.security.sessions.index`; wrap any admin nav link with `route('admin.security.sessions.index')` (already present in the sidebar).
- Filters support user id + fuzzy search across IP/device/browser fields and eager load the related member for auditing.
- Revoking (`admin.security.sessions.destroy`) removes the `sessions_extended` record, trims the native `sessions` table, and writes `session.revoked.admin` to `security_audit_logs` with the acting admin id.

## Member Device Dashboard
- Route name: `account.sessions.index` under the authenticated `account` prefix.
- Surfaces active session metrics (count, country spread, last seen) plus adaptive MFA risk banners populated by `TrackSessionSecurity`.
- Deleting another device uses `SessionSecurityService::revokeSession` and writes `session.revoked.self`; deleting the current session logs out the browser and forces a re-login.

## Security Audit Export Pipeline
- Configure via `config/security.php > audit_export`:
  - `disk`, `path_prefix`, `batch_size`, `visibility`, and `schedule.frequency` (`five`, `ten`, `fifteen`, `thirty`, `hourly`, `daily`).
- Command usage:
  ```pwsh
  php artisan security:audit:export --since="2025-10-01T00:00:00Z" --chunk=500
  php artisan security:audit:export --dry-run
  ```
- Scheduler (`app/Console/Kernel.php`) runs the exporter every 15 minutes by default. Use `SECURITY_AUDIT_EXPORT_SCHEDULED=false` to disable or override the cadence.
- Each batch writes `security/audit-logs/security_audit_logs_<timestamp>.ndjson` (configurable prefix) and annotates the exported rows with `exported_at` + `export_batch_id`.

## DLP Upload Coverage
- `config/security.php > dlp.inspect_uploads` gates file scanning. Defaults:
  - Enabled, 50 KB byte limit, MIME allow list for text, JSON, XML, PDF, and spreadsheet formats.
  - Field exemptions allow skipping specific form inputs or filenames (wildcards supported).
- `ScanForSensitiveData` now merges flattened form strings with sampled upload contents before passing them to `DlpService`.
- Critical matches (SSNs, TFNs, credit cards, Medicare numbers) block the request; warnings attach `security.dlp.violations` to the request so controllers can soft-block.

## Test Coverage
- Admin console: `tests/Feature/Admin/SessionSecurityControllerTest.php`.
- Member dashboard: `tests/Feature/Account/SessionSecurityControllerTest.php`.
- SIEM exporter: `tests/Feature/Console/ExportSecurityAuditLogsCommandTest.php`.
- DLP uploads + payload scanning: `tests/Feature/Http/Middleware/ScanForSensitiveDataTest.php`.

Run the targeted suite:
```pwsh
php artisan test \
  tests/Feature/Admin/SessionSecurityControllerTest.php \
  tests/Feature/Account/SessionSecurityControllerTest.php \
  tests/Feature/Console/ExportSecurityAuditLogsCommandTest.php \
  tests/Feature/Http/Middleware/ScanForSensitiveDataTest.php
```

Keep these green before shipping session/DLP/security audit changes.
