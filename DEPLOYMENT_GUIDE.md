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
| API server | **Render or Fly.io** | Express with Socket.IO, BullMQ workers and scheduled jobs needs a long-running process, which Neon does not provide and Netlify Functions cannot hold. The repo ships `athena-platform/server/Dockerfile` plus a ready configuration for each host: `render.yaml` at the repository root, `athena-platform/server/fly.toml` beside the Dockerfile. Any other always-on Node 20 host works too. Railway is no longer used. |
| Web client | **Netlify** | Next.js on the Netlify runtime plugin. Every `/api` request is proxied in-app to the API host, so the browser only ever talks to the Netlify origin. |

> **The API must be deployed before the web app is of any use.** For a long
> while it was not deployed at all: the Netlify site was live, and every
> `/api/*` request on it returned a 500 because the proxy was still pointed at
> `localhost:5000`. A green Netlify build is not a working platform. Finish
> step 2 below, then check
> `curl https://athena-empress.netlify.app/api/health`.

## Quick Start Deployment

### 1. Database (Neon)

Follow [NEON_SETUP.md](NEON_SETUP.md). You come out of it with a pooled
`DATABASE_URL` and a direct `DIRECT_DATABASE_URL`.

#### There is one environment, and Neon branches are how you get a second

Worth saying plainly before anything else, because the rest of this guide reads
differently once you know it: there is no staging deployment. One Render
service, one Netlify site, one Neon database, all of them production. Nothing
below creates a second one.

What Neon gives you instead is branching, and it is enough for the case that
actually matters — rehearsing a migration against real data before it touches
the real database. A branch is a copy-on-write clone: instant, free until it is
written to, and carrying production's row counts rather than an empty schema's.

```bash
# Neon console → Branches → New branch → from production
# or:
neonctl branches create --name migration-rehearsal

# From athena-platform/server, with the branch's connection string:
STAGING_DATABASE_URL="postgresql://...neon.tech/athena?sslmode=require" \
  node scripts/migration-dry-run.js

# Delete the branch when you are done.
```

`STAGING_DATABASE_URL` appears in no `.env.example` on purpose: it is not a
standing value, it is the branch you made for that rehearsal. The script used to
throw a bare "STAGING_DATABASE_URL is required", which sent people looking for
an environment that does not exist; it now says this.

CI is the other half, and it runs on every push without anyone remembering to:
the server job applies `prisma migrate deploy` to a throwaway Postgres and then
`prisma migrate diff --exit-code` against `schema.prisma`, so migration SQL that
is simply broken, and a schema edit that shipped without its migration, both
fail before merge. The branch rehearsal is for the thing CI cannot see — how a
migration behaves against three years of rows.

Read [SHARED-DATABASE-HAZARD](athena-platform/docs/runbooks/SHARED-DATABASE-HAZARD.md)
before pointing a local checkout at any of these URLs.

### 2. API Server

Both hosts build `athena-platform/server/Dockerfile`, whose `CMD` is
`node dist/start.js` — it applies the Prisma migrations and then boots the
server. `/health` and `/livez` answer as soon as the process is listening;
`/readyz` answers 200 only once the database is reachable.

Deploy to **one** of the two. Two API deployments against one Neon database
will both run migrations and both run the scheduled jobs.

#### Option A — Render (`render.yaml`)

1. In [Render](https://dashboard.render.com), choose **New → Blueprint** and
   pick this repository. Render reads `render.yaml` from the root and proposes
   the `athena-api` web service and the `athena-redis` Key Value instance.
2. It will prompt for every value marked `sync: false`. The ones without which
   the service will not start are `DATABASE_URL`, `DIRECT_DATABASE_URL` and
   `DV_ENCRYPTION_KEY`; the rest turn features on. `JWT_SECRET`,
   `METRICS_TOKEN` and `HEALTH_DIAGNOSTICS_TOKEN` are generated by Render, so
   leave them alone. See [Environment Variables](#environment-variables) below
   for what each one is.
3. Apply. The first build takes several minutes because the image compiles
   `sharp`.
4. `render.yaml` sets `autoDeploy: false` on purpose, so nothing redeploys on a
   push while CI is still testing it. Copy the service's **Deploy Hook** URL
   from Settings and add it as the `RENDER_DEPLOY_HOOK_URL` repository secret;
   the release workflow then deploys the API itself once CI is green.

#### Option B — Fly.io (`athena-platform/server/fly.toml`)

```bash
cd athena-platform/server
fly launch --no-deploy --copy-config     # first time only; keeps fly.toml
fly secrets set \
  DATABASE_URL='<Neon pooled URL>' \
  DIRECT_DATABASE_URL='<Neon direct URL>' \
  JWT_SECRET="$(openssl rand -hex 32)" \
  DV_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  METRICS_TOKEN="$(openssl rand -hex 32)" \
  HEALTH_DIAGNOSTICS_TOKEN="$(openssl rand -hex 32)" \
  REDIS_URL='<Upstash or Fly Redis URL>'
fly deploy
```

`fly.toml` sits next to the `Dockerfile` because `fly deploy` builds from the
directory it runs in. Everything non-secret is already in its `[env]` block;
everything secret goes through `fly secrets set`, which is encrypted at rest
and restarts the machines. Add the rest of the keys from
[Environment Variables](#environment-variables) the same way.

`auto_stop_machines` is off: the process is not only a web server, it holds the
BullMQ workers and the Brisbane-time scheduled jobs, and a machine that sleeps
between requests simply does not run them.

#### Then, for either host

1. Note the public HTTPS URL. Everything below calls it
   `https://api.your-domain.com`.
2. Check it: `curl https://api.your-domain.com/readyz` should return
   `{"status":"ready",...}`. A 503 means the database is unreachable.
3. Run `npm run check:env -- .env.production` against the file you loaded, or
   read `/health/launch-readiness` on the deployed API, to see which optional
   integrations are still unconfigured.

### 3. Web Client (Netlify)

1. Go to [Netlify](https://app.netlify.com) and import the repository.
2. Base directory `athena-platform/client`; the build command, publish
   directory and Next.js plugin come from `netlify.toml`.
3. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   NEXT_PUBLIC_APP_URL=https://athena-empress.netlify.app
   ```

`NEXT_PUBLIC_API_URL` is required and has no default. The build fails without
it, by design. It used to fall back to `https://api.athena.app` — a domain
ATHENA does not own, which resolves to a live third party — and because the
variable was in fact unset on the live site, the `/api/auth/login` and
`/api/auth/register` route handlers were forwarding members' email addresses
and passwords to it. A build that stops and names the variable is the correct
outcome; a build that guesses is how that happened.

Details in [NETLIFY_SETUP.md](NETLIFY_SETUP.md).

### 4. Mobile Apps (EAS Build)

The API origin is no longer written into `athena-platform/mobile/eas.json`. The
values that were there named the same third-party domain, so every preview and
production binary was built pointing at a stranger's server. It now comes from
the EAS project's own environment, which is where a value that differs per
deployment belongs:

```bash
cd athena-platform/mobile
npm install -g eas-cli
eas login
eas secret:create --scope project --name API_URL --value https://api.your-domain.com
eas build --platform all --profile preview
```

A build with `API_URL` unset fails in `app.config.js` rather than choosing a
host for you. The `development` profile is the exception: it carries
`http://localhost:5000`, which reaches a simulator on the same machine and
nothing else.

Details in [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md).

## GitHub Actions Workflows

Workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push and pull request to `main` | Typechecks, builds and tests the server and the client; applies the Prisma migrations to a throwaway database and checks they still match `schema.prisma`; runs the API-contract, doc-reference and dead-interaction checks. |
| `build-and-deploy.yml` | **A successful `CI` run on `main`**, or manual | Migrates the Neon database, deploys the API, then builds and publishes the web app to Netlify. Each target runs only when its secrets are set. |
| `netlify-deploy.yml` | Pull request touching the client | Netlify preview deploy. |
| `mobile-build.yml` | Manual, or push to `mobile/**` | EAS builds for iOS and Android. |
| `security-audit.yml` | Weekly | `npm audit` over server, client and mobile. |

The release runs in one order, and each step blocks the next: **migrate the
database → deploy the API → publish the web app**. Migrations are written to be
safe against the code already running, so database-first keeps the site up;
publishing the client first would put it in front of an API that has not caught
up.

`build-and-deploy.yml` waits for `CI` rather than triggering on the push. Two
workflows on one event do not queue behind each other, so the old arrangement
ran `prisma migrate deploy` against the production Neon database at the same
moment CI was deciding whether that commit was any good — and usually finished
first, because CI builds the client and runs Playwright. A commit could migrate
production and then fail its own tests.

If you deploy the API on a host that builds from GitHub with auto-deploy on,
turn auto-deploy off: it fires on the push and reintroduces exactly that race.
`render.yaml` already sets `autoDeploy: false` for this reason.

### Required GitHub Secrets

| Secret | Used by | Where to get it |
|---|---|---|
| `NEON_DIRECT_DATABASE_URL` | Migrate job | Neon console, Connect, with pooling **off**. `DIRECT_DATABASE_URL` is accepted as an alias. |
| `RENDER_DEPLOY_HOOK_URL` | API deploy job | Render, the `athena-api` service, Settings, Deploy Hook. Omit it on Fly.io and run `fly deploy` yourself. |
| `NETLIFY_AUTH_TOKEN` | Netlify deploys | app.netlify.com, User Settings, Applications |
| `NETLIFY_SITE_ID` | Netlify deploys | Site Settings, General, Site ID |
| `NEXT_PUBLIC_API_URL` | Netlify deploys | The API host's public URL. Required — the build fails without it. |
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
JWT_SECRET=<openssl rand -hex 32>
DV_ENCRYPTION_KEY=<openssl rand -hex 32, exactly 64 hex characters>
CLIENT_URL=https://athena-empress.netlify.app
ALLOWED_ORIGINS=https://athena-empress.netlify.app
# PORT: most hosts inject it; the server defaults to 5000
```

`DATABASE_URL` is the **pooled** Neon endpoint and `DIRECT_DATABASE_URL` the
**direct** one. `start.ts` runs the migrations through the direct URL, because
PgBouncer in transaction mode cannot hold the advisory locks Prisma migrations
take; putting the pooled URL in both is what makes a deploy hang.

`DV_ENCRYPTION_KEY` encrypts the domestic-violence safe-chat messages and the
wellness records, and `dv-safe.service.ts` refuses it in production unless it is
64 hex characters. Back it up somewhere the API host cannot take with it:
without this exact value, those rows cannot be read again.

There is no `TRUST_PROXY` variable, despite what earlier versions of this guide
said — nothing under `src/` reads one. `src/index.ts` sets
`app.set('trust proxy', 1)` unconditionally, which is right for a single
reverse proxy in front of the process; Render, Fly and Netlify each put exactly
one there.

### API Server (also required in production)

These are separated from the block above only because the server will *boot*
without them. `/health/launch-readiness` marks every one of them `required`
once `NODE_ENV=production`, so a deployment missing any of them answers 503 on
that endpoint and is not launched.

```env
REDIS_URL=redis://...            # BullMQ workers, rate limits and login lockouts
SENDGRID_API_KEY=SG....          # verification and password-reset email
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CAREER=price_...    # and _PROFESSIONAL, _ENTREPRENEUR, _CREATOR
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
S3_BUCKET=athena-uploads
AI_OPENAI_API_KEY=sk-...         # read before OPENAI_API_KEY; also gates text moderation
METRICS_TOKEN=<openssl rand -hex 32>
HEALTH_DIAGNOSTICS_TOKEN=<openssl rand -hex 32>
```

The AWS four used to be listed here as "optional", and that was wrong in a way
that cost member data rather than a feature. `utils/media-storage.ts` writes to
S3 only when `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are *both* present;
without them every avatar, post image, reel and resume is written to `./uploads`
inside the container. Render and Fly replace that container on every deploy, so
the documented "minimal" deployment silently lost every photograph a member had
uploaded each time the API shipped — and a second instance would 404 on the
first one's files. There is no disk mounted in `render.yaml` for exactly this
reason: local media storage is not a mode this platform should run in, so it
should fail readiness rather than lose things quietly.

### API Server (genuinely optional)

```env
SENTRY_DSN=https://...           # error reporting; absence is reported, not fatal
ML_SERVICE_URL=http://...        # feed re-ranking; the feed falls back to engagement order
OPENSEARCH_NODE=https://...      # only read when OPENSEARCH_ENABLED=true
EXPO_ACCESS_TOKEN=...            # only with Expo enhanced push security
```

"Optional" here means the server starts without them, the features they carry
run in their not-configured branch, and `/health/launch-readiness` reports them
as recommended rather than required.

### Where each value comes from

`render.yaml` is the authoritative list: every variable the API reads is
declared there with a comment saying what it does and whether Render can invent
it (`generateValue: true`), derive it (`fromService`) or has to be given it
(`sync: false`). `athena-platform/server/fly.toml` carries the non-secret half
for the Fly path. Run
`npm run check:env -- <file>` from `athena-platform/server` against whatever env
file you are about to load: it reports every variable production requires and
does not have, every one set to an obvious placeholder, and every one set that
no code under `src/` reads any more — which is how the last round of drift
(`STRIPE_PRICE_STARTER`, `OPENSEARCH_URL`, the SES keys) went unnoticed.

The same script runs in CI, against `render.yaml` rather than against an env
file: a blueprint declares the *names* production will be given without holding
any of the values, which is exactly the half that drifts. So a variable added to
`src/` without being added to the blueprint now fails the build, instead of
being discovered on the host at three in the morning. Nothing in CI reads a
secret to do it.

### Web Client (required)

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_URL=https://athena-empress.netlify.app
```

`NEXT_PUBLIC_API_URL` has no default and the build stops without it. Set it
everywhere the client is built: the Netlify site environment, the
`NEXT_PUBLIC_API_URL` repository secret for the two deploy workflows, and your
own shell for a local `npm run build`. `next dev` needs nothing — development
assumes `http://localhost:5000`.

### Web Client (optional)

```env
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com   # defaults to NEXT_PUBLIC_API_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

## Troubleshooting

### `/api/*` returns 500 with "connection refused to 127.0.0.1:5000"
The API is not deployed, or `NEXT_PUBLIC_API_URL` was unset when the site was
built so the proxy fell through to the development default. Do step 2, set the
variable, redeploy. `curl https://athena-empress.netlify.app/api/health` should
return the API's health payload.

### The Netlify build fails with "NEXT_PUBLIC_API_URL is not set"
Working as intended. Set it in the Netlify site environment (and as the
repository secret of the same name, for the workflow deploys) and build again.
The variable used to have a default; the default pointed at a domain ATHENA
does not own, and the login handler was sending members' passwords to it.

### The API starts but `/readyz` is 503
The database is unreachable. Check `DATABASE_URL` on the host and the compute
state in the Neon console. The troubleshooting table in
[NEON_SETUP.md](NEON_SETUP.md) covers the common messages.

### Migrations fail on deploy
`start.ts` runs them through `DIRECT_DATABASE_URL`. If that is the pooled URL
they will hang or fail; use the direct hostname.

A migration that fails at boot stops the process rather than continuing into an
unknown schema, so the host will report a crash loop and the previous release
stays up. Read the container log for the Prisma error, fix the migration, and
deploy again. CI applies the same migrations to a throwaway database on every
push, so a migration that fails here should have failed there first — if it did
not, the two databases disagree about what has already been applied.

### "Build and Deploy" did not run after a push to main
It waits for `CI` to finish and only proceeds on success. Check the `CI` run for
that commit first. A red CI run is meant to stop the release — that is the whole
point of the dependency.

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
│   ├── server/                    # Express API (Render or Fly.io)
│   │   ├── Dockerfile
│   │   ├── fly.toml               # Fly.io config; beside the Dockerfile
│   │   ├── prisma/                # Schema and hand-written migrations
│   │   └── .env.production.template
│   └── mobile/                    # React Native app
│       ├── eas.json
│       └── app.json
├── render.yaml                    # Render blueprint for the API
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
