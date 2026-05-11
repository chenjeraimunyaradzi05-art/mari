# Neon Database Setup

ATHENA now expects a Neon-hosted PostgreSQL database for production.

## Required Variables

Set these variables on the backend deployment platform:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@ep-example-pooler.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15"
DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15"
```

Use the pooled Neon URL for `DATABASE_URL`. It has `-pooler` in the hostname and is used by the running API.

Use the direct, unpooled Neon URL for `DIRECT_DATABASE_URL`. Prisma migrations and schema tooling use this connection.

The Prisma schema now declares `directUrl = env("DIRECT_DATABASE_URL")`, so keep `DIRECT_DATABASE_URL` set anywhere Prisma commands run. For local Docker Postgres, it can be the same value as `DATABASE_URL`.

## Netlify Sync Script

From the repository root, this command writes the Neon variables into Netlify without committing secrets:

```bash
NETLIFY_AUTH_TOKEN="..." \
NETLIFY_SITE_ID="..." \
NEON_DATABASE_URL="postgresql://USER:PASSWORD@ep-example-pooler.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15" \
NEON_DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/athena_prod?sslmode=require&channel_binding=require&connect_timeout=15" \
npm run netlify:link-neon
```

To sync the variables and immediately trigger a production Netlify deploy, run:

```bash
npm run netlify:deploy
```

The script uses Netlify CLI `env:set` with production context, build/function scopes, and secret storage for database URLs.

## GitHub Actions

For migration deploys, add either:

```bash
DIRECT_DATABASE_URL=<your unpooled Neon URL>
```

or, as a fallback:

```bash
DATABASE_URL=<your unpooled Neon URL>
```

The workflow prefers `DIRECT_DATABASE_URL` when it is available.

## Local Development

Local development can keep using Docker Postgres:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/athena_dev"
```

If you point local development at Neon, include `sslmode=require` and prefer a separate Neon branch for development.
