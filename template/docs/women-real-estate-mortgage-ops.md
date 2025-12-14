# Women Real Estate · Mortgage Intelligence Ops Guide

The mortgage intelligence beta ships with seeded lender snapshots, a scheduled refresh job, and a manual fallback command. Use this guide when testing new lender feeds or validating repayments in non-production environments.

## Scheduled Refresh
- The scheduler dispatches `RefreshMortgageRateSnapshotsJob` twice daily (06:00 and 18:00 server time) on the `mortgage-intel` queue.
- Ensure a queue worker is active: `php artisan queue:work --queue=mortgage-intel --max-jobs=100 --stop-when-empty`.
- Logs land under the key `mortgage.snapshots.refreshed` for quick filtering in papertrail/cloudwatch.

## Manual Refresh Command
- Run inline (executes synchronously):
  ```bash
  php artisan mortgage:snapshots:refresh
  ```
- Limit templates processed (useful for smoke tests):
  ```bash
  php artisan mortgage:snapshots:refresh --limit=2
  ```
- Dispatch to queue instead of blocking the shell:
  ```bash
  php artisan mortgage:snapshots:refresh --queued --region=AU
  ```
- Supported options:
  - `--region=` defaults to `AU` while we onboard Australian lenders.
  - `--limit=` accepts an integer to throttle processed templates.
  - `--queued` enqueues `RefreshMortgageRateSnapshotsJob` on `mortgage-intel`.

## Verification Checklist
- After any refresh, spot-check via tinker:
  ```php
  App\Models\MortgageRateSnapshot::orderByDesc('captured_at')->limit(3)->get(['provider', 'interest_rate', 'captured_at']);
  ```
- Confirm listings surface updated scenarios: visit `/women/real-estate/listings` and look for the dashboard cards to reflect new `captured_at` timestamps.
- If repayments look stale, re-run the manual command with `--queued` and ensure the queue worker is running.

Keep this guide alongside deployment runbooks so ops can rapidly refresh lender data during demos or incident response.

## API Endpoints (for dashboards and tooling)
- Quotes listing: `GET /api/women/real-estate/listings/{listing}/mortgage-quotes`
- Quote stats: `GET /api/women/real-estate/listings/{listing}/mortgage-quotes/stats`

Both endpoints require Sanctum-authenticated requests. They mirror the dashboard metrics surfaced in the listings index page and enable external dashboards to visualise repayments without scraping HTML.
