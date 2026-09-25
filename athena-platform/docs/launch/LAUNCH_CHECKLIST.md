# ATHENA Platform Launch Checklist

**Target Launch Date:** ________________
**Status:** Not launched. Nothing in this document is signed off.

> Every heading in this file used to carry a ✅ and the status line used to read
> "Ready for Launch ✅", above a hundred and some unticked boxes. That is the
> one thing a launch runbook must never do, so the ticks are gone: a box is
> ticked by the person who checked it, on the day, or it stays empty.
>
> The commands below were also wrong in ways that only show up when someone
> runs them under pressure — a maintenance-mode `curl` posting to a path that
> does not exist, with a content type the route rejects; a `redis-cli FLUSHALL`
> against a private network from a laptop that cannot reach it, which would
> have wiped the login-lockout counters and every queued job if it could. They
> have been checked against the code, one by one, and the ones that cannot work
> say so instead of being left to fail on launch day.

> **See also:** [Infrastructure LAUNCH_CHECKLIST](../../LAUNCH_CHECKLIST.md) for the detailed
> infrastructure setup, env var reference, security hardening, and go-live sequence.
> [ONCALL](../runbooks/ONCALL.md) is what to do once it is live, and it opens with
> an honest account of what does and does not tell anyone that something is wrong.

---

## Pre-Launch Verification

### Infrastructure

- [ ] Production database migrated and verified — `npx prisma migrate status` against `DIRECT_DATABASE_URL`
- [ ] Redis reachable from the API — `athena-redis` in [render.yaml](../../../render.yaml) is a single Key Value instance on the starter plan, not a cluster; `/health/detailed` reports it
- [ ] SSL certificates valid (90+ days until expiry)
- [ ] DNS propagation complete — see [DNS_SSL](DNS_SSL.md)
- [ ] `GET /readyz` returns 200 from outside the platform

Two lines that used to be here have been removed rather than left to be ticked
by someone who assumed they were already true:

- **"Load balancer health checks passing."** There is no load balancer. Render
  watches `/livez` and restarts an instance that stops answering; Netlify fronts
  the web tier. `/readyz` is the one that proves Neon is reachable, and nothing
  watches it — that gap is tracked in [ONCALL](../runbooks/ONCALL.md).
- **"OpenSearch indices populated."** `OPENSEARCH_ENABLED` is `"false"` in
  `render.yaml`, deliberately. Search runs on Prisma. Turning OpenSearch on at
  launch would make search *worse*, not better: only posts, jobs and users are
  ever written to an index, so `athena_courses`, `athena_videos` and
  `athena_mentors` are created empty and a member searching "all" would stop
  finding any course, reel or mentor — with no error and no log line, because an
  empty index is a successful search. Leave it off.

### Application

- [ ] All environment variables configured — `npm run check:env -- <file>` from `athena-platform/server`, and `GET /health/launch-readiness` from the deployed API
- [ ] Feature flags set for launch
- [ ] Rate limiting configured — `RATE_LIMIT_ENABLED=true` and `REDIS_URL` set, or the limits are per-instance and reset on deploy
- [ ] `SENTRY_DSN` set — but do not treat a quiet Sentry as a quiet night; it currently reports only process-level crashes, not route 500s
- [ ] `METRICS_TOKEN` set so `/metrics` is gated. Nothing scrapes it yet; see [ONCALL](../runbooks/ONCALL.md) for what that means

### Testing

- [ ] `npm test` green in `athena-platform/server` and `athena-platform/client`
- [ ] `npx jest --config jest.integration.config.cjs` green against a real Postgres
- [ ] E2E suite green — `npm test` in `athena-platform/client` stands up both the web app and the API and then runs Playwright
- [ ] Load test run and the numbers written down — `athena-platform/server/scripts/k6` and `scripts/loadtest-auth.js`, `scripts/loadtest-health.js`, `scripts/loadtest-websocket.js`
- [ ] Security audit passed
- [ ] Mobile app store review approved

The "10,000 concurrent users" target that used to sit on the load-test line has
been taken off. It was never measured, the k6 scripts are not configured for it,
and a single Render `standard` instance with no Socket.IO Redis adapter cannot
be scaled out to meet it (see **Do not scale the API out** below). Put the
number you actually reached here when you have one.

### Compliance

- [ ] GDPR checklist signed off
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Cookie Policy published
- [ ] Data retention policy documented

### Business

- [ ] Stripe production keys configured — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the four `STRIPE_PRICE_*` ids
- [ ] Payment flows tested with real cards
- [ ] Support email configured
- [ ] Help documentation published
- [ ] Marketing materials ready

---

## Do not scale the API out

`render.yaml` declares one `athena-api` instance and it has to stay that way
until a Socket.IO Redis adapter is in place. Socket.IO holds its room
membership in the process that owns the connection, so with two instances a
message emitted on A never reaches a socket connected to B: chat, presence,
typing indicators and live notifications half-work, for half the members, with
no error anywhere. The server already logs this reasoning for rate limits and
scheduled-sweep locks when `REDIS_URL` is missing; the socket layer has no
equivalent because the adapter is not installed.

If the single instance is not enough, the answer is a larger plan, not a second
instance.

---

## Launch Day Procedures

All commands are run from `athena-platform/server` unless stated otherwise, with
`API_URL` pointing at the deployed API and `DIRECT_DATABASE_URL` at the Neon
direct (non-pooled) URL.

`/health/detailed` and `/health/launch-readiness` both answer **404** in
production without a token — that is deliberate, so the internet cannot read
queue depths and dependency failures off the API. Send
`HEALTH_DIAGNOSTICS_TOKEN` (or `DEBUG_SECRET`, or `METRICS_TOKEN`) as
`X-Health-Token`. A 404 from these two means the header is missing or wrong far
more often than it means the route is gone.

### T-24 Hours

```bash
# 1. Final code freeze
git tag v1.0.0-launch
git push origin v1.0.0-launch

# 2. Rehearse the migrations against a copy of production.
#    STAGING_DATABASE_URL is a Neon *branch* of the production database, not a
#    second environment — there isn't one. Create it in the Neon console
#    (Branches → New branch → from production) or with the Neon CLI, and paste
#    its connection string here. A branch is a copy-on-write clone, so this
#    costs nothing and rehearses against real data and real row counts.
STAGING_DATABASE_URL="postgresql://...neon.tech/athena?sslmode=require" \
  node scripts/migration-dry-run.js

# 3. Take an off-platform backup. Neon keeps point-in-time history whose window
#    depends on the plan; this file does not, which is the point of taking it.
pg_dump "$DIRECT_DATABASE_URL" > backup_pre_launch.sql

# 4. Confirm the deployment has everything it needs
curl -H "X-Health-Token: $HEALTH_DIAGNOSTICS_TOKEN" "$API_URL/health/launch-readiness"
curl -H "X-Health-Token: $HEALTH_DIAGNOSTICS_TOKEN" "$API_URL/health/detailed"
```

### T-1 Hour

```bash
# 1. Enable maintenance mode.
#    The route is mounted at /api/admin, and it reads a JSON body — without the
#    Content-Type header curl sends a form and the route answers
#    400 "enabled must be a boolean".
curl -X POST "$API_URL/api/admin/maintenance" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "message": "Launching soon..."}'

# 2. Deploy. Netlify and Render both build from a push to main; the
#    "Build and Deploy" workflow runs the Neon migration.
git push origin main

# 3. Confirm the migrations landed (the workflow runs them; this verifies)
DATABASE_URL="$DIRECT_DATABASE_URL" npx prisma migrate status

# 4. Warm the web tier's CDN
node scripts/warm-cdn.js --base "$APP_URL"
```

There is no cache-flush step. The line that used to be here was
`redis-cli FLUSHALL`, and it was wrong twice over: Render's Key Value instance
has no public ingress, so a laptop cannot reach it at all, and if it could,
`FLUSHALL` would take out the login-lockout counters, every rate-limit window,
the scheduled-sweep locks and all queued BullMQ jobs — on the hour the platform
opens. Nothing in the launch path needs a cache cleared. If a specific key is
poisoned, delete that key from the Render shell.

### T-0 (Launch)

```bash
# 1. Disable maintenance mode
curl -X POST "$API_URL/api/admin/maintenance" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# 2. Verify the public surface
node scripts/smoke-test.js --base "$API_URL"

# 3. Watch
# - Neon:     https://console.neon.tech
# - Render:   the athena-api service's Logs and Events tabs
# - Netlify:  https://app.netlify.com
# - Sentry:   https://sentry.io — process-level crashes only, see ONCALL
# - PostHog:  https://app.posthog.com — web analytics only; the server sends nothing to it
```

---

## Monitoring Checklist

Nothing below arrives on its own. There is no scraper, no dashboard and no alert
rule in this repository, so every number here is read by a person opening a
console. `/health/detailed` reports memory, database, Redis, queue depths and
dependency state in one response; `/metrics` is a Prometheus exposition behind
`X-Metrics-Token` that nothing consumes yet.

### First Hour

- [ ] Error rate — Render logs; Sentry will not show route 500s
- [ ] Response time p99
- [ ] Memory headroom — `/health/detailed`
- [ ] No 5xx in the Render log

### First Day

- [ ] User registrations tracking
- [ ] Payment flows completing — Stripe dashboard, and `/api/invoices` rows
- [ ] Mobile app downloads
- [ ] Push notifications delivering — Expo receipts; dead tokens deactivate themselves
- [ ] Email deliverability — SendGrid dashboard

### First Week

- [ ] D1 retention baseline
- [ ] Feature adoption metrics
- [ ] Support ticket volume
- [ ] Performance optimization needs
- [ ] Bug fix prioritization

---

## Rollback Procedure

If critical issues are detected:

```bash
# 1. Close the platform
curl -X POST "$API_URL/api/admin/maintenance" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "message": "Maintenance in progress"}'

# 2. Roll the code back
# Render:  the athena-api service → Deploys → the previous successful build → Redeploy
# Netlify: Dashboard → Deploys → previous deploy → Publish deploy
# Migrations are additive, so an older build runs against the newer schema.

# 3. Data, only if the schema or the data is the problem.
#    Prefer Neon's point-in-time restore over the dump: it is a branch, so the
#    current state is still there if the restore turns out to be the wrong call.
#    Neon console → the branch → Restore → pick a timestamp.
#    The dump is the fallback, and it replaces everything written since it was
#    taken — including anything a member wrote in the meantime:
#      psql "$DIRECT_DATABASE_URL" < backup_pre_launch.sql

# 4. Tell people. This exits non-zero and notifies nobody unless
#    INCIDENT_WEBHOOK_URL or INCIDENT_NOTIFY_EMAILS is set on whatever runs it.
node scripts/send-incident-notification.js \
  --severity critical \
  --service athena-api \
  --message "Rolled back the launch deploy: <what broke>"

# 5. Begin incident review
```

Closing the platform takes the domestic-violence tooling down with everything
else — safe-mode, the panic button, hidden chats and the emergency-contact
alerts are all behind the same gate. Maintenance mode is recorded as an admin
action for that reason. Keep the window as short as the rollback allows, and say
so in the maintenance message.

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Uptime | 99.9% | ____ |
| Error rate | < 0.1% | ____ |
| Response time p99 | < 500ms | ____ |
| User registrations (D1) | 1,000+ | ____ |
| App downloads (D1) | 500+ | ____ |
| Payment success rate | > 98% | ____ |

An uptime target is a measurement, and nothing measures it today. Point an
external uptime check at `$API_URL/readyz` before the launch if you want this
row to mean anything — `/livez` only proves the process is up, and Render
already watches that one.

---

## Team Contacts

| Role | Name | Phone | Reachable how |
|------|------|-------|---------------|
| Engineering Lead | _________ | _________ | _________ |
| DevOps | _________ | _________ | _________ |
| Product | _________ | _________ | _________ |
| Support | _________ | _________ | _________ |
| Executive | _________ | _________ | _________ |

The "🟢 On-call" markers that used to fill the last column have been removed.
There is no rota and no paging system — see [ONCALL](../runbooks/ONCALL.md).
Write down how each person is actually reached at 2am, or leave it blank and
know that it is blank.

---

## Post-Launch Tasks

### Immediate (Day 1-3)

- [ ] Monitor user feedback
- [ ] Respond to critical bugs
- [ ] Track media mentions

### Short-term (Week 1)

- [ ] Analyze launch metrics
- [ ] Plan first patch release
- [ ] Collect user testimonials

### Medium-term (Month 1)

- [ ] Feature iteration based on feedback
- [ ] Decide the backup retention target and rehearse a restore against a Neon branch
- [ ] Expand marketing efforts
- [ ] Plan next release cycle

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | _________ | ____/____/____ | _________ |
| Product | _________ | ____/____/____ | _________ |
| QA | _________ | ____/____/____ | _________ |
| Legal | _________ | ____/____/____ | _________ |
| Executive | _________ | ____/____/____ | _________ |
