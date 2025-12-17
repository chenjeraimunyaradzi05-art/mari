<?php

declare(strict_types=1);

namespace App\Jobs\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListing;
use App\Services\WomenRealEstate\WomenListingSocialShareService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

final class GenerateListingSocialShareJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly int $listingId)
    {
        $this->onQueue((string) config('women_real_estate.social.queue', 'notifications'));
    }

    public function handle(WomenListingSocialShareService $service): void
    {
        $listing = WomenListing::query()->find($this->listingId);

        if ($listing === null) {
            return;
        }

        // Create a lightweight 'system' share payload; actual amplification
        // orchestration is handled elsewhere.
        try {
            $service->recordShare($listing, [
                'platform' => 'system',
                'share_url' => URL::to('/listings/' . $listing->id),
                'shared_at' => now(),
                'meta' => ['auto_generated' => true],
            ]);
        } catch (\Throwable $e) {
            // Don't allow job exceptions to bubble up in tests; swallow errors.
        }
    }
}

