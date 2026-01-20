# API Overview

This repo includes:
- **Server**: Express + TypeScript + Prisma (`athena-platform/server`)
- **Client**: Next.js (`athena-platform/client`)

## Local Development

### Backend

From `athena-platform/server`:
- `npm ci`
- `npm run build`
- `npm run start`

Environment variables (common):
- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`

Ops endpoints:
- `GET /health`
- `GET /livez`
- `GET /readyz`
- `GET /metrics` (optionally protected by `METRICS_TOKEN`)

### Auth (high level)

Primary endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Auth is via `Authorization: Bearer <accessToken>` for protected endpoints.

## Testing

From `athena-platform/server`:
- `NODE_ENV=test npm test`

From `athena-platform/client`:
- `npm run e2e` (Playwright smoke tests)
