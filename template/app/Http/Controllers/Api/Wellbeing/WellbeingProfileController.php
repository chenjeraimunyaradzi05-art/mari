<?php

namespace App\Http\Controllers\Api\Wellbeing;

use App\Http\Controllers\Controller;
use App\Models\WellbeingProfile;
use App\Support\Wellbeing\WellbeingInterestService;
use App\Support\Wellbeing\WellbeingTelemetryService;
use App\Services\Wellbeing\AiWellnessCoachService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WellbeingProfileController extends Controller
{
    public function __construct(
        private readonly WellbeingInterestService $interestService,
        private readonly WellbeingTelemetryService $telemetryService,
        private readonly AiWellnessCoachService $coach,
    )
    {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $profile = $user->wellbeingProfile;
        $interestTags = $profile
            ? $this->interestService->tagsFromProfile($profile)
            : $this->interestService->inferFromUser($user);

        $plan = $profile ? $this->coach->generatePlan($user) : null;

        return response()->json([
            'profile' => $profile,
            'interest_tags' => $interestTags,
            'plan' => $plan,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $payload = $request->validate([
            'movement_level' => ['nullable', 'string', 'max:32'],
            'pref_yoga' => ['required', 'boolean'],
            'pref_running' => ['required', 'boolean'],
            'pref_strength' => ['required', 'boolean'],
            'pref_team_sport' => ['required', 'boolean'],
            'pref_outdoors' => ['required', 'boolean'],
            'pref_meditation' => ['required', 'boolean'],
            'pref_vipassana' => ['required', 'boolean'],
            'pref_body_positive' => ['sometimes', 'boolean'],
            'pref_adaptive' => ['sometimes', 'boolean'],
            'pref_dv_safe' => ['sometimes', 'boolean'],
            'pref_prenatal_postnatal' => ['sometimes', 'boolean'],
            'goals' => ['nullable', 'string', 'max:5000'],
            'constraints' => ['nullable', 'string', 'max:5000'],
            'health_topics' => ['nullable', 'string', 'max:5000'],
            'availability' => ['nullable', 'string', 'max:255'],
            'energy_pattern' => ['nullable', 'string', 'max:255'],
        ]);

        $profile = WellbeingProfile::updateOrCreate(
            ['user_id' => $user->getKey()],
            $payload,
        );

        $interestTags = $this->interestService->tagsFromProfile($profile);
        $this->interestService->syncUserInterests($user, $interestTags);
        $this->interestService->syncProfileHealthInterests($user, $profile);
        $this->telemetryService->recordProfileSaved($user, $profile, $interestTags);

        return response()->json([
            'profile' => $profile->fresh(),
            'interest_tags' => $interestTags,
            'message' => 'Wellbeing preferences saved.',
        ]);
    }
}

