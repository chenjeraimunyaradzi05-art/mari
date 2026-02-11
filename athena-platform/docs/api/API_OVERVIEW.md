# API Overview

**Base URL:** `https://mari-production-5c60.up.railway.app`  
**Stack:** Express + TypeScript + Prisma ORM + PostgreSQL  
**Auth:** JWT Bearer tokens (access) + HttpOnly cookies (refresh)

---

## Authentication

All protected endpoints require: `Authorization: Bearer <accessToken>`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | None | Create account (returns accessToken + sets refreshToken cookie) |
| `/api/auth/login` | POST | None | Login (returns accessToken + sets refreshToken cookie) |
| `/api/auth/refresh` | POST | Cookie | Rotate tokens using HttpOnly refreshToken cookie |
| `/api/auth/logout` | POST | Bearer + Cookie | Revoke session |
| `/api/auth/me` | GET | Bearer | Get current user |
| `/api/auth/forgot-password` | POST | None | Send password reset email |
| `/api/auth/reset-password` | POST | None | Reset password with token |
| `/api/auth/verify-email` | POST | None | Verify email with token |

**Token details:**
- Access token: 15-minute expiry, stored in-memory on client (not localStorage)
- Refresh token: 7-day expiry, HttpOnly Secure SameSite=Lax cookie
- Refresh rotation: each refresh issues a new refresh token and revokes the old one

---

## API Route Groups

| Group | Prefix | Auth | Description |
|-------|--------|------|-------------|
| Auth | `/api/auth/*` | Mixed | Registration, login, token management |
| Users | `/api/users/*` | Bearer | Profile, preferences, skills, follow |
| Jobs | `/api/jobs/*` | Bearer | Job search, apply, recommendations |
| Posts | `/api/posts/*` | Bearer | Social feed, likes, comments |
| Organizations | `/api/organizations/*` | Bearer | Company pages |
| Courses | `/api/courses/*` | Bearer | Education, enrollment |
| Mentors | `/api/mentors/*` | Bearer | Mentorship programs |
| Subscriptions | `/api/subscriptions/*` | Bearer | Stripe billing |
| AI | `/api/ai/*` | Bearer | Career coach, resume optimizer, interview prep |
| Media | `/api/media/*` | Bearer | File uploads (S3 presigned URLs) |
| Notifications | `/api/notifications/*` | Bearer | In-app notifications |
| Messages | `/api/messages/*` | Bearer | Direct messaging |
| Referrals | `/api/referrals/*` | Bearer | Referral codes, leaderboard |
| Search | `/api/search/*` | Bearer | Unified search across entities |
| Safety | `/api/safety/*` | Bearer | Reports, blocks, safe mode |
| Groups | `/api/groups/*` | Bearer | Community groups |
| Events | `/api/events/*` | Bearer | Community events |
| Employer | `/api/employer/*` | Bearer | Employer dashboard, job management |
| Education | `/api/education/*` | Bearer | Education providers, applications |
| Business | `/api/business/*` | Bearer | Accelerators, grants, investors, vendors |
| Housing | `/api/housing/*` | Bearer | Safe housing listings |
| Finance | `/api/finance/*` | Bearer | Savings, insurance, superannuation |
| Impact | `/api/impact/*` | Bearer | Social impact metrics, DV services |
| Community Support | `/api/community-support/*` | Bearer | Support programs, indigenous communities |
| GDPR | `/api/gdpr/*` | Bearer | DSAR, consents, cookie preferences |
| Compliance | `/api/compliance/*` | Mixed | Region config, pricing |
| Admin | `/api/admin/*` | Bearer (Admin) | Platform administration |

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message (i18n-aware)",
  "i18nKey": "errors.auth.invalidCredentials",
  "statusCode": 401,
  "requestId": "req-abc123"
}
```

In development or for 500 errors, additional debug fields may appear:
```json
{
  "debugMessage": "Raw error message",
  "debugStack": "Error stack trace..."
}
```

---

## Rate Limiting

- Default: 100 requests per 15-minute window per IP
- Auth endpoints: stricter limits (20 per 15 minutes)
- Configurable via `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Health & Ops Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | None | Basic health check |
| `GET /health/ready` | None | Readiness (checks DB) |
| `GET /health/detailed` | None | All dependency statuses |
| `GET /health/auth-diag` | None | Auth flow diagnostics (12 checks) |
| `GET /livez` | None | Kubernetes liveness probe |
| `GET /readyz` | None | Kubernetes readiness probe |
| `GET /metrics` | Token | Prometheus metrics (`METRICS_TOKEN` required) |

---

## Local Development

```bash
# Backend
cd athena-platform/server
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev          # http://localhost:5000

# Frontend
cd athena-platform/client
npm ci
npm run dev          # http://localhost:3000
```

Environment variables: see `server/.env.example` and `client/.env.local.example`

---

## Testing

```bash
# Server unit tests (22 suites, 99 tests)
cd athena-platform/server
NODE_ENV=test npm test

# Client E2E smoke tests (Playwright)
cd athena-platform/client
npm run e2e
```
