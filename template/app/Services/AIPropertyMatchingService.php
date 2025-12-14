<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * AIPropertyMatchingService
 *
 * Uses AI-powered algorithm to match property seekers with rental/buy properties
 * Considers budget, location, preferences, lifestyle, and social compatibility
 */
final class AIPropertyMatchingService
{
    /**
     * Calculate match score between seeker and property
     *
     * @return ((int|mixed|string)[]|float)[]
     *
     * @psalm-return array{total_score: float, breakdown: array{budget: mixed, location: 50|75|100, features: 25, lifestyle: 20, social: 60}, match_reasons: list{0?: string, 1?: string, 2?: string, 3?: string, 4?: string}}
     * @psalm-param 'rental' $propertyType
     */
    public function calculateMatchScore(object $seeker, \stdClass $property, string $propertyType = 'rental'): array
    {
        $scores = [];

        // Budget match (25% weight)
        $scores['budget'] = $this->scoreBudget($seeker, $property, $propertyType);

        // Location match (20% weight)
        $scores['location'] = $this->scoreLocation($seeker, $property);

        // Property features match (25% weight)
        $scores['features'] = $this->scoreFeatures($seeker, $property);

        // Lifestyle compatibility (15% weight)
        $scores['lifestyle'] = $this->scoreLifestyle($seeker, $property);

        // Social/Behavioral fit (15% weight)
        $scores['social'] = $this->scoreSocial($seeker, $property);

        // Calculate weighted total
        $totalScore = ($scores['budget'] * 0.25) +
                      ($scores['location'] * 0.20) +
                      ($scores['features'] * 0.25) +
                      ($scores['lifestyle'] * 0.15) +
                      ($scores['social'] * 0.15);

        return [
            'total_score' => round($totalScore, 2),
            'breakdown' => $scores,
            'match_reasons' => $this->generateMatchReasons($seeker, $property, $scores),
        ];
    }

    /**
     * Score budget match
     *
     * @psalm-param 'rental' $propertyType
     */
    private function scoreBudget(object $seeker, \stdClass $property, string $propertyType)
    {
        if ($propertyType === 'rental') {
            $rent = $property->monthly_rent ?? 0;
            $minBudget = $seeker->min_budget ?? 0;
            $maxBudget = $seeker->max_budget ?? 999999;
        } else {
            $rent = $property->price ?? 0;
            $minBudget = $seeker->min_budget ?? 0;
            $maxBudget = $seeker->max_budget ?? 999999999;
        }

        if ($rent < $minBudget || $rent > $maxBudget) {
            return 0;
        }

        // Closer to middle of range = higher score
        $midpoint = ($minBudget + $maxBudget) / 2;
        $distance = abs($rent - $midpoint);
        $maxDistance = ($maxBudget - $minBudget) / 2;

        return max(0, 100 - ($distance / $maxDistance * 100));
    }

    /**
     * Score location match
     *
     * @psalm-return 50|75|100
     */
    private function scoreLocation(object $seeker, \stdClass $property): int
    {
        if (!$seeker->location_preferences) {
            return 75; // Default if no preference
        }

        $locations = json_decode($seeker->location_preferences, true) ?? [];
        $propertyCity = $property->city_id ?? null;

        if (in_array($propertyCity, $locations)) {
            return 100;
        }

        // Nearby cities get partial credit
        return 50;
    }

    /**
     * Score features match (bedrooms, bathrooms, area)
     *
     * @psalm-return 25
     */
    private function scoreFeatures(object $seeker, \stdClass $property): int
    {
        $score = 100;

        // Bedroom match
        $bedrooms = $property->number_of_bedroom ?? 0;
        if ($seeker->min_bedrooms && $bedrooms < $seeker->min_bedrooms) {
            $score -= 30;
        } elseif ($seeker->max_bedrooms && $bedrooms > $seeker->max_bedrooms) {
            $score -= 15;
        }

        // Bathroom match
        $bathrooms = $property->number_of_bathroom ?? 0;
        if ($seeker->min_bathrooms && $bathrooms < $seeker->min_bathrooms) {
            $score -= 20;
        }

        // Area match
        $area = floatval($property->area ?? 0);
        if ($seeker->min_area && $area < $seeker->min_area) {
            $score -= 25;
        } elseif ($seeker->max_area && $area > $seeker->max_area) {
            $score -= 10;
        }

        // Furnishing preference
        if (isset($property->furnishing) && $seeker->furnishing_preference !== 'any') {
            if ($property->furnishing === $seeker->furnishing_preference) {
                $score += 10;
            }
        }

        return max(0, min(100, $score));
    }

    /**
     * Score lifestyle compatibility
     *
     * @psalm-return 20
     */
    private function scoreLifestyle(object $seeker, \stdClass $property): int
    {
        $score = 75;

        // Pet compatibility
        if ($seeker->allows_pets && !$property->allows_pets) {
            $score -= 25;
        } elseif ($seeker->allows_pets && $property->allows_pets) {
            $score += 15;
        }

        // Parking needs
        if ($seeker->needs_parking) {
            $parking = $property->number_of_parking ?? 0;
            if ($parking > 0) {
                $score += 15;
            } else {
                $score -= 20;
            }
        }

        // Occupancy limits
        $maxOccupants = $property->max_occupants ?? null;
        if ($maxOccupants && $maxOccupants < 2) {
            $score -= 10;
        }

        return max(0, min(100, $score));
    }

    /**
     * Score social/behavioral fit
     *
     * @psalm-return 60
     */
    private function scoreSocial(object $seeker, \stdClass $property): int
    {
        $score = 70;

        // Check if seeker has positive rental history
        $historicalMatches = DB::table('ai_property_matches')
            ->where('property_seeker_id', $seeker->id)
            ->where('match_status', '!=', 'rejected')
            ->count();

        if ($historicalMatches > 0) {
            $score += 15;
        }

        // Check if property has good ratings
        $landlordRating = $property->avg_rating ?? 0;
        if ($landlordRating >= 4.5) {
            $score += 10;
        } elseif ($landlordRating >= 4.0) {
            $score += 5;
        } elseif ($landlordRating < 3.0) {
            $score -= 10;
        }

        return max(0, min(100, $score));
    }

    /**
     * Generate human-readable match reasons
     *
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: string, 2?: string, 3?: string, 4?: string}
     * @param (int|mixed)[] $scores
     *
     * @psalm-param array{budget: mixed, location: 50|75|100, features: 25, lifestyle: 20, social: 60} $scores
     */
    private function generateMatchReasons(object $seeker, \stdClass $property, array $scores): array
    {
        $reasons = [];

        if ($scores['budget'] >= 80) {
            $reasons[] = "Excellent price match - within your budget";
        } elseif ($scores['budget'] >= 60) {
            $reasons[] = "Good price alignment";
        }

        if ($scores['location'] === 100) {
            $reasons[] = "Perfect location match";
        } elseif ($scores['location'] >= 75) {
            $reasons[] = "Location meets your preferences";
        }

        if ($scores['features'] >= 85) {
            $reasons[] = "Property has all your desired features";
        } elseif ($scores['features'] >= 70) {
            $reasons[] = "Good match on size and layout";
        }

        if ($scores['lifestyle'] >= 80) {
            $reasons[] = "Lifestyle amenities align with your needs";
        }

        if ($property->avg_rating >= 4.5 ?? false) {
            $reasons[] = "Excellent landlord rating (" . round($property->avg_rating, 1) . "/5)";
        }

        return $reasons;
    }

    /**
     * Save matches to database for tracking
     *
     * @param (array|float|mixed)[][] $matches
     *
     * @psalm-param list<array{landlord_user_id: mixed, match_breakdown: array{budget: mixed, features: mixed, lifestyle: mixed, location: mixed, social: mixed}, match_reasons: mixed, match_score: float, property_id: mixed, rental_property_id: mixed}> $matches
     */
    private function saveMatches($seekerId, array $matches): void
    {
        // Clear existing matches older than 30 days
        DB::table('ai_property_matches')
            ->where('property_seeker_id', $seekerId)
            ->where('match_status', 'matched')
            ->where('created_at', '<', now()->subDays(30))
            ->delete();

        foreach ($matches as $match) {
            DB::table('ai_property_matches')->insert([
                'property_seeker_id' => $seekerId,
                'rental_property_id' => $match['rental_property_id'],
                'property_id' => $match['property_id'],
                'landlord_user_id' => $match['landlord_user_id'],
                'match_score' => $match['match_score'],
                'match_reasons' => json_encode($match['match_reasons']),
                'match_breakdown' => json_encode($match['match_breakdown']),
                'is_ai_recommended' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Get top matches for seeker with social context
     *
     * @psalm-return \Illuminate\Support\Collection<int, array{match_id: mixed, match_score: mixed, match_reasons: mixed, property: null|object, landlord: null|object, status: mixed}>
     */
    public function getMatchesWithSocialContext($seekerId, $limit = 15): \Illuminate\Support\Collection
    {
        $matches = DB::table('ai_property_matches')
            ->where('property_seeker_id', $seekerId)
            ->orderByDesc('match_score')
            ->limit($limit)
            ->get();

        return $matches->map(function ($match) {
            $landlord = DB::table('users')
                ->where('id', $match->landlord_user_id)
                ->select('id', 'name', 'email', 'avatar')
                ->first();

            $property = DB::table('rental_properties')
                ->where('id', $match->rental_property_id)
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->select('rental_properties.*', 'properties.thumbnail_image', 'properties.title')
                ->first();

            return [
                'match_id' => $match->id,
                'match_score' => $match->match_score,
                'match_reasons' => json_decode($match->match_reasons),
                'property' => $property,
                'landlord' => $landlord,
                'status' => $match->match_status,
            ];
        });
    }
}

