# Neon Setup (database)

Neon hosts the ATHENA PostgreSQL database. It replaced the Railway PostgreSQL
add-on, and nothing in the platform talks to Railway any more.

Neon is a database only. The Express API still needs an always-on Node host and
the web app runs on Netlify; both are covered in
[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). This guide is the database side.

## 1. Create the project

1. Sign in at https://console.neon.tech and create a project.
2. Region: **AWS ap-southeast-2 (Sydney)**. ATHENA's audience is in Queensland
   and the existing database already lives in that region.
3. Postgres 16. Keep the default database name unless you have a reason not to.

## 2. The two connection strings

Every Neon branch exposes the same database on two hostnames, and the platform
needs both:

| Endpoint | Hostname looks like | Used for | Variable |
|---|---|---|---|
| Pooled | `ep-xxxx-pooler.ap-southeast-2.aws.neon.tech` | Runtime traffic from the API. Sits behind PgBouncer, so many short-lived connections are cheap. | `DATABASE_URL` |
| Direct | `ep-xxxx.ap-southeast-2.aws.neon.tech` | Prisma migrations and schema tooling. DDL and Prisma's advisory locks need a real session, which the pooler does not provide. | `DIRECT_DATABASE_URL` |

Both must carry `?sslmode=require&channel_binding=require`. The server refuses
to start in production without `sslmode=require` on a Neon URL.

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15&pool_timeout=15"
DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15"
```

Copy them from **Neon console → your project → Connect**; the "Pooled
connection" toggle switches between the two.

The server normalises whatever it is given in
`athena-platform/server/src/utils/database-url.ts`: it adds the timeouts, and if
`DIRECT_DATABASE_URL` is missing it derives one by dropping `-pooler` from the
hostname and logs a warning. Set it explicitly in production anyway; a derived
value is a guess.

## 3. Where the strings go

| Place | Variables | Why |
|---|---|---|
| API host environment | `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL` (direct) | Runtime queries use the pooled URL. `start.ts` runs `prisma migrate deploy` at boot through the direct one. |
| GitHub repository secrets | `NEON_DIRECT_DATABASE_URL` (direct) | The "Build and Deploy" workflow migrates the database on every push to `main`. `DIRECT_DATABASE_URL` is accepted as an alias. |
| Local `.env` in the server package | `DATABASE_URL`, `DIRECT_DATABASE_URL` | Development against your own Neon branch (section 6). |
| Netlify | nothing | The web tier never opens a database connection. Every `/api` request is proxied to the API host. |

## 4. Apply the schema

```bash
cd athena-platform/server
npm ci
npx prisma generate
npm run db:migrate:deploy
```

`db:migrate:deploy` applies the migration files under `prisma/migrations` and
never diffs the live schema. Do **not** run `npm run db:migrate` or
`npm run db:push` against a shared Neon database: the database contains tables
this repository does not model, and either command plans to drop them. Both are
blocked by a guard; the reasons are in
[athena-platform/docs/runbooks/SHARED-DATABASE-HAZARD.md](athena-platform/docs/runbooks/SHARED-DATABASE-HAZARD.md).

## 5. Verify

```bash
# From athena-platform/server, with DIRECT_DATABASE_URL set
npx prisma migrate status

# Once the API is up
curl https://api.your-domain.com/readyz
# {"status":"ready","database":"connected"}
```

## 6. Branches for development and previews

Neon branches are copy-on-write. Create one per developer, or per pull request,
from the console or the CLI, and put its two URLs in your local `.env`. Work on
a branch never touches production data, and a branch can be reset from its
parent in seconds.

## 7. Backups and restore

Neon keeps point-in-time history for every branch (the retention window depends
on the plan) and can restore a branch to any moment inside it from the console.
For an off-platform copy before a risky change:

```bash
pg_dump "$DIRECT_DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `prepared statement "s0" already exists`, or `migrate deploy` hangs | Migrations were run through the pooled URL | Point `DIRECT_DATABASE_URL` at the direct hostname (no `-pooler`) |
| `too many connections` at runtime | The API is using the direct URL for traffic | Put the pooled URL in `DATABASE_URL` |
| `getaddrinfo ENOTFOUND ep-....neon.tech` | No network path to Neon, or a typo in the hostname | Check DNS from the host; copy the hostname again from the console |
| First request after idle is slow | The compute was suspended (scale to zero) and is waking | Expected on free and low tiers. `connect_timeout=15` covers the wake; raise the minimum compute in the console if it matters |
| `sslmode` errors | A URL without `sslmode=require` | Add both query parameters from section 2 |
