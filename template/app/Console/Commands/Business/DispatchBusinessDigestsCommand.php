<?php

namespace App\Console\Commands\Business;

use App\Jobs\Business\SendBusinessDigestJob;
use App\Models\Business\BusinessProfile;
use App\Services\Business\FounderTimezoneSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

final class DispatchBusinessDigestsCommand extends Command
{
    protected $signature = 'business:digests:dispatch
        {--chunk=100 : Number of profiles to chunk per query batch}
        {--local-hours= : Comma separated target local hours (0-23) to dispatch digests for}';

    protected $description = 'Queue Business Network digest jobs for every active founder profile.';

    /**
     * @psalm-return int<1, max>
     */
    private function sanitizeChunk(int $chunk): int
    {
        return $chunk > 0 ? $chunk : 100;
    }

    /**
     * @return array<int, int>
     */
    private function resolveTargetHours(): array
    {
        $raw = $this->option('local-hours');

        if ($raw === null || $raw === '') {
            $raw = config('business.digests.local_hours', ['7']);
        }

        if (is_array($raw)) {
            $segments = $raw;
        } else {
            $segments = explode(',', (string) $raw);
        }

        return collect($segments)
            ->map(fn ($value) => (int) trim((string) $value))
            ->filter(fn ($value) => $value >= 0 && $value <= 23)
            ->unique()
            ->values()
            ->all();
    }

    private function timezoneMatches(?string $timezone, array $targetHours, Carbon $reference): bool
    {
        if ($targetHours === []) {
            return true;
        }

        $fallback = config('business.digests.timezone_fallback')
            ?: config('app.timezone')
            ?: 'UTC';

        $zone = $timezone ?: $fallback;

        try {
            $localHour = $reference->copy()->setTimezone($zone)->hour;
        } catch (\Throwable) {
            $localHour = $reference->copy()->setTimezone($fallback)->hour;
        }

        return in_array((int) $localHour, $targetHours, true);
    }

    public function handle(FounderTimezoneSyncService $syncService): int
    {
        $chunk = $this->sanitizeChunk((int) $this->option('chunk'));
        $targetHours = $this->resolveTargetHours();

        // When local-hours was explicitly provided, ensure recent login audits
        // are used to sync missing founder timezones so dispatch decisions
        // reflect recent activity in local time.
        if ($this->option('local-hours') !== null) {
            $syncService->syncRecent();
        }

        $reference = Carbon::now();

        BusinessProfile::query()
            ->with('user')
            ->chunk($chunk, function ($profiles) use ($targetHours, $reference) {
                foreach ($profiles as $profile) {
                    $user = $profile->user;

                    if (! $user) {
                        continue;
                    }

                    if ($user->account_classification !== 'business_network' || $user->role !== 'company') {
                        continue;
                    }

                    if (! $this->timezoneMatches($user->timezone, $targetHours, $reference)) {
                        continue;
                    }

                    SendBusinessDigestJob::dispatch($profile->id);
                }
            });

        return 0;
    }
}

