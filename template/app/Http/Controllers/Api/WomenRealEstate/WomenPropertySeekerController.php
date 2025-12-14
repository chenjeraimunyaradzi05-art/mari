<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\WomenRealEstate\WomenPropertySeeker;
use App\Models\WomenRealEstate\WomenPropertyMatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenPropertySeekerController
{
    public function createOrUpdateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seeker_type' => 'required|in:renter,buyer,investor',
            'location_preferences' => 'nullable|json',
            'property_type_preferences' => 'nullable|json',
            'min_budget' => 'nullable|numeric|min:0',
            'max_budget' => 'nullable|numeric|min:0',
            'min_bedrooms' => 'nullable|integer|min:0',
            'max_bedrooms' => 'nullable|integer|min:0',
            'allows_pets' => 'nullable|boolean',
            'needs_parking' => 'nullable|boolean',
            'lifestyle_preferences' => 'nullable|json',
        ]);

        $seeker = WomenPropertySeeker::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return response()->json(['data' => $seeker], 201);
    }

    public function getProfile(Request $request): JsonResponse
    {
        $seeker = WomenPropertySeeker::where('user_id', $request->user()->id)->firstOrFail();

        return response()->json(['data' => $seeker]);
    }

    public function getAIMatches(Request $request): JsonResponse
    {
        $seeker = WomenPropertySeeker::where('user_id', $request->user()->id)->firstOrFail();

        $matches = WomenPropertyMatch::where('property_seeker_id', $seeker->id)
            ->orderByDesc('match_score')
            ->paginate(10);

        return response()->json([
            'data' => $matches->items(),
            'pagination' => [
                'total' => $matches->total(),
                'per_page' => $matches->perPage(),
            ],
        ]);
    }

    public function getRecommendations(Request $request): JsonResponse
    {
        $seeker = WomenPropertySeeker::where('user_id', $request->user()->id)->firstOrFail();

        $recommendations = WomenPropertyMatch::where('property_seeker_id', $seeker->id)
            ->where('is_ai_recommended', true)
            ->where('match_status', '!=', 'rejected')
            ->orderByDesc('match_score')
            ->limit(10)
            ->get();

        return response()->json(['data' => $recommendations]);
    }

    public function viewMatch(Request $request, $matchId): JsonResponse
    {
        $match = WomenPropertyMatch::findOrFail($matchId);
        $match->update(['viewed_at' => now(), 'match_status' => 'viewed']);

        return response()->json(['data' => $match]);
    }

    public function rejectMatch(Request $request, $matchId): JsonResponse
    {
        $match = WomenPropertyMatch::findOrFail($matchId);
        $match->update(['match_status' => 'rejected']);

        return response()->json(['data' => $match]);
    }
}

