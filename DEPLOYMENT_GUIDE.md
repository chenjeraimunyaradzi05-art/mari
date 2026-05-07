# ATHENA Platform — Top-level Deployment Guide

This is the **repo-root** deployment overview. For the full step-by-step
guide (env vars, smoke tests, troubleshooting, monitoring), see
[`athena-platform/DEPLOY.md`](athena-platform/DEPLOY.md).

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                          ATHENA Platform                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │   Web Client    │  │   API Server    │  │  Mobile Apps    │       │
│  │   (Next.js 14)  │  │   (Express)     │  │  (React Native) │       │
│  │                 │  │                 │  │                 │       │
│  │   📍 Netlify    │  │   📍 Container  │  │   📍 App Stores │       │
│  │                 │  │      host       │  │                 │       │
│  │                 │  │   (Render /     │  │  Built via:     │       │
│  └────────┬────────┘  │    Fly.io /     │  │   📍 EAS Build  │       │
│           │           │    your VM)     │  └─────────────────┘       │
│           │           └────────┬────────┘                            │
│           └──────────┬──────────┘                                    │
│                      │                                               │
│           ┌──────────▼──────────┐                                    │
│           │  Neon Postgres      │                                    │
│           │  (serverless,       │                                    │
│           │   Netlify add-on)   │                                    │
│           └─────────────────────┘                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Provision the database (Neon)

1. Open the Neon console at <https://console.neon.tech>, or install the
   **Neon** integration on your Netlify site (Integrations → Neon →
   **Connect**).
2. Capture both the **pooled** and **direct/unpooled** connection strings.
3. See [`NEON_SETUP.md`](NEON_SETUP.md) for the full env-var format.

### 2. Deploy the API server

The Express API in `athena-platform/server/` ships with a `Dockerfile` and
deploys to any Node 20 container host. Two paths:

- **Render:** new Docker Web Service, root directory
  `athena-platform/server`, health check path `/health`.
- **Fly.io:** `flyctl launch` inside `athena-platform/server`, then
  `flyctl secrets set …` and `flyctl deploy`.

Required env vars at minimum: `DATABASE_URL`, `DIRECT_DATABASE_URL`,
`JWT_SECRET`, `NODE_ENV=production`, `CLIENT_URL`, `ALLOWED_ORIGINS`,
`TRUST_PROXY=true`. Full list: `athena-platform/server/.env.production.example`.

### 3. Deploy the web frontend (Netlify)

1. Connect the GitHub repo to Netlify.
2. Set **Base directory** to `athena-platform/client`.
3. Add env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_SOCKET_URL` (defaults to `NEXT_PUBLIC_API_URL`).
4. See [`NETLIFY_SETUP.md`](NETLIFY_SETUP.md) for screenshots and
   re-authorization steps.

### 4. Build the mobile apps (EAS Build)

```bash
cd athena-platform/mobile
npm install -g eas-cli
eas login
eas build --platform all --profile preview
```

See [`MOBILE_BUILD_GUIDE.md`](MOBILE_BUILD_GUIDE.md).

## Detailed guides

| Topic | Guide |
|---|---|
| Full deploy walkthrough | [`athena-platform/DEPLOY.md`](athena-platform/DEPLOY.md) |
| Neon database setup | [`NEON_SETUP.md`](NEON_SETUP.md) |
| Netlify (web) setup | [`NETLIFY_SETUP.md`](NETLIFY_SETUP.md) |
| Mobile (EAS) builds | [`MOBILE_BUILD_GUIDE.md`](MOBILE_BUILD_GUIDE.md) |
| Launch checklist | [`athena-platform/LAUNCH_CHECKLIST.md`](athena-platform/LAUNCH_CHECKLIST.md) |
| On-call runbook | [`athena-platform/docs/runbooks/ONCALL.md`](athena-platform/docs/runbooks/ONCALL.md) |

## GitHub Actions

| Workflow | Trigger | Description |
|---|---|---|
| `.github/workflows/build-and-deploy.yml` | Push to `main` | Builds API + web + mobile and applies Prisma migrations against `DIRECT_DATABASE_URL`/`DATABASE_URL` |
| `.github/workflows/netlify-deploy.yml` | Push to `main`, PR, manual | Deploys the Next.js client to Netlify (production for `main`, preview for PRs) |
| `.github/workflows/mobile-build.yml` | Manual / `mobile/**` | Optional EAS mobile build |

### Required GitHub secrets

| Secret | Used by | How to obtain |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | `netlify-deploy.yml` | app.netlify.com → User Settings → Applications |
| `NETLIFY_SITE_ID` | `netlify-deploy.yml` | Site Settings → General → Site ID |
| `NEXT_PUBLIC_API_URL` | `netlify-deploy.yml` | Backend public URL |
| `DIRECT_DATABASE_URL` *(or `DATABASE_URL`)* | `build-and-deploy.yml` | Neon direct connection string (used for migrations) |
| `EXPO_TOKEN` *(optional)* | `mobile-build.yml` | expo.dev → Account → Access Tokens |

> The backend container host (Render / Fly.io / etc.) is wired up directly
> from its own dashboard's GitHub integration — there is no GitHub Actions
> deploy step for the backend by default.

## Services summary

| Service | Platform | Directory | URL example |
|---|---|---|---|
| Database | Neon | — | `ep-xxxx-pooler.region.aws.neon.tech` |
| API server | Container host (Render / Fly.io / your VM) | `athena-platform/server` | `https://api.your-domain.com` |
| Web client | Netlify | `athena-platform/client` | `https://athena-empress.netlify.app` |
| iOS app | App Store | `athena-platform/mobile` | App Store link |
| Android app | Google Play | `athena-platform/mobile` | Play Store link |

## Environment variables

### API server — required

```env
NODE_ENV=production
TRUST_PROXY=true
JWT_SECRET=<32+ char random>
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require
CLIENT_URL=https://athena-empress.netlify.app
FRONTEND_URL=https://athena-empress.netlify.app
ALLOWED_ORIGINS=https://athena-empress.netlify.app
APP_URL=https://api.your-domain.com
# PORT is auto-injected by most container hosts — only set it if your host requires it
```

### API server — optional

```env
REDIS_URL=redis://...                     # caching, sessions, BullMQ
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@athena.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
S3_BUCKET=athena-uploads
SENTRY_DSN=https://...
DV_ENCRYPTION_KEY=<64 hex chars>
ENABLE_WORKERS=true
METRICS_TOKEN=<random>
```

### Web client — required

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_URL=https://athena-empress.netlify.app
```

### Web client — optional

```env
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_MAINTENANCE_MODE=false
```

## Troubleshooting

### Netlify: GitHub connection broken
1. Netlify → Team Settings → Git → GitHub → Disconnect, then reconnect.
2. In GitHub: Settings → Applications → Netlify → Configure → re-authorize the repo.

### Container host: only one service shows up
Most monorepo-aware hosts require you to set the **Root Directory** explicitly
to `athena-platform/server` (API) or `athena-platform/client` (web). Set it
on the service settings page.

### Mobile: build failing
1. Check the EAS dashboard for logs.
2. Verify Expo SDK compatibility.
3. `eas credentials` to fix signing issues.

## File structure

```text
mari/
├── .github/workflows/
│   ├── build-and-deploy.yml        # Build API + web + mobile, run Prisma migrations
│   ├── netlify-deploy.yml          # Deploy web client to Netlify
│   ├── mobile-build.yml            # Optional EAS mobile build
│   └── ci.yml                      # Lint/test
├── athena-platform/
│   ├── DEPLOY.md                   # Full deploy guide (canonical)
│   ├── client/
│   │   ├── netlify.toml            # Netlify build config
│   │   └── Dockerfile              # Optional, for self-hosting the web app
│   ├── server/
│   │   ├── Dockerfile              # Source of truth for backend image
│   │   └── .env.production.example
│   └── mobile/
│       ├── eas.json
│       └── app.json
├── netlify.toml                    # Root Netlify base-dir hint
├── NEON_SETUP.md
├── NETLIFY_SETUP.md
├── MOBILE_BUILD_GUIDE.md
└── DEPLOYMENT_GUIDE.md             # This file
```

## Support

For deployment issues:

1. Check the specific guide for your platform.
2. Inspect build logs (Netlify Deploys / your container host's dashboard).
3. Verify env vars match the tables above.
4. Hit the health endpoints: `/health`, `/readyz`, `/health/auth-diag`.
