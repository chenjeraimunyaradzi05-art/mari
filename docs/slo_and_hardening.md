# SLOs, Load Testing & Hardening

## Objectives
- Define SLOs for the platform and validate under stress tests
- Add load testing scripts and CI pipeline for automated stress tests
- Add simple monitoring scrape endpoint for Prometheus
- Implement basic security hardening (CSP, HSTS, rate limiting)

## SLOs (Sprint 9 acceptance criteria)
- p95 latency for critical endpoints < 200ms
- p99 latency for critical endpoints < 500ms
- Error rate < 1%
- Availability (successful request rate) > 99.9% during stress window

## How to run load tests locally
1. Install k6 (https://k6.io/docs/getting-started/installation/) or run via Docker:
   docker run --rm -v $(pwd):/scripts -w /scripts loadimpact/k6:latest run tools/load-tests/k6/script.js

2. Optional env vars:
   - TARGET_URL - URL of the target to test (default http://localhost:3000)
   - K6_VUS - number of virtual users to simulate (e.g. 1000)
   - K6_DURATION - test duration (e.g. "2m")

3. Pass/fail is controlled by thresholds in the k6 script (p95 < 200ms, p99 < 500ms, error rate < 1%).

## CI
- A GitHub Actions workflow is added: `.github/workflows/load-test.yml` that runs k6 via Docker and will fail if thresholds are not met.

## Monitoring
- /api/metrics exposes a Prometheus-compatible text-format snapshot (see `app/api/metrics/route.ts`).
- Add Prometheus to your infra and scrape the service's /api/metrics endpoint.
- Example Prometheus job (monitoring/prometheus.yml)

## Security hardening
- Rate limiting added and applied in the app proxy (`app/proxy.ts` and root `proxy.ts`). The implementation now uses Upstash Redis when configured and falls back to an in-memory limiter for local development. (See `docs/upstash_rate_limiter.md` for setup.)
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are applied in the app proxy (`app/proxy.ts`).

> Note: This project migrated from the deprecated `middleware.ts` file convention to the new `proxy.ts` convention in Next.js 16 — see `docs/proxy_migration.md` for details and recommended cleanup steps.
- For production: provision an Upstash Redis instance and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in your environment/secret store.

## Acceptance testing
- Run the k6 script with K6_VUS increased to desired stress level (e.g., 10k VUs over a short duration) and confirm the thresholds succeed.
- Verify /api/metrics is returning metrics and that Prometheus can scrape it.
- Document results in project board and sign off when SLOs are verified under stress.

