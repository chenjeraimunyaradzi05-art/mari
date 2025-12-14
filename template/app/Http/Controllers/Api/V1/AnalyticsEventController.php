<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TrackAnalyticsEventRequest;
use App\Services\RealTimeAnalyticsEngine;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

final class AnalyticsEventController extends Controller
{
    public function __construct(private RealTimeAnalyticsEngine $analytics)
    {
    }

    public function store(TrackAnalyticsEventRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $this->analytics->record(
            $validated['event'],
            [
                'properties' => $validated['properties'] ?? [],
                'metadata' => [
                    'ip' => $request->ip(),
                    'user_agent' => (string) $request->userAgent(),
                    'user_id' => optional($request->user())->id,
                ],
                'source' => 'frontend',
                'received_at' => now()->toIso8601String(),
            ]
        );

        return response()->json([
            'status' => 'accepted',
        ], Response::HTTP_ACCEPTED);
    }
}

