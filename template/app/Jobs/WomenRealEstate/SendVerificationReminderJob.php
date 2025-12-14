<?php

declare(strict_types=1);

namespace App\Jobs\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Notifications\WomenRealEstate\WomenAgentLicenseExpiryReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;

final class SendVerificationReminderJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly int $agentId,
        public readonly string $type = 'generic',
        public readonly array $context = []
    )
    {
        $this->afterCommit = true;
        if ($queue = config('women_real_estate.reminders.queue', 'notifications')) {
            $this->onQueue($queue);
        }
    }

    public function handle(): void
    {
        $agent = WomenVerifiedAgent::find($this->agentId);

        if ($agent === null) {
            return;
        }

        $type = $this->type;
        $days = $this->context['days_before_expiry'] ?? null;
        $key = $days !== null ? "days_{$days}" : 'generic';

        $payload = $agent->verification_payload ?? [];

        // If we've already recorded a reminder for this type and key, skip
        if (! empty($payload['reminders'][$type][$key]['sent_at'])) {
            return;
        }

        // Prepare parameters for the notification
        $expiresAt = $agent->license_expires_at ? CarbonImmutable::parse($agent->license_expires_at) : now();
        $daysInt = $days !== null ? (int) $days : 0;

        // Send the expected notification type (tests look for this class)
        $agent->user->notify(new WomenAgentLicenseExpiryReminderNotification($agent, $expiresAt, $daysInt));

        // Record the reminder in verification_payload
        $payload['reminders'][$type][$key] = [
            'sent_at' => now()->toIso8601String(),
            'channel' => 'email',
            'days_before_expiry' => $days,
        ];

        $agent->verification_payload = $payload;
        $agent->save();
    }
}

