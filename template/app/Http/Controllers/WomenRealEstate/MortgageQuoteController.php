<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Models\ListingMortgageQuote;
use App\Models\MortgageRateSnapshot;
use App\Models\WomenHousingListing;
use App\Services\MortgageRepaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

final class MortgageQuoteController extends Controller
{
    public function __construct(private readonly MortgageRepaymentService $repaymentService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function store(Request $request, WomenHousingListing $listing): RedirectResponse
    {
        $this->authorize('view', $listing);

        $validated = $request->validate([
            'mortgage_rate_snapshot_id' => ['required', 'exists:mortgage_rate_snapshots,id'],
            'purchase_price_cents' => ['nullable', 'integer', 'min:1000'],
            'deposit_amount_cents' => ['nullable', 'integer', 'min:0'],
            'loan_term_years' => ['required', 'integer', 'min:1', 'max:40'],
            'repayment_frequency' => ['required', Rule::in(['monthly', 'fortnightly', 'weekly'])],
        ]);

        $snapshot = MortgageRateSnapshot::findOrFail($validated['mortgage_rate_snapshot_id']);

        $purchasePriceCents = $validated['purchase_price_cents']
            ?? ($listing->price_cents ?? 0);

        if ($purchasePriceCents <= 0) {
            return back()
                ->withErrors(['purchase_price_cents' => 'A purchase price is required for mortgage calculations.'])
                ->withInput();
        }

        $depositAmountCents = $validated['deposit_amount_cents'] ?? 0;
        $principalCents = max(0, $purchasePriceCents - $depositAmountCents);

        if ($principalCents <= 0) {
            return back()
                ->withErrors(['deposit_amount_cents' => 'Deposit cannot exceed the purchase price.'])
                ->withInput();
        }

        $loanTermMonths = $validated['loan_term_years'] * 12;

        $calculatedRepaymentCents = $this->repaymentService->calculateRepaymentCents(
            $principalCents,
            $snapshot->interest_rate,
            $loanTermMonths,
            $validated['repayment_frequency']
        );

        $depositRatio = $depositAmountCents > 0 ? $depositAmountCents / $purchasePriceCents : 0;
        $riskRating = $this->repaymentService->estimateRiskRating($depositRatio);

        ListingMortgageQuote::create([
            'women_housing_listing_id' => $listing->id,
            'user_id' => Auth::id(),
            'mortgage_rate_snapshot_id' => $snapshot->id,
            'principal_amount_cents' => $principalCents,
            'deposit_amount_cents' => $depositAmountCents ?: null,
            'loan_term_months' => $loanTermMonths,
            'repayment_frequency' => $validated['repayment_frequency'],
            'calculated_repayment_cents' => $calculatedRepaymentCents,
            'risk_rating' => $riskRating,
            'ai_commentary' => $this->buildAiCommentary($snapshot, $depositRatio, $validated['repayment_frequency']),
            'generated_at' => now(),
        ]);

        return redirect()
            ->route('women.real-estate.listings.show', $listing)
            ->with('status', 'Mortgage scenario generated. Compare lenders to find the right fit.');
    }

    private function buildAiCommentary(MortgageRateSnapshot $snapshot, float $depositRatio, string $frequency): string
    {
        $humanDeposit = $depositRatio > 0
            ? number_format($depositRatio * 100, 1) . '% deposit'
            : 'No deposit';

        $features = collect($snapshot->feature_flags ?? [])
            ->map(fn ($flag) => str_replace('_', ' ', (string) $flag))
            ->implode(', ');

        return sprintf(
            '%s %s product at %.2f%% interest for a %d-month term. %s. Repayments scheduled %s.',
            $snapshot->provider,
            $snapshot->product_name,
            $snapshot->interest_rate,
            $snapshot->term_months,
            $features ? 'Features: ' . $features : 'Feature set not provided',
            $frequency
        ) . ' Deposit stance: ' . $humanDeposit . '.';
    }
}

