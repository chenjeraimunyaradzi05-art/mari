# Phase 1 QA Plan – Property Social Sharing (Staging)

**Last updated:** November 19, 2025  \
**Scope:** Property Social P1 tickets (PS-101, PS-102) hitting review and promoted to staging.

## 1. Objectives

- Validate the hardened Property Social APIs (share flows, engagement counters, trending cache) in a staging environment that mirrors production configuration.
- Catch regressions in cache/queue behavior before frontend wiring lands.
- Produce a signed QA report that unlocks Phase 2 (integrated UI) and the Nov 29 deployment window.

## 2. Entry Criteria

1. PS-101 (Property Sharing API Hardening) pull request in "Ready for Review" with CI green.
2. PS-102 (Engagement Counters & Analytics Hooks) feature branch rebased onto the same commit and merged into `release/property-social` staging branch.
3. Latest migrations run successfully on staging (`php artisan migrate`).
4. Feature flags/env vars set:

   - `PROPERTY_SOCIAL_ENABLED=true`
   - `SOCIAL_FEED_PERSONALIZED_TTL=60`
   - `SOCIAL_FEED_PINNED_LIMIT=4`

5. Redis + queue workers online (`queue:work-prioritized redis`).
6. Seed dataset loaded (see section 4) and smoke tests pass.

## 3. Environment Preparation (Staging)

1. **Deploy release branch**

   ```pwsh
   cd "C:\laragon\www\source code"
   git fetch origin
   git checkout release/property-social
   git pull
   composer install --no-dev
   npm ci --omit=dev
   ```

2. **Update env + cache**

   ```pwsh
   php artisan config:cache
   php artisan route:cache
   php artisan cache:clear
   ```

3. **Run migrations + queues**

   ```pwsh
   php artisan migrate --force
   php artisan queue:work-prioritized redis --sleep=1 --tries=3 --timeout=120
   ```

4. **Log instrumentation** – enable `LOG_CHANNEL=stack` and `LOG_LEVEL=info` to capture analytics + API traces.

## 4. Test Data & Instrumentation

- `php artisan db:seed --class=PropertySocialStagingSeeder`

  - Creates 25 properties with mixed price bands.
  - Generates users (agents, buyers) and sample social posts per property.

- `php artisan tinker --execute="PropertySocialPost::factory()->count(40)->state(['share_type' => 'original'])->create();"`
- Capture analytics tail:

  ```pwsh
  tail -n 200 storage/logs/laravel.log
  ```

## 5. Test Matrix

| Area | Tests | Owner | Tooling |
| --- | --- | --- | --- |
| API happy paths | `POST /api/properties/{id}/share`, `GET /api/properties/{id}/social-posts` | QA Eng | Postman collection `collections/property-social.postman_collection.json` |
| Validation & auth | Invalid payloads, unauthorized deletes | QA Eng | PHPUnit `tests/Feature/PropertySocialControllerTest` |
| Engagement counters | `recordView`, `recordShare`, engagement score math, Redis fallback | Backend Eng | PHPUnit + custom `tests/Scripts/engagement-counter.smoke.php` |
| Trending cache | TTL adherence, cache bust hook, top-10 limit | Backend Eng | Artisan command `app:diagnose-trending` |
| Analytics hooks | Verify `analytics_events` rows, log payload | Data Eng | SQL scripts in `reports/property-social-qa.sql` |
| Queue resilience | Worker restart, failed job inspection | DevOps | `php artisan queue:failed --queue=social-feed` |

## 6. Execution Timeline

1. **T0 (PS-101 marked ready):** trigger staging deploy and env prep (2 hrs buffer).
2. **T0 + 2h:** QA kickoff call, confirm entry criteria checklist signed.
3. **T0 + 2–10h:** Run matrix above, log defects in Linear board (labels: `QA`, `Phase1`).
4. **T0 + 12h:** Regression rerun on fixes (focus on affected endpoints).
5. **T0 + 14h:** Publish QA summary in `docs/social/property-social-phase1-qa.md` (append results table) and post to #social-platform channel.

## 7. Exit Criteria

- All P1 blocking bugs closed or waived by product + engineering.
- Postman regression suite green (100% pass).
- Engagement counters verified against expected formula for at least 5 sample posts.
- Trending cache TTL verified (hit ratio ≥ 80% during soak test).
- Analytics events present with correct payload keys.
- QA lead signs off by updating the "Status" line below.

**Status:** _Pending kickoff_

## 8. Status & Results Log

| Step | Owner | Start (timestamp) | Finish (timestamp) | Result / Link | Notes |
| --- | --- | --- | --- | --- | --- |
| Entry checklist signed |  |  |  |  |  |
| Staging deploy & seed |  |  |  |  |  |
| API happy-path suite |  |  |  |  |  |
| Validation/auth suite |  |  |  |  |  |
| Engagement counter soak |  |  |  |  |  |
| Trending cache soak |  |  |  |  |  |
| Analytics verification |  |  |  |  |  |
| Queue resilience run |  |  |  |  |  |
| Regression rerun |  |  |  |  |  |
| QA sign-off posted |  |  |  |  |  |

## 9. Links & References

- Implementation checklist: `PROPERTY_SOCIAL_IMPLEMENTATION_CHECKLIST.md`
- Integration guide: `PROPERTY_SOCIAL_INTEGRATION_GUIDE.md`
- Runbook: `RUNBOOK_SOCIAL_FEED.md`
- Deployment window notes: `READY_TO_DEPLOY.md`
