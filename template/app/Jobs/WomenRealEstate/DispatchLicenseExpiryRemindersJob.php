<?php

declare(strict_types=1);

namespace App\Jobs\WomenRealEstate;

use App\Services\WomenRealEstate\WomenVerificationReminderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class DispatchLicenseExpiryRemindersJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly int $daysBeforeExpiry)
    {
        $this->afterCommit = true;
        if ($queue = config('women_real_estate.reminders.queue', 'notifications')) {
            $this->onQueue($queue);
        }
    }
}

