<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\WomenRealEstate\WomenVerificationAnalyticsService;
use Carbon\CarbonInterface;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenVerificationAnalyticsController extends Controller
{
    public function __construct(private readonly WomenVerificationAnalyticsService $analytics)
    {
    }

    public function __invoke(Request $request): View|JsonResponse
    {
        $summary = $this->analytics->summary();

        $refreshInterval = (int) config('women_real_estate.verification.analytics.refresh_interval_ms', 60000);

        if ($request->wantsJson()) {
            $payload = $summary;

            if (($summary['generated_at'] ?? null) instanceof CarbonInterface) {
                $payload['generated_at'] = $summary['generated_at']->toIso8601String();
            }

            $payload['refresh_interval_ms'] = $refreshInterval;

            return response()->json($payload);
        }

        return view('admin.verification.women.analytics', [
            'summary' => $summary,
            'refreshIntervalMs' => $refreshInterval,
        ]);
    }
}

