<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\Impact\ImpactAnalyticsService;
use Illuminate\Http\Request;

final class ImpactDashboardController extends Controller
{
    public function __invoke(ImpactAnalyticsService $service)
    {
        $data = $service->getPublicMetrics();

        return view('frontend.impact.index', [
            'metrics' => $data['metrics'],
            'lastUpdated' => $data['generated_at'] ?? now(),
        ]);
    }
}

