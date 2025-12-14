# Advertising Platform Rollout Checklist

_Updated: 27 Nov 2025_

Use this playbook whenever the advertising stack needs to be deployed to a fresh environment or refreshed before a sponsor showcase.

## 1. Database migrations

```pwsh
php artisan migrate --path=database/migrations/2025_11_27_090000_create_advertising_slots_table.php --path=database/migrations/2025_11_27_090100_create_advertising_slot_revenue_snapshots_table.php
```

> Tip: if you have other pending migrations just run `php artisan migrate` to process everything in order.

## 2. Seed baseline slot inventory

```pwsh
php artisan db:seed --class=AdvertisingSlotSeeder
```

Validated slots appear in `advertising_slots` with review metadata, guardrails, and targeting rules that power slot decisions.

## 3. Backfill revenue snapshots

Run once immediately after seeding so dashboards don’t render as empty:

```pwsh
php artisan advertising:reconcile-slot-revenue --date="yesterday"
```

The command aggregates campaign metric notes into `advertising_slot_revenue_snapshots` for the requested day (default = yesterday). Add it to the scheduler if it is not already running:

```pwsh
php artisan schedule:work
```

## 4. Cache priming (optional but recommended)

```pwsh
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 5. Smoke-test the partner experience

1. Sign in as a company user.
2. Open `Company ▸ Advertising ▸ Ad Slot Readiness` and verify slot metadata, guardrails, and latest delivery stats.
3. Visit `Company ▸ Advertising ▸ Campaigns` to confirm creatives are still editable.
4. (After step 3) Navigate to the new **Revenue Intelligence** view (added in this release) to confirm metrics render.
5. Trigger a test beacon (`/api/v1/advertising/beacon`) using a live creative to ensure metrics roll forward.

## 6. Monitoring hooks

- Ensure the `advertising:slot-reconciliation` scheduled task shows up in Horizon/Schedule monitoring.
- Add alerts on the `advertising_slot_revenue_snapshots` table (e.g. via Datadog or Grafana) so zero rows for two consecutive days raise an incident.

Following these steps guarantees the advertising stack is production-ready and revenue metrics are visible to partners.
