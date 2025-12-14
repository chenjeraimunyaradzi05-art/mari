<?php

namespace App\Http\Controllers\Automotive;

use App\Http\Controllers\Controller;
use App\Models\FinanceApplication;
use App\Models\InsuranceQuote;
use App\Models\VehicleListing;
use App\Services\Automotive\Finance\FinanceBrokerService;
use App\Services\Automotive\Insurance\InsuranceBrokerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class AutomotiveFinanceController extends Controller
{
    protected $financeService;
    protected $insuranceService;

    public function __construct(FinanceBrokerService $financeService, InsuranceBrokerService $insuranceService)
    {
        $this->financeService = $financeService;
        $this->insuranceService = $insuranceService;
    }

    // --- Finance ---

    public function showFinanceForm(VehicleListing $listing): \Illuminate\Contracts\View\View
    {
        return view('automotive.finance.apply', compact('listing'));
    }

    public function submitFinanceApplication(Request $request, VehicleListing $listing): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'loan_amount' => 'required|numeric|min:1000',
            'term_months' => 'required|integer|min:12|max:84',
            'annual_income' => 'required|numeric|min:0',
            'employment_status' => 'required|string',
        ]);

        $application = FinanceApplication::create([
            'user_id' => Auth::id(),
            'vehicle_listing_id' => $listing->id,
            'loan_amount' => $validated['loan_amount'],
            'term_months' => $validated['term_months'],
            'annual_income' => $validated['annual_income'],
            'employment_status' => $validated['employment_status'],
            'status' => 'pending',
        ]);

        // Connect to Partner API
        $this->financeService->submitApplication($application);

        return redirect()->route('automotive.finance.success', $application);
    }

    public function financeSuccess(FinanceApplication $application): \Illuminate\Contracts\View\View
    {
        return view('automotive.finance.success', compact('application'));
    }

    // --- Insurance ---

    public function showInsuranceForm(VehicleListing $listing): \Illuminate\Contracts\View\View
    {
        return view('automotive.insurance.quote', compact('listing'));
    }

    public function submitInsuranceQuote(Request $request, VehicleListing $listing): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'driver_age_range' => 'required|string',
            'parking_location' => 'required|string',
            'usage_type' => 'required|string',
            'estimated_annual_km' => 'required|numeric',
        ]);

        $quote = InsuranceQuote::create([
            'user_id' => Auth::id(),
            'vehicle_listing_id' => $listing->id,
            'driver_age_range' => $validated['driver_age_range'],
            'parking_location' => $validated['parking_location'],
            'usage_type' => $validated['usage_type'],
            'estimated_annual_km' => $validated['estimated_annual_km'],
        ]);

        // Connect to Partner API
        $this->insuranceService->requestQuotes($quote);

        return redirect()->route('automotive.insurance.results', $quote);
    }

    public function insuranceResults(InsuranceQuote $quote): \Illuminate\Contracts\View\View
    {
        return view('automotive.insurance.results', compact('quote'));
    }
}

