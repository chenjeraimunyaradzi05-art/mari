# Infrastructure

There is no infrastructure-as-code in this directory, and that is deliberate.
The one thing here is [`monitoring/`](monitoring/README.md): alert rules for a
metrics service that does not exist yet.

It used to hold a `main.tf` describing a platform ATHENA does not run: MySQL 8
on RDS (the API is PostgreSQL through Prisma, and cannot start on MySQL), ECS
Fargate clusters in four AWS regions, an ElastiCache Redis and a media bucket
per region. None of it matched a deployed service, and nothing here or in the
workflows ever applied it. Running `terraform apply` against it would have
built a multi-region estate the API cannot use, and started billing for it.
It was removed rather than corrected, because the real estate below is
described by the files each host actually reads.

## What ATHENA actually runs on

| Part | Host | Described by |
| --- | --- | --- |
| API (Express, Socket.IO, in-process workers) | Render, or Fly.io as the alternative. One instance, and it has to stay one until Socket.IO has a Redis adapter. | [`render.yaml`](../../render.yaml) at the repository root, or [`server/fly.toml`](../server/fly.toml), both building [`server/Dockerfile`](../server/Dockerfile) |
| Redis (rate limits, lockout counters, queues, sweep locks) | Render Key Value, declared in the same blueprint | [`render.yaml`](../../render.yaml) |
| PostgreSQL | Neon, `ap-southeast-2` (Sydney). Migrated by the release workflow before the API deploys. | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma) and `server/prisma/migrations/` |
| Web app (Next.js) | Netlify, with the Next.js runtime plugin | [`netlify.toml`](../../netlify.toml) at the repository root and [`client/netlify.toml`](../client/netlify.toml) |
| Media | One S3 bucket, `S3_BUCKET`, in `ap-southeast-2` | [`server/.env.example`](../server/.env.example) (AWS section) |
| Releases | GitHub Actions: CI, then migrate, deploy the API, publish the web app | [`.github/workflows/build-and-deploy.yml`](../../.github/workflows/build-and-deploy.yml) |
| Uptime check | GitHub Actions on a schedule | [`.github/workflows/uptime.yml`](../../.github/workflows/uptime.yml) |
| Off-platform database copies | GitHub Actions nightly, to an S3 bucket the owner creates; nothing runs until it is set up | [`.github/workflows/backup.yml`](../../.github/workflows/backup.yml), setup in [`docs/runbooks/ONCALL.md`](../docs/runbooks/ONCALL.md) |
| Metrics alerting | Not yet anywhere: the rules and scrape job are written and tested, waiting for a hosted metrics service | [`monitoring/`](monitoring/README.md) |

The step-by-step setup is in [`DEPLOYMENT_GUIDE.md`](../../DEPLOYMENT_GUIDE.md), and
what to do when something is down is in
[`docs/runbooks/ONCALL.md`](../docs/runbooks/ONCALL.md).

## If infrastructure-as-code is added later

Start from the table above, not from the file that was here. Whatever is
written has to describe PostgreSQL rather than MySQL, one API instance rather
than a cluster per region, and the single media bucket the API writes to. The
bucket is where members' photographs and résumés live, so it stays private
with no public ACL, and a CDN in front of it is set through `CDN_URL`. Keep
the database on Neon in Sydney unless there is a decision to move it:
members' records, including safety settings, are held there, so moving them is
a privacy decision before it is an infrastructure one.
