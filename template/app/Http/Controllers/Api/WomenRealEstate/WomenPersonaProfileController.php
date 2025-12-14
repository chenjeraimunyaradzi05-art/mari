<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\WomenRealEstate\WomenPersonaProfile;
use App\Models\WomenRealEstate\WomenUserMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

final class WomenPersonaProfileController
{
    public function show(Request $request): JsonResponse
    {
        $persona = $this->determinePersona($request->input('persona'));

        $profile = WomenPersonaProfile::firstOrCreate(
            ['user_id' => $request->user()->id, 'persona' => $persona],
            []
        );

        return response()->json([
            'data' => $profile->fresh(),
            'media_options' => $this->mediaOptions($request->user()->id),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'persona' => ['nullable', Rule::in(WomenPersonaProfile::PERSONAS)],
            'identity' => 'nullable|array',
            'household' => 'nullable|array',
            'lifestyle' => 'nullable|array',
            'work' => 'nullable|array',
            'transport' => 'nullable|array',
            'media' => 'nullable|array',
            'ai_meta' => 'nullable|array',
            'social_meta' => 'nullable|array',
            'visibility_preferences' => 'nullable|array',
            'featured_media_id' => 'nullable|exists:women_real_estate_user_media,id',
            'highlight_in_feed' => 'sometimes|boolean',
            'auto_share_opt_in' => 'sometimes|boolean',
            'reason' => 'nullable|string|max:250',
        ]);

        $persona = $this->determinePersona($payload['persona'] ?? null);

        $profile = WomenPersonaProfile::firstOrNew([
            'user_id' => $request->user()->id,
            'persona' => $persona,
        ]);

        $profile->fill(Arr::except($payload, ['persona', 'reason']));
        $profile->refreshCompletionScore();
        $profile->save();

        $profile->recordAudit(
            changes: Arr::except($payload, ['persona', 'reason']),
            visibilitySnapshot: $profile->visibility_preferences ?? [],
            actorId: $request->user()->id,
            reason: $payload['reason'] ?? null,
        );

        $profile->markUpdated();

        return response()->json([
            'data' => $profile->fresh(),
            'media_options' => $this->mediaOptions($request->user()->id),
        ]);
    }

    private function determinePersona(?string $persona): string
    {
        if ($persona && in_array($persona, WomenPersonaProfile::PERSONAS, true)) {
            return $persona;
        }

        return WomenPersonaProfile::PERSONA_HOUSEHUNTER;
    }

    /**
     * @psalm-return array<int, mixed>
     */
    private function mediaOptions(int $userId): array
    {
        return WomenUserMedia::query()
            ->select(['id', 'media_type', 'caption'])
            ->where('user_id', $userId)
            ->latest('id')
            ->limit(40)
            ->get()
            ->toArray();
    }

}

