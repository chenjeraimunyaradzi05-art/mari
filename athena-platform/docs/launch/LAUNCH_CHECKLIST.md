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
  `render.yaml`, deliberately, and no OpenSearch cluster is deployed. Search runs
  on Prisma and covers every kind of result. With OpenSearch on, only members,
  posts and jobs would be asked of the engine (courses, reels and mentors are
  answered from the database either way), but those three indexes are written
  only when a row is created or edited and nothing backfills the rows that
  already exist — so every member, post and job from before the switch would
  drop out of search. Leave it off until a backfill has been written and run.
  `OPENSEARCH_NODE` alone also turns it on, so leave that unset as well.

### Application

- [ ] All environment variables configured — `npm run check:env -- <file>` from `athena-platform/server`, and `GET /health/launch-readiness` from the deployed API
- [ ] Feature flags set for launch
- [ ] Media bucket set up as infrastructure/README.md ("Media bucket") says: Block Public Access on, the CDN limited to the public folders, `CDN_URL` on the API and `NEXT_PUBLIC_MEDIA_HOST` on Netlify. Then `GET /health/launch-readiness?probe=media` with the diagnostics token shows `MEDIA_EXPOSURE` passing: a résumé cannot be read without signing in and an avatar can
- [ ] Malware scanner running (ClamAV, a service of its own) and `CLAMAV_HOST` set on the API, as DEPLOY.md ("Malware scanning") says. Until it answers, a résumé or a document cannot be uploaded, so no one can attach a résumé to an application. `GET /health/launch-readiness` shows `MALWARE_SCANNER` passing, with the scanner's version
- [ ] Rate limiting — nothing to switch on: production always limits (`RATE_LIMIT_ENABLED=false` is ignored there) and refuses to boot without `REDIS_URL`, so counters are shared across instances. A signed-in member has her own budget (1,500 a window), an address with no valid token has 100; see [API overview](../api/API_OVERVIEW.md#rate-limiting). Redis going away after boot drops the counters to per-instance and raises an alert (ONCALL)
- [ ] `SENTRY_DSN` set on the API, and `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` set on Netlify (the DSN is baked in at build time, so deploy again after setting it). The API reports every 5xx its error handler answers, plus process crashes; the web host reports page errors and server-side request errors. A quiet Sentry is still only good news once an alert rule in Sentry emails someone: see [ONCALL](../runbooks/ONCALL.md)
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

- [ ] Stripe production keys configured — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` (the second endpoint, listening on connected accounts) and the four `STRIPE_PRICE_*` ids
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
#    depends on the plan; an off-platform copy does not, which is the point of
#    taking it. Run the "Database backup" workflow by hand (Actions → Database
#    backup → Run workflow) and read its summary: it seals the copy to the
#    key holders' age keys and restore-tests it before it counts. It needs the
#    production-backups environment set up first — docs/runbooks/ONCALL.md,
#    "Backups and restore". If Actions is unavailable, the fallback is a dump
#    encrypted as it is written, never a plaintext file on a laptop:
#      pg_dump --format=custom "$DIRECT_DATABASE_URL" | gpg --symmetric --cipher-algo AES256 -o backup_pre_launch.dump.gpg

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
# - Sentry:   https://sentry.io — API 5xx and crashes, web page and request errors; needs an alert rule to tell anyone, see ONCALL
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

- [ ] Error rate — Sentry's issue list (route 5xx arrive there with the request id that matches the Render log line) and the Render logs
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
#    Restore beside production, not over it: create a Neon branch from
#    production at a timestamp before the problem, and copy the damaged rows
#    back from it. Restoring production in place, or loading the pre-launch
#    copy over it, undoes everything written since — including blocks a member
#    placed, safety settings she changed and erasures she asked for. Take a
#    Neon branch of production as it stands before anything is overwritten,
#    then run the safety diff (npm run restore:safety-diff) and apply the patch
#    it writes. Work the steps in docs/runbooks/ONCALL.md, "Backups and
#    restore", which also says how to restore from an off-platform copy.

# 4. Tell people. This exits non-zero and notifies nobody unless
#    INCIDENT_WEBHOOK_URL or INCIDENT_NOTIFY_EMAILS is set on whatever runs it.
node scripts/send-incident-notification.js \
  --severity critical \
  --service athena-api \
  --message "Rolled back the launch deploy: <what broke>"

# 5. Begin incident review
```

Closing the platform does not take the safety tooling down. The gate leaves
open everything under `/api/safety/dv` (safe mode, the panic button, hidden
chats, emergency-contact alerts, the support-line list), her safety settings and
block list, and the public crisis-line lists under `/api/wellness`. The list is
`MAINTENANCE_OPEN_PATHS` in `server/src/middleware/maintenance-gate.ts`, and a
test fails if one of those paths starts answering 503. The web maintenance page
shows 000, 1800RESPECT and Lifeline as call links, and a quick exit.

What is still closed is everything else, including reports and the moderation
queue, so a rollback that has to touch the database can still leave those calls
failing. If the database itself is down, the safety calls that write (the panic
alert, a new block) fail honestly and tell her to call 000; the support-line list
and crisis lines have built-in copies and keep answering. Maintenance mode is
recorded as an admin action. Keep the window as short as the rollback allows, and
say so in the maintenance message.

Every signed-in page carries an Emergency help button (web: `client/src/components/safety/EmergencyHelp.tsx`; phone: `mobile/src/components/pillar/EmergencyHelp.tsx`) that opens the numbers to ring without asking the API for anything. The numbers are in the code, so nothing will notice if one changes: before launch, check each against the service's own published number (triplezero.gov.au, 1800respect.org.au, lifeline.org.au, and the New Zealand, UK and US lines at their own sites) in `client/src/lib/crisis-lines.ts` and `mobile/src/components/pillar/CrisisLines.tsx`, and record the date.

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
- [ ] Decide the backup retention period and the key holders, set up the production-backups environment, and confirm the nightly "Database backup" run is green (ONCALL.md, "Backups and restore")
- [ ] Each key holder decrypts the newest off-platform copy; rehearse a restore against a Neon branch
- [ ] In that Neon branch drill, run `npm run restore:safety-diff` (production as `--live`, the branch as `--restored`) and check it finishes and lists the day's blocks and safety-setting changes under "put back" (ONCALL.md, "Restoring")
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
