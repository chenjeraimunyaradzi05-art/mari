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
