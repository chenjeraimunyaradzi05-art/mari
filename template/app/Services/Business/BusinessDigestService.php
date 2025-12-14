<?php

namespace App\Services\Business;

use App\Models\Business\BusinessProfile;
use App\Models\User;
use App\Notifications\Business\BusinessDigestNotification;
use App\Services\Business\BusinessInsightsService;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

final class BusinessDigestService
{
    private BusinessInsightsService $insightsService;

    public function __construct(BusinessInsightsService $insightsService)
    {
        $this->insightsService = $insightsService;
    }

    public function compile(BusinessProfile $profile): array
    {
        return $this->insightsService->snapshot($profile);
    }

    public function notifyIfDue(User $user, BusinessProfile $profile, ?array $snapshot = null): bool
    {
        if (! $this->shouldSend($profile)) {
            return false;
        }

        $payload = $snapshot ?? $this->compile($profile);
        $user->notify(new BusinessDigestNotification($payload));
        $this->markSent($profile);

        return true;
    }

    private function shouldSend(BusinessProfile $profile): bool
    {
        $metrics = $profile->metrics ?? [];
        $lastSent = Arr::get($metrics, 'last_digest_sent_at');

        if (! $lastSent) {
            return true;
        }

        try {
            $lastSentAt = Carbon::parse($lastSent);
        } catch (\Throwable) {
            return true;
        }

        return $lastSentAt->diffInHours(now()) >= 12;
    }

    private function markSent(BusinessProfile $profile): void
    {
        $metrics = $profile->metrics ?? [];
        $metrics['last_digest_sent_at'] = now()->toIso8601String();

        $profile->forceFill(['metrics' => $metrics])->saveQuietly();
    }
}

