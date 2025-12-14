<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AIPropertyMatchingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * PropertySeekerController
 *
 * Manage buyer/renter profiles and their search preferences
 */
final class PropertySeekerController extends Controller
{
    protected $matchingService;

    public function __construct(AIPropertyMatchingService $matchingService)
    {
        $this->matchingService = $matchingService;
    }

    /**
     * Create or update property seeker profile
     */
    public function createOrUpdateProfile(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $data = $request->validate([
                'seeker_type' => 'required|in:renter,buyer,investor',
                'location_preferences' => 'nullable|json',
                'property_type_preferences' => 'nullable|json',
                'min_budget' => 'nullable|numeric|min:0',
                'max_budget' => 'nullable|numeric|min:0',
                'min_bedrooms' => 'nullable|integer|min:0',
                'max_bedrooms' => 'nullable|integer|min:0',
                'min_bathrooms' => 'nullable|integer|min:0',
                'max_bathrooms' => 'nullable|integer|min:0',
                'min_area' => 'nullable|numeric|min:0',
                'max_area' => 'nullable|numeric|min:0',
                'must_have_features' => 'nullable|json',
                'nice_to_have_features' => 'nullable|json',
                'furnishing_preference' => 'required|in:unfurnished,partially_furnished,furnished,any',
                'allows_pets' => 'nullable|boolean',
                'needs_parking' => 'nullable|boolean',
                'preferred_move_in_days' => 'nullable|integer|min:0',
                'lifestyle_preferences' => 'nullable|json',
            ]);

            // Check if profile exists
            $existing = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                // Update
                DB::table('property_seekers')
                    ->where('user_id', $user->id)
                    ->update(array_merge($data, ['updated_at' => now()]));

                $seekerId = $existing->id;
                $message = 'Profile updated successfully';
            } else {
                // Create
                $seekerId = DB::table('property_seekers')->insertGetId(array_merge($data, [
                    'user_id' => $user->id,
                    'profile_completion_percentage' => $this->calculateCompletion($data),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));

                $message = 'Profile created successfully';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'seeker_id' => $seekerId,
                'profile_completion' => $this->calculateCompletion($data),
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to create profile',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get seeker profile
     */
    public function getProfile(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $profile = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if (!$profile) {
                return response()->json(['error' => 'Profile not found'], 404);
            }

            // Get match statistics
            $matchStats = DB::table('ai_property_matches')
                ->where('property_seeker_id', $profile->id)
                ->selectRaw('
                    COUNT(*) as total_matches,
                    SUM(CASE WHEN match_status = "viewed" THEN 1 ELSE 0 END) as viewed,
                    SUM(CASE WHEN match_status = "inquired" THEN 1 ELSE 0 END) as inquired,
                    AVG(match_score) as avg_match_score
                ')
                ->first();

            return response()->json([
                'success' => true,
                'profile' => $profile,
                'match_statistics' => [
                    'total_matches' => $matchStats->total_matches ?? 0,
                    'viewed' => $matchStats->viewed ?? 0,
                    'inquired' => $matchStats->inquired ?? 0,
                    'avg_match_score' => round($matchStats->avg_match_score ?? 0, 2),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch profile',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get AI-powered property matches
     */
    public function getAIMatches(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $seeker = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if (!$seeker) {
                return response()->json(['error' => 'Seeker profile not found'], 404);
            }

            $limit = $request->get('limit', 20);
            $request->get('min_score', 50);

            $matches = $this->matchingService->getMatchesWithSocialContext($seeker->id, $limit);

            return response()->json([
                'success' => true,
                'count' => count($matches),
                'matches' => $matches,
                'seeker_type' => $seeker->seeker_type,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch matches',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Record match as viewed
     */
    public function viewMatch($matchId): \Illuminate\Http\JsonResponse
    {
        try {
            $match = DB::table('ai_property_matches')
                ->where('id', $matchId)
                ->first();

            if (!$match) {
                return response()->json(['error' => 'Match not found'], 404);
            }

            DB::table('ai_property_matches')
                ->where('id', $matchId)
                ->update([
                    'match_status' => 'viewed',
                    'viewed_at' => now(),
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Match recorded as viewed',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to record view',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject a match
     */
    public function rejectMatch($matchId): \Illuminate\Http\JsonResponse
    {
        try {
            $match = DB::table('ai_property_matches')
                ->where('id', $matchId)
                ->first();

            if (!$match) {
                return response()->json(['error' => 'Match not found'], 404);
            }

            DB::table('ai_property_matches')
                ->where('id', $matchId)
                ->update([
                    'match_status' => 'rejected',
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Match rejected',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to reject match',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get search history and recommendations
     */
    public function getRecommendations(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $seeker = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if (!$seeker) {
                return response()->json(['error' => 'Seeker profile not found'], 404);
            }

            // Get top 10 matches with highest scores
            $recommendations = DB::table('ai_property_matches')
                ->where('property_seeker_id', $seeker->id)
                ->where('match_status', '!=', 'rejected')
                ->orderByDesc('match_score')
                ->limit(10)
                ->get();

            return response()->json([
                'success' => true,
                'count' => count($recommendations),
                'recommendations' => $recommendations,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch recommendations',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate profile completion percentage
     */
    private function calculateCompletion(array $data): int
    {
        $fields = ['seeker_type', 'location_preferences', 'property_type_preferences',
                   'min_budget', 'max_budget', 'min_bedrooms', 'must_have_features'];

        $filled = 0;
        foreach ($fields as $field) {
            if (!empty($data[$field] ?? false)) {
                $filled++;
            }
        }

        return intval(($filled / count($fields)) * 100);
    }
}

