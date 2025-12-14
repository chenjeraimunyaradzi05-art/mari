<?php

namespace App\Http\Controllers\Api\V1\Impact;

use App\Http\Controllers\Controller;
use App\Services\Impact\ImpactAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublicImpactController extends Controller
{
    public function __invoke(Request $request, ImpactAnalyticsService $analytics): JsonResponse
    {
        $timeframe = (string) $request->query('timeframe', 'daily');
        $audience = (string) $request->query('audience', 'public');

        if ($audience === 'partner') {
            $payload = $analytics->getPartnerMetrics($timeframe);

            return response()->json([
                'data' => [
                    'timeframe' => $payload['timeframe'],
                    'window_start' => $payload['window_start'],
                    'window_end' => $payload['window_end'],
                    'generated_at' => $payload['generated_at'],
                    'metrics' => $payload['metrics']->map->toArray(),
                    'audience' => 'partner',
                ],
            ]);
        }

        $payload = $analytics->getPublicMetrics($timeframe);

        return response()->json([
            'data' => [
                'timeframe' => $payload['timeframe'],
                'window_start' => $payload['window_start'],
                'window_end' => $payload['window_end'],
                'generated_at' => $payload['generated_at'],
                'metrics' => $payload['metrics']->map->toArray(),
                'audience' => 'public',
            ],
        ]);
    }
}

