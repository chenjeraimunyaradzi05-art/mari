<?php

declare(strict_types=1);

namespace App\Jobs\WomenRealEstate;

use App\Models\WomenHousingListing;
use App\Services\WomenRealEstate\WomenHousingListingSocialShareService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

final class GenerateHousingListingSocialShareJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly int $listingId,
        private readonly string $reason = 'updated'
    ) {
        $this->onQueue((string) config('women_real_estate.social.queue', 'notifications'));
    }
}

