<?php

namespace App\Services;

use App\Models\User;
use App\Services\RealTimeAnalyticsEngine;

final class PurposeAnalyticsReporter
{
    private RealTimeAnalyticsEngine $analytics;

    public function __construct(?RealTimeAnalyticsEngine $analytics = null)
    {
        $this->analytics = $analytics ?? app(RealTimeAnalyticsEngine::class);
    }


    public function report(User $actor, User $target, string $event, array $properties = [], string $source = 'app'): void
    {
        $payloadProperties = array_merge(
            $properties,
            [
                'actor_user_id' => $actor->getKey(),
                'target_user_id' => $target->getKey(),
                'updated_by_guardian' => $properties['updated_by_guardian'] ?? ($actor->getKey() !== $target->getKey()),
            ]
        );

        $this->analytics->record($event, [
            'properties' => $payloadProperties,
            'metadata' => [
                'actor_role' => $actor->role,
                'target_role' => $target->role,
            ],
            'source' => $source,
        ]);
    }
}

