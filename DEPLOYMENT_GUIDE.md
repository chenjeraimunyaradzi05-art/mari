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
│  │  📍 Netlify     │  │  📍 Railway     │  │  📍 App Stores  │ │
│  │     OR          │  │                 │  │                 │ │
│  │  📍 Railway     │  │                 │  │  Built via:     │ │
│  └────────┬────────┘  └────────┬────────┘  │  📍 EAS Build   │ │
│           │                    │           └─────────────────┘ │
│           │                    │                               │
│           └──────────┬─────────┘                               │
│                      │                                         │
│           ┌──────────▼──────────┐                              │
│           │    PostgreSQL       │                              │
│           │    📍 Railway       │                              │
│           └─────────────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start Deployment

### 1. Deploy Database (Railway)
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Create new project
3. Add PostgreSQL database
4. Note the `DATABASE_URL`

### 2. Deploy API Server (Railway)
1. In same Railway project, click "+ New" → "GitHub Repo"
2. Select your repository
3. **Set Root Directory**: `athena-platform/server`
4. Add environment variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=generate-a-32-char-random-string
   NODE_ENV=production
   ```
5. Deploy and note the public URL

### 3. Deploy Web Frontend

#### Option A: Netlify (Recommended for Frontend)
1. Go to [Netlify](https://app.netlify.com)
2. Import from GitHub
3. Set base directory: `athena-platform/client`
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-api.up.railway.app
   ```

#### Option B: Railway
1. Add another service in Railway
2. Set Root Directory: `athena-platform/client`
3. Add environment variables

### 4. Build Mobile Apps (EAS Build)
```bash
cd athena-platform/mobile
npm install -g eas-cli
eas login
eas build --platform all --profile preview
```

## Detailed Guides

| Platform | Guide |
|----------|-------|
| Railway (API + DB) | [RAILWAY_SETUP.md](RAILWAY_SETUP.md) |
| Netlify (Web) | [NETLIFY_SETUP.md](NETLIFY_SETUP.md) |
| Mobile (EAS) | [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md) |

## GitHub Actions Workflows

Automated deployment workflows are in `.github/workflows/`:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `railway-deploy.yml` | Push to main | Deploys API and Web to Railway |
| `netlify-deploy.yml` | Push to main | Deploys Web to Netlify |
| `mobile-build.yml` | Manual/Push to mobile/** | Builds iOS/Android apps |

### Required GitHub Secrets

| Secret | For | How to Get |
|--------|-----|------------|
| `RAILWAY_TOKEN` | Railway | railway.app → Account Settings → Tokens |
| `NETLIFY_AUTH_TOKEN` | Netlify | app.netlify.com → User Settings → Applications |
| `NETLIFY_SITE_ID` | Netlify | Site Settings → General → Site ID |
| `EXPO_TOKEN` | Mobile | expo.dev → Account → Access Tokens |

## Services Summary

| Service | Platform | Directory | URL Example |
|---------|----------|-----------|-------------|
| PostgreSQL | Railway | - | Internal reference |
| API Server | Railway | `athena-platform/server` | `https://athena-api.up.railway.app` |
| Web Client | Netlify/Railway | `athena-platform/client` | `https://athena.netlify.app` |
| iOS App | App Store | `athena-platform/mobile` | App Store link |
| Android App | Google Play | `athena-platform/mobile` | Play Store link |

## Environment Variables

### API Server (Required)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-32-character-secret-key-here
NODE_ENV=production
PORT=3001
```

### API Server (Optional)
```env
REDIS_URL=redis://...
STRIPE_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=athena-uploads
SENTRY_DSN=https://...
```

### Web Client (Required)
```env
NEXT_PUBLIC_API_URL=https://your-api-url.up.railway.app
NODE_ENV=production
```

### Web Client (Optional)
```env
NEXTAUTH_SECRET=random-string
NEXTAUTH_URL=https://your-site.netlify.app
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
SENTRY_DSN=https://...
```

## Troubleshooting

### Railway: Only One Service Showing
Railway doesn't auto-detect monorepo services. You must:
1. Create services manually
2. Set "Root Directory" for each service

### Netlify: GitHub Connection Broken
1. Go to Netlify Team Settings → Git → GitHub
2. Disconnect and reconnect
3. Re-authorize repository access

### Mobile: Build Failing
1. Check EAS dashboard for logs
2. Ensure Expo SDK version compatibility
3. Run `eas credentials` to fix signing issues

## File Structure

```
mari/
├── .github/
│   └── workflows/
│       ├── railway-deploy.yml    # Auto-deploy to Railway
│       ├── netlify-deploy.yml    # Auto-deploy to Netlify
│       └── mobile-build.yml      # Build mobile apps
├── athena-platform/
│   ├── client/                   # Next.js web app
│   │   ├── railway.json
│   │   ├── netlify.toml
│   │   └── nixpacks.toml
│   ├── server/                   # Express API
│   │   ├── railway.json
│   │   └── nixpacks.toml
│   └── mobile/                   # React Native app
│       ├── eas.json
│       └── app.json
├── netlify.toml                  # Root Netlify config
├── railway.toml                  # Root Railway config
├── RAILWAY_SETUP.md
├── NETLIFY_SETUP.md
├── MOBILE_BUILD_GUIDE.md
└── DEPLOYMENT_GUIDE.md           # This file
```

## Support

For deployment issues:
1. Check the specific guide for your platform
2. Review build logs
3. Verify environment variables
4. Check service health endpoints (`/health` for API)
