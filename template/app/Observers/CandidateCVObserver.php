<?php

namespace App\Observers;

use App\Models\CandidateCV;
use App\Services\AICacheService;

final class CandidateCVObserver
{
    protected AICacheService $cacheService;
}

