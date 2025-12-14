# Women Real Estate Verification Analytics

The admin dashboard exposes a verification analytics view at `/admin/women/verification/analytics` (route name `admin.women.verification.analytics`). Only admins with a configured Women Verification reviewer role can access the page.

## Metrics

The page surfaces two key groups of metrics, each visualised with live-updating charts:

- **SLA coverage** – average and median hours to first manual review, the number of applications reviewed within the SLA window, and backlog counts for submissions that have not been reviewed inside the SLA threshold (including compliance escalations). A doughnut chart highlights the proportion of agents reviewed within the configured SLA.
- **Dropout signals** – counts for applications that appear stalled (pending or awaiting information beyond the dropout threshold) plus rejection totals. A dropout composition chart and numeric cards quantify the risk profile across the queue.

Both breakdown tables (status and stage) help spot bottlenecks across the verification pipeline, and their data feeds the stage/status bar charts rendered alongside the tables.

The summary auto-refreshes on a timer (and can be manually refreshed) so the charts and cards stay in sync with the verification queue without a full page reload. The same route responds with JSON when requested with the `Accept: application/json` header for lightweight polling by other tooling.

## Configuration

Configure the SLA and dropout thresholds via environment variables:

```env
WOMEN_REAL_ESTATE_VERIFICATION_SLA_HOURS=24
WOMEN_REAL_ESTATE_VERIFICATION_DROPOUT_HOURS=72
WOMEN_REAL_ESTATE_VERIFICATION_ANALYTICS_CACHE_TTL=300
WOMEN_REAL_ESTATE_VERIFICATION_ANALYTICS_REFRESH_MS=60000
```

Setting the cache TTL to `0` disables caching; lowering the refresh interval increases the live polling cadence. Update the values and run `php artisan config:clear` to refresh the loaded configuration.
