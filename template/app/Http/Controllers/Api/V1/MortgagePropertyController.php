<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

/**
 final  * MortgagePropertyController
 *
 * Integrates mortgage engine with property data
 * Enables querying properties with their mortgage implications
 */
final class MortgagePropertyController extends Controller
{
    /**
     * Get properties with mortgage valuation data
     * Combines property data with estimated mortgage values and terms
     */
    public function propertyMortgageValuation($propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            // Get property data from database
            $property = DB::table('properties')
                ->where('id', $propertyId)
                ->first();

            if (!$property) {
                return response()->json(['error' => 'Property not found'], 404);
            }

            // Get any existing mortgage applications for this property
            $mortgageApplications = DB::table('mortgage_applications')
                ->where('property_id', $propertyId)
                ->orderByDesc('created_at')
                ->get();

            // Calculate mortgage implications
            $price = $property->price ?? 0;
            $mortgageData = $this->calculateMortgageImplications($price);

            return response()->json([
                'success' => true,
                'property' => [
                    'id' => $property->id,
                    'title' => $property->title ?? 'Property',
                    'price' => $price,
                    'address' => $property->address ?? 'Address',
                    'city_id' => $property->city_id,
                    'bedrooms' => $property->number_of_bedroom,
                    'bathrooms' => $property->number_of_bathroom,
                    'area' => $property->area,
                ],
                'mortgage_analysis' => $mortgageData,
                'applications_count' => count($mortgageApplications),
                'applications' => $mortgageApplications->map(function ($app) {
                    return [
                        'id' => $app->id,
                        'status' => $app->status,
                        'score' => $app->mortgage_score ?? 'N/A',
                        'created_at' => $app->created_at,
                    ];
                }),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch mortgage valuation',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all properties with mortgage readiness score
     */
    public function propertiesMortgageReadiness(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $minPrice = $request->query('min_price', 0);
            $maxPrice = $request->query('max_price', 999999999);
            $limit = $request->query('limit', 20);

            // Get properties within price range
            $properties = DB::table('properties')
                ->whereBetween('price', [$minPrice, $maxPrice])
                ->where('is_active', true)
                ->limit($limit)
                ->get();

            $propertiesWithMortgage = $properties->map(function ($property) {
                $price = $property->price ?? 0;
                $mortgageData = $this->calculateMortgageImplications($price);

                return [
                    'id' => $property->id,
                    'title' => $property->title ?? 'Property',
                    'price' => $price,
                    'bedrooms' => $property->number_of_bedroom,
                    'mortgage_readiness_score' => $mortgageData['readiness_score'],
                    'estimated_monthly_payment' => $mortgageData['monthly_payment'],
                    'loan_to_value' => $mortgageData['ltv'],
                ];
            });

            return response()->json([
                'success' => true,
                'count' => count($propertiesWithMortgage),
                'data' => $propertiesWithMortgage,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch properties',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get mortgage analytics by property type
     */
    public function mortgageAnalyticsByPropertyType(): \Illuminate\Http\JsonResponse
    {
        try {
            $analytics = DB::table('properties')
                ->selectRaw('property_type_id, COUNT(*) as total_count, AVG(price) as avg_price, COUNT(CASE WHEN mortgage_applications > 0 THEN 1 END) as financed_count')
                ->groupBy('property_type_id')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $analytics->map(function ($stat) {
                    return [
                        'property_type_id' => $stat->property_type_id,
                        'total_properties' => $stat->total_count,
                        'average_price' => round($stat->avg_price ?? 0, 2),
                        'financed_count' => $stat->financed_count ?? 0,
                        'financing_rate' => $stat->total_count > 0
                            ? round((($stat->financed_count ?? 0) / $stat->total_count) * 100, 2)
                            : 0,
                    ];
                }),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch analytics',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate mortgage implications for a property price
     * This is called by the mortgage scoring service
     *
     * @return (float|int)[]
     *
     * @psalm-return array{loan_amount: float, down_payment: float, monthly_payment: float, interest_rate_annual: float, loan_term_years: 30, ltv: float, readiness_score: float, estimated_total_interest: float}
     */
    private function calculateMortgageImplications($price): array
    {
        $downPaymentPercentage = 0.2; // 20% down payment
        $interestRate = 0.045; // 4.5% annual interest
        $loanTermMonths = 360; // 30 years

        $loanAmount = $price * (1 - $downPaymentPercentage);
        $monthlyRate = $interestRate / 12;

        // Calculate monthly payment using amortization formula
        $monthlyPayment = $loanAmount *
            ($monthlyRate * pow(1 + $monthlyRate, $loanTermMonths)) /
            (pow(1 + $monthlyRate, $loanTermMonths) - 1);

        // Calculate readiness score (0-100)
        // Factors: property value, estimated payment affordability, location
        $readinessScore = min(100, max(0,
            (($price > 0 ? 40 : 0) +  // Has price
            ($monthlyPayment < 3000 ? 40 : 30) +  // Monthly payment reasonable
            20)  // Location bonus
        ));

        return [
            'loan_amount' => round($loanAmount, 2),
            'down_payment' => round($price * $downPaymentPercentage, 2),
            'monthly_payment' => round($monthlyPayment, 2),
            'interest_rate_annual' => $interestRate * 100,
            'loan_term_years' => $loanTermMonths / 12,
            'ltv' => round(($loanAmount / $price) * 100, 2),
            'readiness_score' => round($readinessScore, 1),
            'estimated_total_interest' => round(($monthlyPayment * $loanTermMonths) - $loanAmount, 2),
        ];
    }
}
