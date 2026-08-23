# The configured database is shared — do not run `migrate dev` or `db push`

**Discovered 2026-08-23. Read before touching the database.**

## What is true

The Neon database this repo points at (`neondb`) contains tables that
`prisma/schema.prisma` does not model. `prisma migrate status` reports **9
applied migrations that exist nowhere in this repository** — not as files, not
anywhere in git history:

```
20260718090000_nexus_feed_controls        20260809040000_nexus_live_economy_business
20260803010000_partner_campaigns          20260811010000_nexus_programme_completion
20260809010000_nexus_multi_profiles       20260811020000_nexus_delivery_assurance
20260809020000_nexus_content_discovery    20260811030000_waitlist_signups
20260809030000_nexus_social_local
```

They brought roughly **56 tables and 42 enum types** (a `Nexus*` set, plus
`PartnerCampaign` and `WaitlistSignup`), and extra columns on at least one table
this schema *does* own — `UserFeedPreferences` has 10 columns here that
`schema.prisma` has never heard of.

Because those objects are absent from `schema.prisma`, Prisma treats them as
things to remove.

## The danger

Any command that diffs the live schema against the datamodel will plan to drop
them. Measured against the current database: **107 destructive statements**.

| Command | Safe? | Why |
|---|---|---|
| `npm run db:migrate:deploy` | **Yes** | Applies pending migration *files*. Never diffs the live schema. |
| `npm run db:generate` | **Yes** | Only regenerates the client from `schema.prisma`. |
| `npm run db:migrate` (`prisma migrate dev`) | **NO** | Diffs and drops. Now blocked by the guard. |
| `npm run db:push` (`prisma db push`) | **NO** | Diffs and drops. Now blocked by the guard. |

`db:migrate:deploy` is one keystroke away from `db:migrate`. That is the whole
reason the guard exists.

## The guard

`scripts/guard-destructive-migration.js` runs before `db:migrate` and `db:push`.
It performs the same diff Prisma would, counts `DROP TABLE` / `DROP TYPE` /
`DROP COLUMN`, and aborts with a non-zero exit and a list of what would be lost.

Run it on its own at any time:

```bash
npm --prefix athena-platform/server run db:guard
```

It fails closed: if the diff cannot be computed at all, it refuses rather than
assuming everything is fine.

To override — only for a database you are certain this schema owns outright, such
as a scratch instance:

```bash
ALLOW_DESTRUCTIVE_MIGRATION=true npm run db:migrate
```

## How to add a schema change here

1. Edit `prisma/schema.prisma`.
2. Hand-write the migration SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`.
   Do **not** generate it from the live datasource — the generated script carries
   all 107 drops. `20260823120000_add_reactions_bookmarks_favorites_orders` is a
   worked example of an additive-only migration.
3. `npm run db:generate` so the Prisma client picks up the new models.
4. `npm run db:migrate:deploy` to apply.

Prefer additive changes (`CREATE TABLE`, `ADD COLUMN`) while the database is
shared. A column rename or drop needs to be agreed with whoever owns the other
application first.

## Worth resolving properly

This document describes a workaround, not a fix. The real options are:

- give ATHENA its own database, or
- bring the other application's tables into this `schema.prisma` (and recover the
  9 missing migration files) so Prisma has a complete picture.

Until one of those happens, every schema change carries this footgun.
