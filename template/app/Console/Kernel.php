<?php

namespace App\Console;

use App\Console\Commands\Advertising\ReconcileSlotRevenue;
use App\Console\Commands\Auth\PruneUserLoginAuditsCommand;
use App\Console\Commands\Business\DispatchBusinessDigestsCommand;
use App\Console\Commands\Business\SyncGrantPackManifestCommand;
use App\Console\Commands\Impact\CaptureImpactIndexSnapshotCommand;
use App\Console\Commands\Messaging\PruneCdnLatencySamplesCommand;
use App\Console\Commands\Messaging\RecordCdnLatencySampleCommand;
use App\Console\Commands\SeedAiClientAlerts;
use App\Console\Commands\Security\ExportSecurityAuditLogsCommand;
use App\Console\Commands\PronounLintCommand;
use App\Console\Commands\PrepareMoneyInboxDemoCommand;
use App\Console\Commands\Moderation\BackfillTransparencyLogsCommand;
use App\Console\Commands\Queue\WorkPrioritized;
use App\Console\Commands\Social\BackfillExtendedSocialMetrics;
use App\Console\Commands\Social\BackfillInviteGraphContactsCommand;
use App\Console\Commands\Social\BackfillPersonaSocialProfiles;
use App\Console\Commands\Social\BackfillSocialProfiles;
use App\Console\Commands\Candidate\BackfillCandidateJourney;
use App\Console\Commands\Social\ComputeDailySocialMetrics;
use App\Console\Commands\WomenRealEstate\ClearListingMetricsCache;
use App\Console\Commands\WomenRealEstate\AssignVerificationReviewerRole;
use App\Console\Commands\WomenRealEstate\WomenVerificationEncryptionAuditCommand;
use App\Console\Commands\WomenVerificationDryRunCommand;
use App\Jobs\ProfileVerification\AutoSuspendExpiredVerificationsJob;
use App\Jobs\ProfileVerification\SendVerificationReminderJob;
use App\Jobs\RefreshMortgageRateSnapshotsJob;
use App\Jobs\Social\DisburseCreatorPayoutsJob;
use App\Jobs\Social\WarehouseAnalyticsExportJob;
use App\Jobs\WomenRealEstate\DispatchLicenseExpiryRemindersJob;
use App\Jobs\WomenRealEstate\ReverifyExpiredAgentJob;
use App\Models\AnalyticsEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

final class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by the application.
     *
     * @var array<int, class-string>
     */
    protected $commands = [
        AssignVerificationReviewerRole::class,
        PruneUserLoginAuditsCommand::class,
        DispatchBusinessDigestsCommand::class,
        BackfillSocialProfiles::class,
        BackfillPersonaSocialProfiles::class,
        ComputeDailySocialMetrics::class,
        BackfillExtendedSocialMetrics::class,
        BackfillInviteGraphContactsCommand::class,
        BackfillCandidateJourney::class,
        ClearListingMetricsCache::class,
        WorkPrioritized::class,
        WomenVerificationDryRunCommand::class,
        WomenVerificationEncryptionAuditCommand::class,
        RecordCdnLatencySampleCommand::class,
        PruneCdnLatencySamplesCommand::class,
        PronounLintCommand::class,
        PrepareMoneyInboxDemoCommand::class,
        SeedAiClientAlerts::class,
        BackfillTransparencyLogsCommand::class,
        SyncGrantPackManifestCommand::class,
        CaptureImpactIndexSnapshotCommand::class,
        ReconcileSlotRevenue::class,
        ExportSecurityAuditLogsCommand::class,
    ];

    /**
     * Define the application's command schedule.
     */
    #[\Override]
    protected function schedule(Schedule $schedule): void
    {
        $schedule->job(new RefreshMortgageRateSnapshotsJob())
            ->twiceDaily(6, 18)
            ->withoutOverlapping()
            ->onQueue('mortgage-intel');

        $schedule->job(new \App\Jobs\Mortgage\IngestMortgageDataJob(['source' => 'api']))
            ->everyTenMinutes()
            ->name('mortgage:ingest-data')
            ->withoutOverlapping();

        $schedule->job(new \App\Jobs\Mortgage\ScoreMortgageApplicationJob(1))
            ->hourly()
            ->name('mortgage:score-applications')
            ->withoutOverlapping();

        $schedule->job(new \App\Jobs\Mortgage\UpdateRepaymentCalculatorJob(1))
            ->hourlyAt(15)
            ->name('mortgage:update-repayment')
            ->withoutOverlapping();

        $schedule->job(new \App\Jobs\Mortgage\MortgageUXHookJob('repayment_updated', ['mortgage_id' => 1]))
            ->hourlyAt(20)
            ->name('mortgage:ux-hook')
            ->withoutOverlapping();

        $schedule->command('women:mortgage-telemetry:report --hours=1')
            ->hourlyAt(5)
            ->evenInMaintenanceMode();

        $windows = array_unique(array_map('intval', config('women_real_estate.reminders.license_expiry_windows', [])));

        foreach ($windows as $window) {
            if ($window < 0) {
                continue;
            }

            $schedule->job(new DispatchLicenseExpiryRemindersJob($window))
                ->dailyAt('08:15')
                ->name('women-verification:license-expiry-'.$window)
                ->withoutOverlapping();
        }

        $schedule->job(new ReverifyExpiredAgentJob(
            config('women_real_estate.reminders.reverify_lead_days', 30)
        ))
            ->dailyAt('09:00')
            ->name('women-verification:reverify-scan')
            ->withoutOverlapping();

        $schedule->command('model:prune', [
            '--model' => AnalyticsEvent::class,
        ])
            ->dailyAt('00:45')
            ->name('analytics:prune-events')
            ->withoutOverlapping();

        $schedule->command('advertising:reconcile-slot-revenue')
            ->dailyAt('00:30')
            ->name('advertising:slot-reconciliation')
            ->withoutOverlapping()
            ->runInBackground();

        $digestHours = collect(config('business.digests.local_hours', ['7']))
            ->map(fn ($hour) => (int) $hour)
            ->filter(fn ($hour) => $hour >= 0 && $hour <= 23)
            ->unique()
            ->values()
            ->implode(',');

        $schedule->command('business:digests:dispatch', [
            '--local-hours' => $digestHours !== '' ? $digestHours : '7',
        ])
            ->hourlyAt(5)
            ->name('business:dispatch-digests')
            ->withoutOverlapping()
            ->onOneServer()
            ->runInBackground();

        $retentionDays = (int) config('auth.login_audits.retention_days', 90);

        if ($retentionDays > 0) {
            $schedule->command('auth:login-audits:prune')
                ->dailyAt('03:30')
                ->name('auth:prune-login-audits')
                ->withoutOverlapping();
        }

        $latencyFrequency = (int) config('messaging.cdn.latency_probe_frequency_minutes', 5);
        $latencyBatch = max(1, (int) config('messaging.cdn.latency_probe_batch', 1));

        if ($latencyFrequency > 0) {
            $interval = max(1, $latencyFrequency);
            $cron = $interval >= 60
                ? sprintf('0 */%d * * *', (int) ceil($interval / 60))
                : sprintf('*/%d * * * *', $interval);

            $schedule->command('messaging:cdn:sample', [
                '--count' => $latencyBatch,
            ])
                ->cron($cron)
                ->name('messaging:cdn-latency-sample')
                ->withoutOverlapping()
                ->runInBackground();
        }

        $retentionMinutes = (int) config('messaging.cdn.latency_retention_minutes', 1440);

        if ($retentionMinutes > 0) {
            $schedule->command('messaging:cdn:prune-samples')
                ->hourly()
                ->name('messaging:cdn-latency-prune')
                ->withoutOverlapping()
                ->runInBackground();
        }

        $auditSchedule = config('security.audit_export.schedule', []);

        if (data_get($auditSchedule, 'enabled', true)) {
            $frequency = data_get($auditSchedule, 'frequency', 'fifteen');
            $event = $schedule->command('security:audit:export')
                ->name('security:audit-export')
                ->withoutOverlapping()
                ->runInBackground();

            match ($frequency) {
                'five' => $event->everyFiveMinutes(),
                'ten' => $event->everyTenMinutes(),
                'thirty' => $event->everyThirtyMinutes(),
                'hourly' => $event->hourly(),
                'daily' => $event->dailyAt('00:10'),
                default => $event->everyFifteenMinutes(),
            };
        }

        if (config('profile_verification.automation.reminders.enabled', true)) {
            $windows = collect(config('profile_verification.automation.reminders.windows', []))
                ->map(fn ($value) => (int) $value)
                ->filter(fn ($value) => $value > 0)
                ->unique()
                ->values();

            foreach ($windows as $window) {
                $schedule->job(new SendVerificationReminderJob($window))
                    ->dailyAt('08:10')
                    ->name('profile-verification:reminder-'.$window)
                    ->withoutOverlapping();
            }
        }

        if (config('profile_verification.automation.auto_suspend.enabled', true)) {
            $schedule->job(new AutoSuspendExpiredVerificationsJob())
                ->dailyAt('06:40')
                ->name('profile-verification:auto-suspend')
                ->withoutOverlapping();
        }

        $schedule->job(new WarehouseAnalyticsExportJob(
            lastEventId: 0,
            batchSize: (int) config('social.analytics.batch_size', 500)
        ))
            ->everyFifteenMinutes()
            ->name('analytics:warehouse-export')
            ->withoutOverlapping()
            ->onQueue(config('social.analytics.queue', 'analytics'))
            ->runInBackground();

        $schedule->job(new DisburseCreatorPayoutsJob())
            ->dailyAt('01:30')
            ->name('revenue:disburse-payouts')
            ->withoutOverlapping()
            ->onQueue(config('social.revenue.queue', 'revenue'))
            ->runInBackground();

        $grantPackFeedUrl = (string) config('legal_document_lab.grant_pack_feed.url');

        if (config('legal_document_lab.grant_pack_feed.auto_update', true) && $grantPackFeedUrl !== '') {
            $schedule->command('legal-document-lab:sync-grant-packs')
                ->hourly()
                ->name('legal-document-lab:sync-grant-packs')
                ->withoutOverlapping()
                ->runInBackground();
        }

        $schedule->command('social:metrics-daily')
            ->dailyAt('00:25')
            ->name('social:metrics-daily')
            ->withoutOverlapping()
            ->onOneServer();

        $schedule->command('impact:snapshots:capture', [
            '--timeframe' => 'daily',
            '--publish' => true,
        ])
            ->dailyAt('00:50')
            ->name('impact:snapshots:daily')
            ->withoutOverlapping()
            ->onOneServer();

        $schedule->command('company:sync-market-data')
            ->everyFiveMinutes()
            ->name('company:sync-market-data')
            ->withoutOverlapping()
            ->runInBackground();

        // Dream job matcher: run every 15 minutes to scan alerts and persist matches
        $schedule->command('dream-jobs:match')
            ->everyFifteenMinutes()
            ->name('dream-jobs:match')
            ->withoutOverlapping()
            ->runInBackground();
    }

    /**
     * Register the commands for the application.
     */
    #[\Override]
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}

