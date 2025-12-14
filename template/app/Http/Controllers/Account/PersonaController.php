<?php

namespace App\Http\Controllers\Account;

use App\Events\PersonaSwitched;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePersonaRequest;
use App\Http\Requests\UpdatePersonaRequest;
use App\Http\Resources\ProfileResource;
use App\Models\Profile;
use App\Services\Privacy\PrivacyTierService;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\SocialProfileProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class PersonaController extends Controller
{
    public function __construct(
        private SocialProfileProvisioner $socialProfileProvisioner,
        private PrivacyTierService $privacyTiers,
        private RealTimeAnalyticsEngine $analytics,
    )
    {
    }

    public function index(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $profiles = $request->user()
            ->profiles()
            ->with('badges')
            ->orderByDesc('is_active')
            ->orderByDesc('is_primary')
            ->orderBy('created_at')
            ->get();

        return ProfileResource::collection($profiles);
    }

    public function activeContext(Request $request): JsonResponse
    {
        $user = $request->user();
        $activeProfile = $user->activeProfile?->load('badges');

        $profiles = $user->profiles()
            ->with('badges')
            ->orderByDesc('is_active')
            ->orderByDesc('is_primary')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => [
                'active_profile' => $activeProfile ? (new ProfileResource($activeProfile))->resolve() : null,
                'available_personas' => ProfileResource::collection($profiles)->resolve(),
                'switch_contexts' => Profile::SWITCH_CONTEXTS,
            ],
        ]);
    }

    public function store(StorePersonaRequest $request): JsonResponse
    {
        $user = $request->user();

        $profile = DB::transaction(function () use ($user, $request) {
            $payload = $request->validated();
            $isFirstProfile = !$user->profiles()->exists();
            $privacyTier = $payload['privacy_tier'] ?? null;

            $profile = $user->profiles()->create(array_merge($payload, [
                'is_primary' => $isFirstProfile,
            ]));

            if ($privacyTier) {
                $this->privacyTiers->applyTier($profile, $privacyTier);
                $profile->save();
            }

            $this->socialProfileProvisioner->provisionForProfile($profile);

            if ($isFirstProfile || !$user->active_profile_id) {
                $user->switchActiveProfile($profile);
            }

            if (!$user->age_bracket && $profile->age_bracket) {
                $user->forceFill(['age_bracket' => $profile->age_bracket])->save();
            }

            return $profile->fresh('badges');
        });

        return (new ProfileResource($profile))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdatePersonaRequest $request, Profile $profile): ProfileResource
    {
        $profile = $this->ensureOwnership($request, $profile);
        $profile->fill($request->validated());
        $profile->save();

        $this->socialProfileProvisioner->provisionForProfile($profile);

        return new ProfileResource($profile->fresh('badges'));
    }

    public function switchActive(Profile $profile, Request $request): ProfileResource
    {
        $profile = $this->ensureOwnership($request, $profile);
        $context = $this->validateContext($request);

        $this->socialProfileProvisioner->provisionForProfile($profile);
        $request->user()->switchActiveProfile($profile, $context);
        $profile->refresh();

        event(new PersonaSwitched($request->user(), $profile, $context));

        $this->analytics->record('persona.switched', [
            'source' => 'account.persona-switcher',
            'properties' => [
                'user_id' => $request->user()->id,
                'profile_id' => $profile->id,
                'persona_type' => $profile->persona_type,
                'context' => $context,
            ],
        ]);

        return new ProfileResource($profile->load('badges'));
    }

    private function ensureOwnership(Request $request, Profile $profile): Profile
    {
        abort_if($profile->user_id !== $request->user()->id, 403, 'You do not have access to this persona.');

        return $profile;
    }

    private function validateContext(Request $request): ?string
    {
        $payload = $request->validate([
            'context' => ['nullable', Rule::in(Profile::SWITCH_CONTEXTS)],
        ]);

        return $payload['context'] ?? null;
    }
}

