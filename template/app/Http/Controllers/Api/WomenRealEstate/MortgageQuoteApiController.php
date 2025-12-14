<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Http\Resources\ListingMortgageQuoteResource;
use App\Models\WomenHousingListing;
use App\Events\WomenRealEstate\MortgageIntelligenceAccessed;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class MortgageQuoteApiController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum']);
    }

    public function index(Request $request, WomenHousingListing $listing): AnonymousResourceCollection
    {
        $this->authorize('view', $listing);

        $limit = (int) $request->integer('limit', 10);
        $limit = max(1, min($limit, 50));

        $quotes = $listing->mortgageQuotes()
            ->with('rateSnapshot')
            ->latest('generated_at')
            ->limit($limit)
            ->get();

        event(new MortgageIntelligenceAccessed(
            user: $request->user(),
            listing: $listing,
            channel: 'quotes',
            meta: [
                'limit' => $limit,
                'count' => $quotes->count(),
            ],
        ));

        return ListingMortgageQuoteResource::collection($quotes);
    }

    public function stats(Request $request, WomenHousingListing $listing): JsonResponse
    {
        $this->authorize('view', $listing);

        $baseQuery = $listing->mortgageQuotes();

        $total = (clone $baseQuery)->count();

        if ($total === 0) {
            return response()->json([
                'listing_id' => $listing->id,
                'total' => 0,
                'average_repayment_cents' => null,
                'latest_generated_at' => null,
                'latest_quote' => null,
                'risk_breakdown' => [],
            ]);
        }

        $averageRepayment = (clone $baseQuery)->avg('calculated_repayment_cents');
        $averageRepaymentRounded = $averageRepayment !== null
            ? (int) round((float) $averageRepayment)
            : null;

        $latestQuote = (clone $baseQuery)
            ->with('rateSnapshot')
            ->latest('generated_at')
            ->first();

        $riskBreakdown = (clone $baseQuery)
            ->select('risk_rating')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('risk_rating')
            ->pluck('aggregate', 'risk_rating')
            ->map(static fn ($count) => (int) $count)
            ->all();

        event(new MortgageIntelligenceAccessed(
            user: $request->user(),
            listing: $listing,
            channel: 'stats',
            meta: [
                'total_quotes' => $total,
                'average_repayment_cents' => $averageRepaymentRounded,
            ],
        ));

        return response()->json([
            'listing_id' => $listing->id,
            'total' => $total,
            'average_repayment_cents' => $averageRepaymentRounded,
            'latest_generated_at' => optional($latestQuote?->generated_at)->toISOString(),
            'latest_quote' => $latestQuote
                ? (new ListingMortgageQuoteResource($latestQuote))->resolve($request)
                : null,
            'risk_breakdown' => $riskBreakdown,
        ]);
    }
}

