<?php

namespace App\Jobs\Business;

use App\Models\Business\BusinessProfile;
use App\Services\Business\BusinessDigestService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class SendBusinessDigestJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public int $profileId)
    {
        $this->onQueue(config('business.digests.queue', 'business-digests'));
    }

    public function handle(BusinessDigestService $digestService): void
    {
        $profile = BusinessProfile::query()->find($this->profileId);

        if (! $profile) {
            return;
        }

        $user = $profile->user;

        if (! $user) {
            return;
        }

        $digestService->notifyIfDue($user, $profile);
    }
}

