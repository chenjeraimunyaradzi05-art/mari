<?php

declare(strict_types=1);

namespace App\Events\WomenRealEstate;

use App\Models\User;
use App\Models\WomenHousingListing;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class MortgageIntelligenceAccessed
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly ?User $user,
        public readonly WomenHousingListing $listing,
        public readonly string $channel,
        public readonly array $meta = []
    ) {
    }
}

