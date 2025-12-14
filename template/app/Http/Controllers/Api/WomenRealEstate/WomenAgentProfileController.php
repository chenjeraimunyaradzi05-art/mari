<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\WomenRealEstate\WomenAgentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenAgentProfileController
{
    public function show(Request $request): JsonResponse
    {
        $profile = WomenAgentProfile::firstOrCreate([
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $profile]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'license_number' => 'nullable|string|max:190',
            'license_region' => 'nullable|string|max:120',
            'license_expires_at' => 'nullable|date',
            'accomplishments' => 'nullable|array',
            'testimonials' => 'nullable|array',
            'service_languages' => 'nullable|array',
            'availability_slots' => 'nullable|array',
            'ai_meta' => 'nullable|array',
            'visibility_preferences' => 'nullable|array',
            'is_public' => 'sometimes|boolean',
        ]);

        $profile = WomenAgentProfile::updateOrCreate(
            ['user_id' => $request->user()->id],
            $payload,
        );

        return response()->json(['data' => $profile->fresh()]);
    }
}

