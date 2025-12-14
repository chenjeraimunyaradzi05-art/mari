<?php

declare(strict_types=1);

namespace App\Events\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListing;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class WomenListingPublished
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(public readonly WomenListing $listing)
    {
    }
}

