<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use App\Models\OnboardingEvent;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class SeedOnboardingInsightsSample extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'womenrise:seed-insights
        {--days=30 : Number of days back to spread the sample events}
        {--events=120 : Number of onboarding support engagement events to create}
        {--leads=80 : Number of lead telemetry events to create}
        {--purge : Remove previously seeded sample events before generating new data}
        {--flush-cache : Clear the application cache after seeding sample data}';

    /**
     * The console command description.
     */
    protected $description = 'Populate onboarding support and lead telemetry analytics with representative sample data.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $supportEventTarget = max(1, (int) $this->option('events'));
        $leadEventTarget = max(1, (int) $this->option('leads'));
        $shouldPurge = (bool) $this->option('purge');
        $shouldFlushCache = (bool) $this->option('flush-cache');

        $supports = array_keys(config('womenrise.supports', []));
        $personas = array_keys(config('womenrise.personas', []));

        if (empty($supports) || empty($personas)) {
            $this->error('The womenrise configuration must include personas and supports.');
            return self::FAILURE;
        }

        $batchId = (string) Str::uuid();

        if ($shouldPurge) {
            $purgedSupport = OnboardingEvent::query()
                ->where('payload->metadata->seeded', true)
                ->delete();

            $purgedLeads = AnalyticsEvent::query()
                ->where('properties->seeded', true)
                ->orWhere('metadata->seeded', true)
                ->delete();

            $this->warn("Purged {$purgedSupport} onboarding events and {$purgedLeads} lead telemetry events that were previously seeded.");
        }

        $personaUsers = $this->ensureSeedUsers($personas);

        $supportEventsCreated = $this->createSupportEvents(
            $batchId,
            $personaUsers,
            $supports,
            $personas,
            $supportEventTarget,
            $days
        );

        $leadEventsCreated = $this->createLeadEvents(
            $batchId,
            $leadEventTarget,
            $days
        );

        if ($shouldFlushCache) {
            Cache::flush();
            $this->info('Application cache flushed.');
        }

        $this->info(sprintf(
            'Seeded %d onboarding support events and %d lead telemetry events (batch %s).',
            $supportEventsCreated,
            $leadEventsCreated,
            $batchId
        ));

        $this->line('You can now refresh the admin analytics dashboard to see populated charts.');

        return self::SUCCESS;
    }

    /**
     * @param array<int, string>  $personas
     *
     * @return User[]
     *
     * @psalm-return array<string, User>
     */
    private function ensureSeedUsers(array $personas): array
    {
        $users = [];

        foreach ($personas as $persona) {
            $email = sprintf('seed-%s@womenrise.local', str_replace([' ', '/'], ['-', '-'], $persona));

            $users[$persona] = User::query()->firstOrCreate(
                ['email' => $email],
                [
                    'name' => Str::title(str_replace('-', ' ', $persona)).' Seed',
                    'password' => Hash::make(Str::random(32)),
                    'role' => 'member',
                    'email_verified_at' => now(),
                ]
            );
        }

        return $users;
    }

    /**
     * @param array<string, \App\Models\User>  $personaUsers
     * @param array<int, string>  $supports
     * @param array<int, string>  $personas
     *
     * @psalm-return int<0, max>
     */
    private function createSupportEvents(
        string $batchId,
        array $personaUsers,
        array $supports,
        array $personas,
        int $target,
        int $days
    ): int {
        $now = Carbon::now();
        $count = 0;

        for ($i = 0; $i < $target; $i++) {
            $persona = Arr::random($personas);
            $support = Arr::random($supports);
            $user = $personaUsers[$persona];

            $dayOffset = random_int(0, max(0, $days - 1));
            $occurredAt = $now->copy()->subDays($dayOffset)->setTime(random_int(8, 20), random_int(0, 59));

            $interaction = Arr::random([
                'cta_clicked', 'cta_clicked', 'cta_clicked', 'nudge_dismissed',
            ]);

            $highlighted = $interaction === 'cta_clicked' ? (bool) random_int(0, 1) : false;
            $ctaLabel = config("womenrise.supports.{$support}.cta_label") ?? 'View support';

            $nudgeOptions = Arr::wrap(config("womenrise.supports.{$support}.nudges.{$persona}"));
            $nudgeText = $interaction === 'nudge_dismissed' && ! empty($nudgeOptions)
                ? Arr::random($nudgeOptions)
                : null;

            $payload = [
                'support_type' => $support,
                'action' => $interaction,
                'highlighted' => $highlighted,
                'cta_label' => $ctaLabel,
                'persona_flags' => [$persona],
                'metadata' => array_filter([
                    'seeded' => true,
                    'seed_batch' => $batchId,
                    'nudge_text' => $nudgeText,
                ]),
            ];

            OnboardingEvent::query()->create([
                'user_id' => $user->id,
                'action' => 'support_engagement',
                'payload' => $payload,
                'occurred_at' => $occurredAt,
            ]);

            $count++;
        }

        return $count;
    }

    /**
     * @psalm-return int<0, max>
     */
    private function createLeadEvents(string $batchId, int $target, int $days): int
    {
        $now = Carbon::now();
        $events = [
            'lead_form_opened',
            'lead_form_started',
            'lead_form_progressed',
            'lead_form_submitted',
        ];

        $sources = ['landing-page', 'partner-programme', 'webinar', 'campaign', 'organic'];
        $organizations = ['womenrise-academy', 'care-coalition', 'rise-collective', 'mentor-network', 'safe-housing'];

        $count = 0;

        for ($i = 0; $i < $target; $i++) {
            $eventName = Arr::random($events);
            $occurredAt = $now->copy()
                ->subDays(random_int(0, max(0, $days - 1)))
                ->setTime(random_int(7, 21), random_int(0, 59));

            $properties = [
                'seeded' => true,
                'seed_batch' => $batchId,
                'org_slug' => Arr::random($organizations),
                'journey_stage' => Arr::random(['awareness', 'consideration', 'application']),
            ];

            AnalyticsEvent::query()->create([
                'event' => $eventName,
                'source' => Arr::random($sources),
                'properties' => $properties,
                'metadata' => [
                    'seeded' => true,
                    'seed_batch' => $batchId,
                ],
                'received_at' => $occurredAt,
                'created_at' => $occurredAt,
                'updated_at' => $occurredAt,
            ]);

            $count++;
        }

        return $count;
    }
}

