<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * PropertyMortgageShareController
 *
 * Combines property social sharing with mortgage implications
 * Allows users to share properties with mortgage valuation details
 */
final class PropertyMortgageShareController extends Controller
{
    /**
     * Share a property with mortgage analysis
     * Creates a special social post that includes mortgage metrics
     */
    public function shareMortgagedProperty(Request $request, $propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $data = $request->validate([
                'caption' => 'nullable|string|max:2000',
                'share_type' => 'nullable|in:original,repost,listing_promotion',
                'include_mortgage' => 'boolean|default:true',
                'mortgage_perspective' => 'nullable|in:buyer,investor,realtor',
            ]);

            // Get property data
            $property = DB::table('properties')
                ->where('id', $propertyId)
                ->first();

            if (!$property) {
                return response()->json(['error' => 'Property not found'], 404);
            }

            // Create base social post
            $socialPostId = DB::table('property_social_posts')->insertGetId([
                'property_id' => $propertyId,
                'user_id' => $user->id,
                'caption' => $data['caption'] ?? null,
                'share_type' => $data['share_type'] ?? 'original',
                'featured_image' => $property->thumbnail_image ?? null,
                'is_active' => true,
                'views_count' => 0,
                'shares_count' => 0,
                'engagement_score' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Create mortgage-enhanced social post record
            $mortgageData = null;
            if ($data['include_mortgage'] ?? true) {
                $mortgageData = $this->calculateMortgageData($property->price ?? 0);

                DB::table('property_mortgage_shares')->insert([
                    'property_social_post_id' => $socialPostId,
                    'property_id' => $propertyId,
                    'user_id' => $user->id,
                    'mortgage_perspective' => $data['mortgage_perspective'] ?? 'buyer',
                    'loan_amount' => $mortgageData['loan_amount'],
                    'monthly_payment' => $mortgageData['monthly_payment'],
                    'readiness_score' => $mortgageData['readiness_score'],
                    'ltv' => $mortgageData['ltv'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Property with mortgage analysis shared successfully',
                'data' => [
                    'social_post_id' => $socialPostId,
                    'property_id' => $propertyId,
                    'user_id' => $user->id,
                    'property_title' => $property->title ?? 'Property',
                    'property_price' => $property->price,
                    'share_type' => $data['share_type'] ?? 'original',
                    'mortgage_included' => $data['include_mortgage'] ?? true,
                    'mortgage_data' => $mortgageData,
                    'created_at' => now(),
                ]
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to share mortgaged property',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get trending mortgaged property shares
     */
    public function getTrendingMortgagedProperties(): \Illuminate\Http\JsonResponse
    {
        try {
            // Get trending mortgaged shares
            $trending = DB::table('property_social_posts')
                ->join('property_mortgage_shares', 'property_social_posts.id', '=', 'property_mortgage_shares.property_social_post_id')
                ->where('property_social_posts.is_active', true)
                ->selectRaw('
                    property_social_posts.id,
                    property_social_posts.property_id,
                    property_social_posts.user_id,
                    property_social_posts.caption,
                    property_social_posts.views_count,
                    property_social_posts.shares_count,
                    property_social_posts.engagement_score,
                    property_mortgage_shares.mortgage_perspective,
                    property_mortgage_shares.monthly_payment,
                    property_mortgage_shares.readiness_score,
                    property_mortgage_shares.loan_amount,
                    property_mortgage_shares.ltv
                ')
                ->orderByDesc('property_social_posts.engagement_score')
                ->take(15)
                ->get();

            return response()->json([
                'success' => true,
                'count' => count($trending),
                'data' => $trending->map(function ($share) {
                    return [
                        'post_id' => $share->id,
                        'property_id' => $share->property_id,
                        'user_id' => $share->user_id,
                        'caption' => $share->caption,
                        'views' => $share->views_count,
                        'shares' => $share->shares_count,
                        'engagement_score' => $share->engagement_score,
                        'mortgage' => [
                            'perspective' => $share->mortgage_perspective,
                            'monthly_payment' => round($share->monthly_payment, 2),
                            'readiness_score' => round($share->readiness_score, 1),
                            'loan_amount' => round($share->loan_amount, 2),
                            'ltv' => round($share->ltv, 2),
                        ]
                    ];
                }),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch trending mortgaged properties',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get mortgaged property shares by perspective
     * Filter by buyer, investor, or realtor perspective
     */
    public function getMortgageSharesByPerspective($perspective): \Illuminate\Http\JsonResponse
    {
        try {
            if (!in_array($perspective, ['buyer', 'investor', 'realtor'])) {
                return response()->json(['error' => 'Invalid perspective'], 400);
            }

            $sharesData = DB::table('property_social_posts')
                ->join('property_mortgage_shares', 'property_social_posts.id', '=', 'property_mortgage_shares.property_social_post_id')
                ->where('property_mortgage_shares.mortgage_perspective', $perspective)
                ->where('property_social_posts.is_active', true)
                ->orderByDesc('property_social_posts.created_at')
                ->paginate(20);

            $mappedData = collect($sharesData->items())->map(function ($share) {
                return [
                    'post_id' => $share->id,
                    'property_id' => $share->property_id,
                    'caption' => $share->caption,
                    'engagement_score' => $share->engagement_score,
                    'monthly_payment' => round($share->monthly_payment, 2),
                ];
            })->toArray();

            return response()->json([
                'success' => true,
                'perspective' => $perspective,
                'total' => $sharesData->total(),
                'data' => $mappedData,
                'pagination' => [
                    'current_page' => $sharesData->currentPage(),
                    'per_page' => $sharesData->perPage(),
                    'last_page' => $sharesData->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch shares by perspective',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get property with full mortgage + social context
     */
    public function getPropertyMortgageSocialContext($propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            // Get property
            $property = DB::table('properties')
                ->where('id', $propertyId)
                ->first();

            if (!$property) {
                return response()->json(['error' => 'Property not found'], 404);
            }

            // Get social engagement
            $socialStats = DB::table('property_social_posts')
                ->where('property_id', $propertyId)
                ->where('is_active', true)
                ->selectRaw('
                    COUNT(*) as total_posts,
                    SUM(views_count) as total_views,
                    SUM(shares_count) as total_shares,
                    AVG(engagement_score) as avg_engagement_score
                ')
                ->first();

            // Get mortgage context
            $mortgageStats = DB::table('property_mortgage_shares')
                ->where('property_id', $propertyId)
                ->selectRaw('
                    COUNT(*) as total_mortgage_shares,
                    AVG(monthly_payment) as avg_monthly_payment,
                    AVG(readiness_score) as avg_readiness_score,
                    COUNT(CASE WHEN mortgage_perspective = "buyer" THEN 1 END) as buyer_perspective_count,
                    COUNT(CASE WHEN mortgage_perspective = "investor" THEN 1 END) as investor_perspective_count,
                    COUNT(CASE WHEN mortgage_perspective = "realtor" THEN 1 END) as realtor_perspective_count
                ')
                ->first();

            $mortgageCalc = $this->calculateMortgageData($property->price ?? 0);

            return response()->json([
                'success' => true,
                'property' => [
                    'id' => $property->id,
                    'title' => $property->title ?? 'Property',
                    'price' => $property->price,
                    'bedrooms' => $property->number_of_bedroom,
                    'bathrooms' => $property->number_of_bathroom,
                ],
                'social_context' => [
                    'total_posts' => $socialStats->total_posts ?? 0,
                    'total_views' => $socialStats->total_views ?? 0,
                    'total_shares' => $socialStats->total_shares ?? 0,
                    'avg_engagement_score' => round($socialStats->avg_engagement_score ?? 0, 1),
                ],
                'mortgage_context' => [
                    'total_mortgage_shares' => $mortgageStats->total_mortgage_shares ?? 0,
                    'avg_monthly_payment' => round($mortgageStats->avg_monthly_payment ?? $mortgageCalc['monthly_payment'], 2),
                    'avg_readiness_score' => round($mortgageStats->avg_readiness_score ?? $mortgageCalc['readiness_score'], 1),
                    'perspectives' => [
                        'buyer' => $mortgageStats->buyer_perspective_count ?? 0,
                        'investor' => $mortgageStats->investor_perspective_count ?? 0,
                        'realtor' => $mortgageStats->realtor_perspective_count ?? 0,
                    ]
                ],
                'estimated_mortgage' => $mortgageCalc,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch property context',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate mortgage metrics for a property price
     *
     * @return (float|int)[]
     *
     * @psalm-return array{loan_amount: float, down_payment: float, monthly_payment: float, interest_rate_annual: float, loan_term_years: 30, ltv: float, readiness_score: float}
     */
    private function calculateMortgageData($price): array
    {
        $downPaymentPercentage = 0.2;
        $interestRate = 0.045;
        $loanTermMonths = 360;

        $loanAmount = $price * (1 - $downPaymentPercentage);
        $monthlyRate = $interestRate / 12;

        $monthlyPayment = $loanAmount *
            ($monthlyRate * pow(1 + $monthlyRate, $loanTermMonths)) /
            (pow(1 + $monthlyRate, $loanTermMonths) - 1);

        $readinessScore = min(100, max(0,
            (($price > 0 ? 40 : 0) +
            ($monthlyPayment < 3000 ? 40 : 30) +
            20)
        ));

        return [
            'loan_amount' => round($loanAmount, 2),
            'down_payment' => round($price * $downPaymentPercentage, 2),
            'monthly_payment' => round($monthlyPayment, 2),
            'interest_rate_annual' => $interestRate * 100,
            'loan_term_years' => $loanTermMonths / 12,
            'ltv' => round(($loanAmount / $price) * 100, 2),
            'readiness_score' => round($readinessScore, 1),
        ];
    }
}
