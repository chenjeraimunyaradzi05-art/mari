<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Jobs\WomenRealEstate\SendVerificationReminderJob;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Database\Eloquent\Collection;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;

final class WomenVerificationReminderService
{
    /**
     * @psalm-return int<0, max>
     */
    public function queueLicenseExpiryReminders(int $daysBeforeExpiry): int
    {
        if ($daysBeforeExpiry < 0) {
            return 0;
        }

        $targetDate = CarbonImmutable::now()->startOfDay()->addDays($daysBeforeExpiry);
        $throttleHours = max(0, (int) config('women_real_estate.reminders.throttle_hours', 24));
        $cutoff = $throttleHours > 0 ? CarbonImmutable::now()->subHours($throttleHours) : null;
        $dispatched = 0;

        WomenVerifiedAgent::query()
            ->with('user')
            ->where('status', 'active')
            ->whereNotNull('license_expires_at')
            ->whereDate('license_expires_at', '=', $targetDate->toDateString())
            ->chunkById(200, function (Collection $agents) use ($daysBeforeExpiry, $cutoff, &$dispatched): void {
                /** @var WomenVerifiedAgent $agent */
                foreach ($agents as $agent) {
                    if ($agent->user === null) {
                        continue;
                    }

                    $payload = $agent->verification_payload ?? [];
                    $lastSent = Arr::get($payload, 'reminders.license_expiry.days_'.$daysBeforeExpiry.'.sent_at');

                    if ($lastSent !== null) {
                        $lastSentAt = CarbonImmutable::make($lastSent);

                        if ($lastSentAt !== null && $cutoff !== null && $lastSentAt->greaterThanOrEqualTo($cutoff)) {
                            continue;
                        }
                    }

                    SendVerificationReminderJob::dispatch($agent->id, 'license_expiry', [
                        'days_before_expiry' => $daysBeforeExpiry,
                    ]);
                    $dispatched++;
                }
            });

        return $dispatched;
    }
}

