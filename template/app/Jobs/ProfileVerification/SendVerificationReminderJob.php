<?php

namespace App\Jobs\ProfileVerification;

use App\Enums\ProfileVerificationStatus;
use App\Models\ProfileVerification;
use App\Models\VerificationAudit;
use App\Notifications\ProfileVerification\ProfileVerificationReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class SendVerificationReminderJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly int $daysBeforeExpiry)
    {
        $this->afterCommit = true;
        $connection = config('profile_verification.queue_connection', config('queue.default'));
        if ($connection) {
            $this->onConnection($connection);
        }

        $queue = config('profile_verification.automation.reminders.queue');
        if ($queue) {
            $this->onQueue($queue);
        }
    }

    public function handle(): void
    {
        $targetDate = now()->addDays($this->daysBeforeExpiry)->toDateString();

        $verifications = ProfileVerification::query()
            ->where('status', ProfileVerificationStatus::Approved)
            ->whereDate('license_expires_at', $targetDate)
            ->get();

        foreach ($verifications as $verification) {
            $this->sendReminder($verification);
        }
    }

    private function sendReminder(ProfileVerification $verification): void
    {
        $user = $verification->user;

        if ($user === null) {
            return;
        }

        $alreadySent = VerificationAudit::query()
            ->where('verification_id', $verification->getKey())
            ->where('action', 'reminder.sent')
            ->where('notes->days_before_expiry', $this->daysBeforeExpiry)
            ->exists();

        if ($alreadySent) {
            return;
        }

        $user->notify(new ProfileVerificationReminderNotification($verification, $this->daysBeforeExpiry));

        VerificationAudit::create([
            'verification_id' => $verification->getKey(),
            'action' => 'reminder.sent',
            'notes' => [
                'days_before_expiry' => $this->daysBeforeExpiry,
                'license_expires_at' => optional($verification->license_expires_at)->toDateString(),
            ],
        ]);
    }
}

