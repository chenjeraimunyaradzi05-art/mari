<?php

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\Cache;

class AICacheService
{

    /**
     * Time-to-live in seconds for cached AI results. Default to 15 minutes.
     */
    private int $ttlSeconds = 900;


    public function getJobRecommendations(int $candidateId, Closure $resolver)
    {
        $key = "ai:job_recommendations:{$candidateId}";

        return Cache::remember($key, $this->ttlSeconds, $resolver);
    }

    public function getCareerInsights(int $candidateId, Closure $resolver)
    {
        $key = "ai:career_insights:{$candidateId}";

        return Cache::remember($key, $this->ttlSeconds, $resolver);
    }
}

