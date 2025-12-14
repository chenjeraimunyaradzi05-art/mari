<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\HealthInsurancePlan;
use App\Services\HealthFitness\HealthInsuranceMarketService;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class HealthFitnessController extends Controller
{
    public function __construct(private readonly HealthInsuranceMarketService $marketService)
    {
    }

    public function index(): View
    {
        return view('frontend.health-fitness.index');
    }

    public function insurance(Request $request): View
    {
        $plans = HealthInsurancePlan::all();

        if ($plans->isEmpty()) {
            // If no plans exist, fetch initial market data
            $this->marketService->syncMarketRates();
            $plans = HealthInsurancePlan::all();
        }

        return view('frontend.health-fitness.insurance.index', compact('plans'));
    }

    public function compare(Request $request): View
    {
        $planIds = $request->input('plans', []);

        $plans = HealthInsurancePlan::whereIn('id', $planIds)->get();

        return view('frontend.health-fitness.insurance.compare', compact('plans'));
    }
}

