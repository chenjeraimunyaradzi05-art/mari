# ATHENA Platform - Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ATHENA Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web Client    │  │   API Server    │  │  Mobile Apps    │ │
│  │   (Next.js)     │  │   (Express)     │  │  (React Native) │ │
│  │                 │  │                 │  │                 │ │
│  │  📍 Netlify     │  │  📍 API host    │  │  📍 App Stores  │ │
│  │                 │  │  (always-on     │  │                 │ │
│  │                 │  │   Node 20)      │  │  Built via:     │ │
│  └────────┬────────┘  └────────┬────────┘  │  📍 EAS Build   │ │
│           │  /api proxy        │           └─────────────────┘ │
│           └───────────────────>│                               │
│                                │                               │
│                     ┌──────────▼──────────┐                    │
│                     │    PostgreSQL       │                    │
│                     │    📍 Neon          │                    │
│                     └─────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Three pieces, three homes:

| Piece | Where | Why there |
|---|---|---|
| Database | **Neon** | Serverless PostgreSQL with a pooled endpoint for runtime and a direct one for migrations. See [NEON_SETUP.md](NEON_SETUP.md). |
| API server | **Any always-on Node 20 host** | Express with Socket.IO, BullMQ workers and local media uploads needs a long-running process, which Neon does not provide and Netlify Functions cannot hold. Render, Fly.io or a plain VPS all work; the repo ships a `Dockerfile`. Railway is no longer used. |
| Web client | **Netlify** | Next.js on the Netlify runtime plugin. Every `/api` request is proxied in-app to the API host, so the browser only ever talks to the Netlify origin. |

## Quick Start Deployment

### 1. Database (Neon)

Follow [NEON_SETUP.md](NEON_SETUP.md). You come out of it with a pooled
`DATABASE_URL` and a direct `DIRECT_DATABASE_URL`.

### 2. API Server

1. Point your host at this repository with the root directory set to
   `athena-platform/server`.
2. Build with the `Dockerfile`, or with `npm ci && npm run build`.
3. Start with `node dist/start.js`. It runs `prisma migrate deploy` against
   Neon and then boots the server; `/health` answers on `PORT` (default 5000).
4. Set the environment from `athena-platform/server/.env.production.template`.
   The minimum that must be real:
   ```
   NODE_ENV=production
   DATABASE_URL=<Neon pooled URL>
   DIRECT_DATABASE_URL=<Neon direct URL>
   JWT_SECRET=<openssl rand -hex 32>
   CLIENT_URL=https://athena-empress.netlify.app
   ALLOWED_ORIGINS=https://athena-empress.netlify.app
   TRUST_PROXY=true
   ```
5. Note the public HTTPS URL the host gives you. Everything below calls it
   `https://api.your-domain.com`.

### 3. Web Client (Netlify)

1. Go to [Netlify](https://app.netlify.com) and import the repository.
2. Base directory `athena-platform/client`; the build command, publish
   directory and Next.js plugin come from `netlify.toml`.
3. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   NEXT_PUBLIC_APP_URL=https://athena-empress.netlify.app
   ```
   Without `NEXT_PUBLIC_API_URL` the proxy falls back to `localhost:5000` and
   every `/api` request fails.

Details in [NETLIFY_SETUP.md](NETLIFY_SETUP.md).

### 4. Mobile Apps (EAS Build)

```bash
cd athena-platform/mobile
npm install -g eas-cli
eas login
eas build --platform all --profile preview
```

Details in [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md).

## GitHub Actions Workflows

Workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push and pull request to `main` | Typechecks, builds and tests the server and the client; runs the API-contract, doc-reference and dead-interaction checks. |
| `build-and-deploy.yml` | Push to `main`, manual | Migrates the Neon database, then builds and publishes the web app to Netlify. Each target runs only when its secrets are set. |
| `netlify-deploy.yml` | Pull request touching the client | Netlify preview deploy. |
| `mobile-build.yml` | Manual, or push to `mobile/**` | EAS builds for iOS and Android. |
| `security-audit.yml` | Weekly | `npm audit` over server, client and mobile. |

The API host is not deployed from Actions. A host that builds from GitHub
redeploys itself on the same push.

### Required GitHub Secrets

| Secret | Used by | Where to get it |
|---|---|---|
| `NEON_DIRECT_DATABASE_URL` | Migrate job | Neon console, Connect, with pooling **off**. `DIRECT_DATABASE_URL` is accepted as an alias. |
| `NETLIFY_AUTH_TOKEN` | Netlify deploys | app.netlify.com, User Settings, Applications |
| `NETLIFY_SITE_ID` | Netlify deploys | Site Settings, General, Site ID |
| `NEXT_PUBLIC_API_URL` | Netlify deploys | The API host's public URL |
| `NEXT_PUBLIC_APP_URL` | Netlify deploys | The Netlify site URL |
| `EXPO_TOKEN` | Mobile builds | expo.dev, Account, Access Tokens |

## Services Summary

| Service | Platform | Directory | URL |
|---|---|---|---|
| PostgreSQL | Neon | - | `ep-xxxx.ap-southeast-2.aws.neon.tech` |
| API Server | API host | `athena-platform/server` | `https://api.your-domain.com` |
| Web Client | Netlify | `athena-platform/client` | `https://athena-empress.netlify.app` |
| iOS App | App Store | `athena-platform/mobile` | App Store link |
| Android App | Google Play | `athena-platform/mobile` | Play Store link |

## Environment Variables

### API Server (required)

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your-32-character-secret-key-here
CLIENT_URL=https://athena-empress.netlify.app
ALLOWED_ORIGINS=https://athena-empress.netlify.app
TRUST_PROXY=true
# PORT: most hosts inject it; the server defaults to 5000
```

### API Server (optional)

```env
REDIS_URL=redis://...            # BullMQ workers and caching
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=athena-uploads
SENTRY_DSN=https://...
```

The full list, with what each one does, is
`athena-platform/server/.env.production.template`.

### Web Client (required)

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_URL=https://athena-empress.netlify.app
```

### Web Client (optional)

```env
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com   # defaults to NEXT_PUBLIC_API_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

## Troubleshooting

### `/api/*` returns 500 or 503 on Netlify
`NEXT_PUBLIC_API_URL` is unset or points at a dead host. Set it in the Netlify
dashboard and redeploy. `curl https://athena-empress.netlify.app/api/health`
should return the API's health payload.

### The API starts but `/readyz` is 503
The database is unreachable. Check `DATABASE_URL` on the host and the compute
state in the Neon console. The troubleshooting table in
[NEON_SETUP.md](NEON_SETUP.md) covers the common messages.

### Migrations fail on deploy
`start.ts` runs them through `DIRECT_DATABASE_URL`. If that is the pooled URL
they will hang or fail; use the direct hostname.

### Netlify: GitHub connection broken
1. Netlify Team Settings, Git, GitHub
2. Disconnect and reconnect
3. Re-authorise repository access

### Mobile: build failing
1. Check the EAS dashboard for logs
2. Ensure Expo SDK version compatibility
3. Run `eas credentials` to fix signing issues

## File Structure

```
mari/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Verification on every push and PR
│       ├── build-and-deploy.yml   # Migrate Neon, publish to Netlify
│       ├── netlify-deploy.yml     # PR preview deploys
│       ├── mobile-build.yml       # EAS builds
│       └── security-audit.yml     # Weekly npm audit
├── athena-platform/
│   ├── client/                    # Next.js web app (Netlify)
│   │   ├── netlify.toml
│   │   └── .env.netlify           # Netlify variable template
│   ├── server/                    # Express API (API host)
│   │   ├── Dockerfile
│   │   ├── prisma/                # Schema and hand-written migrations
│   │   └── .env.production.template
│   └── mobile/                    # React Native app
│       ├── eas.json
│       └── app.json
├── netlify.toml                   # Root Netlify config (base = client)
├── NEON_SETUP.md
├── NETLIFY_SETUP.md
├── MOBILE_BUILD_GUIDE.md
└── DEPLOYMENT_GUIDE.md            # This file
```

## Support

For deployment issues:
1. Check the guide for the piece that is failing
2. Review build logs on that platform
3. Verify environment variables
4. Check service health endpoints (`/health` and `/readyz` on the API)
