# On-Call Runbook

## Quick Checks

1) Liveness / readiness
- `GET /livez` should return `200`
- `GET /readyz` should return `200` when dependencies are healthy

2) Metrics
- `GET /metrics` should return `200`
- If `METRICS_TOKEN` is set, provide either:
  - `Authorization: Bearer <token>` or
  - `X-Metrics-Token: <token>`

3) Logs / Correlation
- Each request includes `X-Request-Id`.
- Error responses include `requestId` to correlate with server logs.

## Common Failure Modes

### `/readyz` is 503
- Indicates dependency failure (typically DB connectivity).
- Check `DATABASE_URL` and DB availability.

### High 429 rate
- Rate limit is configurable:
  - `RATE_LIMIT_ENABLED` (set to `false` to disable)
  - `RATE_LIMIT_MAX`
  - `RATE_LIMIT_WINDOW_MS`

### Deploy / shutdown issues
- Server supports graceful shutdown (SIGTERM/SIGINT) and readiness draining.
- During shutdown, `/readyz` returns `503` to drain traffic.
