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
   the service will not start (`src/utils/env.ts` exits) are `DATABASE_URL`,
   `DIRECT_DATABASE_URL`, `DV_ENCRYPTION_KEY`, `API_URL` (this service's public
   https address), `PROXY_SHARED_SECRET` (the same value you give Netlify),
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `S3_BUCKET`; `REDIS_URL`
   comes from the blueprint's Key Value instance. The rest turn features on. `JWT_SECRET`,
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
  REDIS_URL='<Upstash or Fly Redis URL>' \
  API_URL='https://<app>.fly.dev' \
  PROXY_SHARED_SECRET='<the value you also give Netlify>' \
  AWS_ACCESS_KEY_ID='<key id>' \
  AWS_SECRET_ACCESS_KEY='<secret>' \
  S3_BUCKET='<bucket name>'
fly deploy --ha=false
fly status                                 # must list exactly one machine
```

**One machine, always.** `--ha=false` matters: the first `fly deploy` of an app
with an HTTP service otherwise creates two machines, and `fly.toml` has no
setting that caps the count. Socket.IO has no Redis adapter in this codebase, so
with two machines a chat message, a typing indicator or a live notification
emitted on one never reaches a member connected to the other, and nothing logs
it. If `fly status` shows two, `fly scale count 1`. Render is held to one
instance by `render.yaml` for the same reason.

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
   PROXY_SHARED_SECRET=<the API's value, 32+ characters>
   ```
   Give `PROXY_SHARED_SECRET` the **Builds** and **Functions** scopes (Netlify's
   default is every scope). The web host refuses to serve in production
   without it (`client/instrumentation.ts`), and the build checks for it first
   (`client/scripts/check-web-env.js`) and stops, so a deploy missing it never
   replaces the one that is serving. Without it the API sees every visitor as
   the Netlify host: one login budget for the whole site, a lockout that locks
   everyone out at once, and no new-device alerts.

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
| `ci.yml` | Push and pull request to `main` | Typechecks, builds and tests the server and the client; runs the ML service's pytest suite; checks and unit-tests the alert rules in `athena-platform/infrastructure/monitoring/` with promtool; applies the Prisma migrations to a throwaway database and checks they still match `schema.prisma`; runs the API-contract, doc-reference and dead-interaction checks. |
| `build-and-deploy.yml` | **A successful `CI` run on `main`**, or manual | Migrates the Neon database, deploys the API, then builds and publishes the web app to Netlify. Each target runs only when its secrets are set. |
| `netlify-deploy.yml` | Pull request touching the client | Netlify preview deploy. |
| `e2e.yml` | Push to `main`, or manual | The browser journey against a live stack: Postgres from the migrations, the API from this commit, fixtures from `server/scripts/seed-e2e.js`, then `tests/critical-paths.spec.ts` (register, find a mentor, request a session, search jobs). Separate from CI, so it does not gate releases until it has passed on `main` once; then move it into `ci.yml`. |
| `mobile-build.yml` | Manual, or push to `mobile/**` | EAS builds for iOS and Android; a manual `production` run also submits to the stores. |
| `security-audit.yml` | Weekly | `npm audit` over server, client and mobile. |
| `uptime.yml` | Every 15 minutes | Asks the API's `/readyz` and the site's `/api/health`; opens a "Production is down" issue after three failures and closes it on recovery. Skipped until `PRODUCTION_API_URL` is set. Not a pager — see `athena-platform/docs/runbooks/ONCALL.md`. |
| `backup.yml` | Nightly at 02:40 Brisbane time, or manual | The off-platform copy of the production database: `pg_dump` inside a snapshot, restored into a throwaway Postgres and compared table by table, sealed with age to the key holders' public keys, uploaded to a bucket whose lifecycle rule enforces the retention period. Its settings live in the `production-backups` environment, not in the secrets below; until the owner has decided the retention period and the key holders and set that environment up, every run fails and opens one "Database backup failed" issue. Setup and restore: `athena-platform/docs/runbooks/ONCALL.md`, "Backups and restore". |

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
| `EAS_PROJECT_ID` | Mobile builds and submissions | The id `eas init` prints in `athena-platform/mobile`. With `EXPO_TOKEN` set and this missing, the mobile workflow fails and says so. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Android store submission | The Google Play service-account JSON key, pasted whole. Or upload it with `eas credentials` and set the `EAS_HOLDS_GOOGLE_SERVICE_ACCOUNT` variable to `true` instead. |
| `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | iOS store submission, when signing in with an Apple ID | appleid.apple.com, Sign-In and Security, App-Specific Passwords. Not needed when an App Store Connect API key is stored on the EAS project. |

### Repository variables

Not secret — they are public identifiers and URLs — so they live under
Settings → Secrets and variables → Actions → **Variables**.

| Variable | Used by | Value |
|---|---|---|
| `MOBILE_API_URL` | Mobile builds and submissions | The API origin, the same as the EAS project's `API_URL` secret. The runner needs its own copy to evaluate `app.config.js`, which refuses to run without one. |
| `ASC_APP_ID` | iOS store submission | App Store Connect, the app, App Information, "Apple ID" (a number). |
| `APPLE_TEAM_ID`, `APPLE_ID` | iOS store submission (optional) | developer.apple.com, Membership; and the Apple ID email with App Manager rights. |
| `EAS_HOLDS_GOOGLE_SERVICE_ACCOUNT` | Android store submission | `true` once the key is uploaded to EAS, if the `GOOGLE_SERVICE_ACCOUNT_KEY` secret is not used. |
| `PRODUCTION_API_URL` | Uptime | The API origin. The uptime workflow is skipped until it is set. |
| `PRODUCTION_SITE_URL` | Uptime (optional) | The Netlify site, to check the web tier's proxy as well. |

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
API_URL=https://api.your-domain.com       # this API's own public address, not localhost
PROXY_SHARED_SECRET=<openssl rand -hex 32; the same value on Netlify>
REDIS_URL=redis://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
S3_BUCKET=athena-uploads
# PORT: most hosts inject it; the server defaults to 5000
```

In production the process refuses to start without any of these
(`src/utils/env.ts`), and holds the AWS values to the shape AWS issues, so the
placeholders from an env template stop it too. That is deliberate: each of
them missing used to mean a server that started and then did the wrong thing
quietly, from one shared login budget for every visitor to members'
photographs written to a disk the next deploy wiped.

`DATABASE_URL` is the **pooled** Neon endpoint and `DIRECT_DATABASE_URL` the
**direct** one. `start.ts` runs the migrations through the direct URL, because
PgBouncer in transaction mode cannot hold the advisory locks Prisma migrations
take; putting the pooled URL in both is what makes a deploy hang.

`DV_ENCRYPTION_KEY` seals the domestic-violence safe-chat messages, the
wellness records, members' safety plans and two-factor seeds before they reach
the database. Production refuses to start unless it is 64 hex characters and a
random value: all zeros, a placeholder and a repeating pattern are refused, and
so is the all-zero value the example env file used to ship. Back it up somewhere
the API host cannot take with it: without this exact value, those rows cannot be
read again. This is encryption at rest, not end-to-end: the servers decrypt a
value to show it to the member. What it does and does not protect against, and
how to rotate the key without losing anything, is in
`athena-platform/docs/runbooks/ENCRYPTION.md`.

`ALLOWED_ORIGINS` is the whole CORS allowlist; add a custom domain here when the
site moves. Do not reach for `CORS_ALLOW_PREVIEW_ORIGINS=true` to make a Netlify
deploy preview talk to production. It does not admit this site's previews — it
admits every `https://<anything>.netlify.app` origin, and anyone can register
one for free — with credentialed CORS and on the socket. On any deployment
where the browser holds a cookie for the API's own origin (`COOKIE_SAMESITE=none`,
the browser-calls-the-API-directly setup), a stranger's Netlify page can then
act as the signed-in member and read the answers. Point previews at a staging
API instead.

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
SENDGRID_API_KEY=SG....          # verification and password-reset email
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...  # the Connect endpoint's own secret; see below
STRIPE_PRICE_CAREER=price_...    # and _PROFESSIONAL, _ENTREPRENEUR, _CREATOR; each an AUD price with tax behaviour "Inclusive"
ATHENA_LEGAL_NAME=               # who ATHENA is on an invoice; with the four below, see "Invoices and GST"
ATHENA_ABN=
ATHENA_GST_REGISTERED_FROM=      # YYYY-MM-DD, only once registered for GST
ATHENA_BILLING_ADDRESS=          # lines separated by |
ATHENA_BILLING_EMAIL=            # a mailbox ATHENA owns
AI_OPENAI_API_KEY=sk-...         # read before OPENAI_API_KEY; also gates text moderation
METRICS_TOKEN=<openssl rand -hex 32>
HEALTH_DIAGNOSTICS_TOKEN=<openssl rand -hex 32>
```

Two Stripe webhook endpoints, two secrets. The platform endpoint
(`STRIPE_WEBHOOK_SECRET`) carries the platform's own events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`customer.subscription.trial_will_end` (the reminder before a trial's first charge),
`invoice.paid`, `invoice.payment_failed`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, `payment_intent.canceled`,
`payment_intent.amount_capturable_updated`, `charge.refunded`, `charge.dispute.created`,
`charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`,
`charge.dispute.funds_reinstated`, `transfer.created`, `transfer.reversed` and
`identity.verification_session.verified` / `.requires_input`. Connected-account
events — `payout.paid`, `payout.failed`, `account.updated` — arrive on a
second endpoint that you create in the Stripe dashboard with "Listen to events
on Connected accounts" ticked, and that endpoint has its own signing secret,
`STRIPE_CONNECT_WEBHOOK_SECRET`. Without it those events are refused, and a
seller whose payout failed or whose account Stripe stopped paying is told
nothing. The payments code has never been run against real Stripe: walk
`athena-platform/docs/runbooks/STRIPE-CONNECT.md` in test mode, and then once
live, before announcing payouts. It is also where the payout schedule is decided
(`STRIPE_CONNECT_PAYOUT_SCHEDULE=manual` creates new accounts on a manual
schedule, so a balance waits until the member presses Withdraw).

A process with no `STRIPE_SECRET_KEY` starts and says so at every boot, and every
payment, payout and Connect action answers 503; nothing is simulated in its place.
`ALLOW_STRIPE_SIMULATION=true` in production stops the process starting, and
`scripts/check-env.js` fails a file that carries it.

Invoices and GST. Every paid membership period and every one-off payment gets an
ATHENA invoice (a PDF, numbered INV-YYYYMM-NNNNN). Who is invoicing comes from
`ATHENA_LEGAL_NAME`, `ATHENA_ABN`, `ATHENA_BILLING_ADDRESS` and
`ATHENA_BILLING_EMAIL`, which have no defaults: until all four are set no
document is produced (a member's download answers 503 and the staff re-issue with
an email is refused), and `/health/launch-readiness` fails in production. The
invoice rows are still filed as sales happen, and the PDF is drawn from the row on
every download, so each can be downloaded the day the four are set. The ABN has to
pass its checksum and the billing mailbox has to be on a domain ATHENA owns. A
document is titled "Tax invoice",
shows the ABN and the GST amount, and says the total includes GST, only when
`ATHENA_ABN` passes its checksum and `ATHENA_GST_REGISTERED_FROM` has arrived, and
only for a sale in Australian dollars. Until then it is titled "Invoice" and says
no GST is charged, and the pricing page says the same. GST is worked out as one
eleventh of the amount charged, which is only right if the Stripe Prices were
created tax-inclusive. Mentor and marketplace payments are receipts for the
provider's own supply and show no GST. Registering for GST is compulsory once turnover
reaches A$75,000 a year (optional before); confirm the date with the ATO or the
accountant before setting it.

Card holds. A hold on a card lasts about a week with a live processor. A
marketplace order that takes longer asks its buyer to renew the hold in the last two
days (nothing is taken by renewing); the provider cannot hand the work over against a
hold that has ended. `ESCROW_CAPTURE_BEFORE_EXPIRY` (default off) lets the sweep take
the money early for work its flow records as done, and
`ESCROW_REQUEST_EXTENDED_AUTHORISATION` (default off) asks the card network for a
longer authorisation where it is available; check both with the owner and with
Stripe before turning them on.

Moderation is a switch, and its production default is on. With no text
moderation provider configured (`AI_OPENAI_API_KEY`), the server used to
publish every post unscreened; now `MODERATION_REQUIRED` decides. It defaults
to `public` in production, which refuses public posts, comments, profile edits
and image uploads with a 503 ("publishing is paused") until a provider is
configured, and lets private messages through. `all` refuses messages too;
`off` publishes unscreened, which must be an explicit decision. So a
production deployment without `AI_OPENAI_API_KEY` must either add the key or
set `MODERATION_REQUIRED=off` deliberately — otherwise every member's first
post fails the moment it goes live.

The AWS values used to be listed as "optional", and that was wrong in a way
that cost member data rather than a feature. `utils/media-storage.ts` writes to
S3 only when `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are *both* present;
without them every avatar, post image, reel and resume is written to `./uploads`
inside the container. Render and Fly replace that container on every deploy, so
the documented "minimal" deployment silently lost every photograph a member had
uploaded each time the API shipped — and a second instance would 404 on the
first one's files. There is no disk mounted in `render.yaml` for exactly this
reason: local media storage is not a mode this platform runs in. They are now
required at boot, and set is not the same as working, so the API also asks S3
at start whether the bucket answers; `/health/launch-readiness` reports that
answer (`MEDIA_STORAGE`) rather than whether the variables are filled in.

Two kinds of file live in the bucket. Avatars, covers, posts, videos, thumbnails,
captions and sounds are public and are served through `CDN_URL`. Résumés and
documents are private: they are addressed at the bucket, never the CDN, and read
only through the API. So the bucket keeps Block Public Access on and the CDN may
fetch the public folders only. `athena-platform/infrastructure/README.md` ("Media
bucket") has the policy, and `GET /health/launch-readiness?probe=media` with the diagnostics
token proves it from outside once it is set up.

### API Server (genuinely optional)

```env
SENTRY_DSN=https://...           # error reporting; absence is reported, not fatal
ML_SERVICE_URL=http://...        # feed re-ranking; the feed falls back to engagement order
ML_SERVICE_KEY=...               # with ML_SERVICE_URL: the same value on the ML service, which needs it in production
TURNSTILE_SECRET_KEY=...         # sign-up human check; only with NEXT_PUBLIC_TURNSTILE_SITE_KEY on Netlify
OPENSEARCH_NODE=https://...      # leave unset: setting it alone turns OpenSearch on, and nothing backfills its indexes yet
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

`PROXY_SHARED_SECRET` is required too, server-only (no `NEXT_PUBLIC_`), and the
same value as the API's. The Netlify build stops without it; see step 3 above.

### Human check on sign-up (set both or neither)

```env
# API host
TURNSTILE_SECRET_KEY=...
# Netlify
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
```

Both come from one Cloudflare Turnstile widget. The secret alone refuses every
password sign-up, because the form never shows the check and never sends a
token; the site key alone shows a check nobody verifies. Without either,
password sign-up is guarded only by rate limits and email verification, and
`/health/launch-readiness` says so. The site key is baked in at build time, so
setting it needs a new Netlify deploy.

### Web Client (optional)

```env
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com   # defaults to NEXT_PUBLIC_API_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_MEDIA_HOST=cdn.your-domain.com           # the API's CDN_URL host, so next/image loads avatars from it; build time
NEXT_PUBLIC_SENTRY_DSN=https://...   # baked in at build time: set it, then deploy again
SENTRY_ORG=your-org                  # build only: lets the build upload source maps
SENTRY_PROJECT=your-web-project      # build only
SENTRY_AUTH_TOKEN=...                # build only, a secret: a Sentry organisation token (Builds scope)
```

With the DSN and no `SENTRY_AUTH_TOKEN`, errors are still reported but point at
minified code, and `scripts/check-web-env.js` says so in the build log.

## Troubleshooting

### `/api/*` returns 500 with "connection refused to 127.0.0.1:5000"
The API is not deployed, or `NEXT_PUBLIC_API_URL` was unset when the site was
built so the proxy fell through to the development default. Do step 2, set the
variable, redeploy. `curl https://athena-empress.netlify.app/api/health` should
return the API's health payload.

### The Netlify build stops at "check-web-env: PROXY_SHARED_SECRET is not set"
Working as intended: the site that is live stays live. Set `PROXY_SHARED_SECRET`
in the Netlify site environment, the same value as the API's, with the Builds
and Functions scopes, and deploy again. If it is set and the build still says
this, its scope leaves out Builds.

### Every page on the site errors with "PROXY_SHARED_SECRET must be set on the web host"
The variable reached the build but not the functions: add the Functions scope,
or set it for this deploy context, and redeploy.

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
