<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserPrimaryPurpose;
use App\Services\PurposeAnalyticsReporter;
use App\Services\UserPrimaryPurposeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PrimaryPurposeApiController extends Controller
{
    public function __construct(
        private UserPrimaryPurposeService $purposeService,
        private PurposeAnalyticsReporter $purposeAnalytics
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $target = $this->resolveTargetUser($request, $viewer);
        $record = $target->primaryPurposeProfile;

        return response()->json([
            'record' => $record ? $this->transformRecord($record) : null,
            'options' => [
                'primary_purposes' => config('signup.primary_purposes', []),
                'secondary_intents' => config('signup.secondary_intents', []),
                'identity_alignment' => config('signup.identity_alignment_options', []),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $target = $this->resolveTargetUser($request, $viewer, true);

        $purposeKeys = array_keys(config('signup.primary_purposes', []));
        $intentKeys = array_keys(config('signup.secondary_intents', []));
        $alignmentKeys = array_keys(config('signup.identity_alignment_options', []));

        $validated = $request->validate([
            'primary_purpose' => ['required', 'string', Rule::in($purposeKeys)],
            'secondary_intents' => ['required', 'array', 'min:1'],
            'secondary_intents.*' => ['string', Rule::in($intentKeys)],
            'identity_alignment' => ['required', 'string', Rule::in($alignmentKeys)],
            'purpose_story' => ['nullable', 'string', 'max:600'],
            'male_signal_notes' => ['nullable', 'string', 'max:600'],
        ]);

        $record = $this->purposeService->upsert($target, [
            'primary_purpose' => $validated['primary_purpose'],
            'secondary_intents' => $validated['secondary_intents'],
            'identity_alignment' => $validated['identity_alignment'],
            'purpose_story' => $validated['purpose_story'] ?? null,
            'male_signal_notes' => $validated['male_signal_notes'] ?? null,
        ]);

        $target->onboardingEvents()->create([
            'action' => 'primary_purpose_api_updated',
            'payload' => [
                'primary_purpose' => $validated['primary_purpose'],
                'secondary_intents' => $validated['secondary_intents'],
                'identity_alignment' => $validated['identity_alignment'],
                'feature_flags' => $record->feature_flags,
                'updated_by_guardian' => $viewer->id !== $target->id,
            ],
            'occurred_at' => now(),
        ]);

        $this->purposeAnalytics->report(
            actor: $viewer,
            target: $target,
            event: 'primary_purpose_api_updated',
            properties: [
                'primary_purpose' => $validated['primary_purpose'],
                'secondary_intents' => $validated['secondary_intents'],
                'secondary_intent_count' => count($validated['secondary_intents']),
                'identity_alignment' => $validated['identity_alignment'],
                'feature_flags' => $record->feature_flags,
                'updated_by_guardian' => $viewer->id !== $target->id,
            ],
            source: 'mobile-api'
        );

        return response()->json([
            'record' => $this->transformRecord($record),
        ]);
    }

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{primary_purpose: string, secondary_intents: array, identity_alignment: string, purpose_story: null|string, male_signal_notes: null|string, feature_flags: array, completed_at: string, updated_at: string}
     */
    private function transformRecord(UserPrimaryPurpose $record): array
    {
        return [
            'primary_purpose' => $record->primary_purpose,
            'secondary_intents' => $record->secondary_intents ?? [],
            'identity_alignment' => $record->identity_alignment,
            'purpose_story' => $record->purpose_story,
            'male_signal_notes' => $record->male_signal_notes,
            'feature_flags' => $record->feature_flags ?? [],
            'completed_at' => optional($record->completed_at)->toIso8601String(),
            'updated_at' => optional($record->updated_at)->toIso8601String(),
        ];
    }

    private function resolveTargetUser(Request $request, User $viewer, bool $forUpdate = false): User
    {
        if (! $this->canReviewOthers($viewer)) {
            return $viewer;
        }

        $lookup = $forUpdate
            ? $request->input('target_user_id')
            : $request->query('user_id');

        if (! $lookup) {
            return $viewer;
        }

        $query = User::query();

        if (is_numeric($lookup)) {
            $target = $query->find($lookup);
        } else {
            $target = $query->where('email', trim((string) $lookup))->first();
        }

        if (! $target) {
            abort(404, 'Member not found.');
        }

        return $target;
    }

    private function canReviewOthers(User $user): bool
    {
        if (method_exists($user, 'can') && $user->can('review primary purposes')) {
            return true;
        }

        if (method_exists($user, 'hasAnyRole') && $user->hasAnyRole([
            'admin',
            'administrator',
            'guardian',
            'guardian_team',
            'safety_team',
        ])) {
            return true;
        }

        return false;
    }
}

