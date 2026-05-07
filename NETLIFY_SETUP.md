# Netlify Setup Guide for ATHENA Platform

## Overview
This guide explains how to deploy the ATHENA web frontend to Netlify.

## Prerequisites
- Netlify account (https://netlify.com)
- GitHub repository connected
- backend API service deployed and running

## Quick Setup

### Step 1: Connect Repository to Netlify
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose "Deploy with GitHub"
4. **Authorize Netlify** if prompted (this may be why your connection is broken)
5. Select your `mari` repository

### Step 2: Configure Build Settings
When configuring the site:
- **Base directory**: `athena-platform/client`
- **Build command**: `npm ci --legacy-peer-deps && npm run build`
- **Publish directory**: leave empty (`@netlify/plugin-nextjs` manages this)
- **Functions directory**: Leave empty (Next.js plugin handles this)

### Step 3: Add Environment Variables
Go to Site Settings → Environment Variables and add:

```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com
NODE_VERSION=20
NPM_FLAGS=--legacy-peer-deps
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx (if using Stripe)
```

### Step 4: Install Next.js Plugin
1. Go to Site Settings → Build & deploy → Plugins
2. Search for "@netlify/plugin-nextjs"
3. Install the plugin

### Step 5: Trigger Deploy
1. Go to Deploys tab
2. Click "Trigger deploy" → "Deploy site"

## Troubleshooting Netlify Connection

### "Connection to GitHub Broken" Error

This usually happens when:

1. **GitHub App permissions expired/revoked**
   - Go to GitHub → Settings → Applications → Authorized OAuth Apps
   - Find Netlify and click "Revoke"
   - Go back to Netlify and re-authorize

2. **Repository access changed**
   - Go to GitHub → Settings → Applications → Installed GitHub Apps
   - Find Netlify and click "Configure"
   - Ensure your repository has access

3. **Re-link the repository**
   - In Netlify: Site Settings → Build & deploy → Continuous Deployment
   - Click "Link to Git"
   - Re-authorize and select the repository

### Build Failing

1. **Check build logs** in Netlify Deploys tab
2. **Common issues**:
   - Missing environment variables
   - Node version mismatch (ensure `NODE_VERSION=20`)
   - Dependency installation failures (`--legacy-peer-deps`)

### Site Shows 404 or Blank Page

1. Ensure the Next.js plugin is installed
2. Check that publish directory is `.next` (not `out`)
3. Verify redirects in netlify.toml

## Configuration Files

### Root netlify.toml (mari/netlify.toml)
Used when deploying from repository root:
```toml
[build]
  base = "athena-platform/client"
  command = "npm ci --legacy-peer-deps && npm run build"
```

### Client netlify.toml (athena-platform/client/netlify.toml)
Used when base directory is set in Netlify:
```toml
[build]
  command = "npm ci --legacy-peer-deps && npm run build"
```

### Current Routing Model

- Auth requests under `/api/auth/*` are handled by Next.js route handlers so cookies can be forwarded correctly.
- Non-auth API traffic is handled by the client runtime and backend URL environment configuration.
- Uploads are served through the Next.js uploads route.
- Socket.IO should connect directly to the backend host using `NEXT_PUBLIC_SOCKET_URL`.

## Deployment Options

### Option A: Deploy from Root (Recommended)
- Set base directory to `athena-platform/client` in Netlify
- Uses root `netlify.toml` configuration

### Option B: Deploy via GitHub Actions
- Uses `.github/workflows/netlify-deploy.yml`
- Requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` secrets
- More control over build process

### Option C: Netlify CLI
```bash
# Install CLI
npm install -g netlify-cli

# Login
netlify login

# Link to site
cd athena-platform/client
netlify link

# Deploy
netlify deploy --prod
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | backend API URL (e.g. `https://api.your-domain.com`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your Netlify site URL |
| `NEXT_PUBLIC_SOCKET_URL` | Recommended | Backend realtime origin; defaults to `NEXT_PUBLIC_API_URL` |
| `NODE_VERSION` | Yes | Set to `20` |
| `NPM_FLAGS` | Recommended | Set to `--legacy-peer-deps` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog analytics key |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry error tracking |

## Re-Authorizing GitHub Connection

If your GitHub connection is broken:

1. **In Netlify**:
   - Go to Team Settings → Git → GitHub
   - Click "Disconnect" (if shown)
   - Click "Connect to GitHub"
   - Complete the OAuth flow

2. **In GitHub**:
   - Go to Settings → Integrations → Applications
   - Under "Installed GitHub Apps", find Netlify
   - Click Configure → Add your repository

3. **Verify Connection**:
   - In Netlify, go to your site's settings
   - Build & deploy → Continuous Deployment
   - Should show "Linked to [your-repo]"

## Custom Domain Setup

1. Go to Site Settings → Domain management
2. Click "Add custom domain"
3. Follow DNS configuration instructions
4. Enable HTTPS (automatic with Let's Encrypt)

## Monitoring

- **Build status**: Check Deploys tab for build logs
- **Performance**: Use Netlify Analytics (paid feature)
- **Errors**: Configure Sentry for error tracking
