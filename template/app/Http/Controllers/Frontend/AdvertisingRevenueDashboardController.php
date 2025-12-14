<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\Advertising\SlotRevenueInsightsService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class AdvertisingRevenueDashboardController extends Controller
{
    public function __construct(private readonly SlotRevenueInsightsService $insights)
    {
    }

    public function index(Request $request): View
    {
        $windowDays = (int) $request->integer('days', 30);
        $windowDays = max(7, min(90, $windowDays));

        return view('frontend.company-dashboard.advertising.revenue', [
            'summary' => $this->insights->summary($windowDays),
            'topSlots' => $this->insights->topSlots($windowDays, 6),
            'dailyTrend' => $this->insights->dailyTrend(min(30, $windowDays)),
            'readinessBreakdown' => $this->insights->readinessBreakdown(),
        ]);
    }
}

