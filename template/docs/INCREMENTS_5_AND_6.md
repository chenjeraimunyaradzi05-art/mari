# Increment 5 (20–25%) & Increment 6 (25–30%) — Implementation Summary

Implemented the AI foundation and the Dream Job pre-application system as part of the next 10% (20% → 30%) of the roadmap.

Summary of additions

- INCREMENT 5 (AI Integration Foundation)
  - Added: `app/Services/AthenaAIService.php` — a minimal, testable AI service with methods to build a user profile and provide lightweight recommendations.
  - Tests: `tests/Unit/Services/AthenaAIServiceTest.php` — validates profile building and job matching logic.

- INCREMENT 6 (Dream Job Pre-Application System)
  - Database migrations:
    - `database/migrations/2025_12_07_000000_create_dream_job_alerts_table.php`
    - `database/migrations/2025_12_07_000100_create_job_alert_matches_table.php`
  - Models:
    - `app/Models/DreamJobAlert.php`
    - `app/Models/JobAlertMatch.php`
  - Factory: `database/factories/DreamJobAlertFactory.php`
  - Matcher service: `app/Services/DreamJobMatcherService.php` — naive, safe matching engine for alert→job matches.
  - Tests: `tests/Unit/Services/DreamJobMatcherServiceTest.php` — verifies matches are persisted and timestamps updated.

Notes and next steps

- The AI service is intentionally minimal and avoids calling external providers during tests. We can extend it to call the configured OpenAI provider in production runs.
- The matcher service uses simple heuristics for job matching; this is intentionally lightweight and intended for later improvement (AI scoring, rule-based weighting, or background queues).
- To finish the pre-application system, we should add:
  - Controller/API endpoints for creating/managing alerts
    - Controller/API endpoints for creating/managing alerts (implemented in this iteration):
      - Routes: `dream-job-alerts` with names `dream_job_alerts.index`, `store`, `show`, `update`, `destroy`
      - Controller: `app/Http/Controllers/DreamJobAlertController.php`
      - Request validation: `app/Http/Requests/StoreDreamJobAlertRequest.php`, `app/Http/Requests/UpdateDreamJobAlertRequest.php`
    - Frontend pages (Blade UI):
      - `resources/views/dream_job_alerts/index.blade.php`
      - `resources/views/dream_job_alerts/create.blade.php`
      - `resources/views/dream_job_alerts/edit.blade.php`
      - `resources/views/dream_job_alerts/_form.blade.php`
      - UI controller: `app/Http/Controllers/DreamJobAlertPageController.php`

    ## Background matcher & notifications

    - Artisan command: `artisan dream-jobs:match` — added at `app/Console/Commands/RunDreamJobMatcher.php` (supports `--dry-run`).
    - Queueable job: `app/Jobs/RunDreamJobMatcherJob.php` — dispatched by the command and runs `DreamJobMatcherService::runForActiveAlerts()`.
    - Scheduler entry: registered in `app/Console/Kernel.php` — runs `dream-jobs:match` hourly.
    - Notifications: `app/Notifications/DreamJobMatchFound.php` and observer `app/Observers/JobAlertMatchObserver.php` notify alert owners when matches are created.

    ### Improvements in this iteration
    - Added user notification preferences to `users` table (email + in-app) so users can control whether they receive match notifications.
    - Added dedupe logic to `app/Services/DreamJobMatcherService.php` to avoid creating duplicate matches for the same alert + job.
    - Integrated AI scoring via `AthenaAIService::scoreMatch` so matches now have a `match_score` and `explanation` which are persisted to `job_alert_matches`.
    - Lowered matcher run cadence to every 15 minutes for faster match detection while controlling resource usage.

    Automated tests ensure the command dispatches a queue job, the job finds matches and that users are notified when matches are persisted. See tests/Feature for details.
  - Background job/cron to invoke the matcher regularly and process notifications
  - UI for subscribers to review matches and opt-in for applications

If you'd like, I can now implement the alert CRUD API + background worker and tests next.
