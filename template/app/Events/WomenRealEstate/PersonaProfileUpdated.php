<?php

declare(strict_types=1);

namespace App\Events\WomenRealEstate;

use App\Models\WomenRealEstate\WomenPersonaProfile;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PersonaProfileUpdated
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(public WomenPersonaProfile $profile)
    {
    }
}

