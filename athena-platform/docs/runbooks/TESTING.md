# Testing Runbook

## Server

From `athena-platform/server`:
- `npm run build`
- `NODE_ENV=test npm test`

## Client E2E Smoke

From `athena-platform/client`:
- `npm run e2e`

Notes:
- The smoke suite validates that `/login` renders and that `/dashboard` redirects to `/login` when unauthenticated.
- This is intentionally DB-independent.
