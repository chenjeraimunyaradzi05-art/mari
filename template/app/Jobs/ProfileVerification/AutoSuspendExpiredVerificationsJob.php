<?php

namespace App\Jobs\ProfileVerification;

use App\Enums\ProfileVerificationStatus;
use App\Enums\SocialVerificationStatus;
use App\Models\ProfileVerification;
use App\Models\VerificationAudit;
use App\Support\InAppNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

final class AutoSuspendExpiredVerificationsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct()
    {
        $connection = config('profile_verification.queue_connection', config('queue.default'));
        if ($connection) {
            $this->onConnection($connection);
        }

        $queue = config('profile_verification.automation.auto_suspend.queue');
        if ($queue) {
            $this->onQueue($queue);
        }
    }

    public function handle(): void
    {
        $graceDays = (int) config('profile_verification.automation.auto_suspend.grace_days', 7);

        $cutoff = now()->subDays($graceDays)->toDateString();

        $verifications = ProfileVerification::query()
            ->where('status', ProfileVerificationStatus::Approved)
            ->whereDate('license_expires_at', '<', $cutoff)
            ->get();

        foreach ($verifications as $verification) {
            $this->suspendVerification($verification, CarbonImmutable::now()->subDays($graceDays));
        }
    }

    private function suspendVerification(ProfileVerification $verification, CarbonImmutable $cutoff): void
    {
        DB::transaction(function () use ($verification, $cutoff): void {
            $verification->forceFill([
                'status' => ProfileVerificationStatus::NeedsMoreInfo,
                'notes' => $this->appendNote($verification->notes, sprintf(
                    'Auto-suspended on %s because the license expired on %s.',
                    now()->toDateTimeString(),
                    optional($verification->license_expires_at)->toDateString()
                )),
            ])->save();

            VerificationAudit::create([
                'verification_id' => $verification->getKey(),
                'action' => 'auto.suspend',
                'notes' => [
                    'reason' => 'license_expired',
                    'license_expires_at' => optional($verification->license_expires_at)->toDateString(),
                ],
            ]);

            $this->expireBadge($verification);
            $this->downgradeSocialProfile($verification);
        });

        $this->notifyApplicant($verification);
    }

    private function appendNote(?string $existing, string $note): string
    {
        $trimmed = trim((string) $existing);

        if ($trimmed === '') {
            return $note;
        }

        return $trimmed."\n\n".$note;
    }

    private function expireBadge(ProfileVerification $verification): void
    {
        $profile = $verification->profile;

        if ($profile === null) {
            return;
        }

        $badge = $profile->badges
            ? $profile->badges->firstWhere('badge_type', 'verified')
            : $profile->badges()->where('badge_type', 'verified')->where('status', 'active')->first();

        if ($badge === null) {
            return;
        }

        if ($badge->status === 'expired' || $badge->status === 'revoked') {
            return;
        }

        $badge->forceFill([
            'status' => 'expired',
            'expires_at' => now(),
        ])->save();
    }

    private function downgradeSocialProfile(ProfileVerification $verification): void
    {
        $socialProfile = $verification->profile?->personaSocialProfile;

        if ($socialProfile === null) {
            return;
        }

        $status = $socialProfile->verification_status;
        if ($status === SocialVerificationStatus::NeedsMoreInfo || $status === SocialVerificationStatus::Unverified) {
            return;
        }

        $socialProfile->forceFill([
            'verification_status' => SocialVerificationStatus::NeedsMoreInfo,
            'is_verified' => false,
            'verification_reviewed_at' => now(),
        ])->save();
    }

    private function notifyApplicant(ProfileVerification $verification): void
    {
        if (! $verification->user_id) {
            return;
        }

        InAppNotifier::notifyUser($verification->user_id, 'persona.verification.auto_suspended', [
            'title' => 'Verification badge paused',
            'message' => 'Your documents expired. Upload fresh credentials to restore your badge.',
            'verification_id' => $verification->getKey(),
            'profile_id' => $verification->profile_id,
        ]);
    }
}

