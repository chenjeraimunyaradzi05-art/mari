<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\OnboardingEvent;
use App\Models\User;
use App\Services\PurposeAnalyticsReporter;
use App\Services\UserPrimaryPurposeService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PurposeSettingsController extends Controller
{
    public function __construct(
        private UserPrimaryPurposeService $purposeService,
        private PurposeAnalyticsReporter $purposeAnalytics
    ) {
        $this->middleware(['auth']);
    }

    public function edit(Request $request): View
    {
        /** @var User $viewer */
        $viewer = $request->user();
        $target = $this->resolveTargetUser($request, $viewer);

        $purposeOptions = config('signup.primary_purposes', []);
        $intentOptions = config('signup.secondary_intents', []);
        $identityOptions = config('signup.identity_alignment_options', []);
        $record = $target->primaryPurposeProfile;

        $events = OnboardingEvent::query()
            ->where('user_id', $target->id)
            ->whereIn('action', [
                'primary_purpose_wizard_viewed',
                'primary_purpose_wizard_completed',
                'primary_purpose_wizard_first_completion',
                'primary_purpose_settings_updated',
                'primary_purpose_api_updated',
            ])
            ->orderByDesc('occurred_at')
            ->limit(25)
            ->get();

        return view('account.purpose.edit', [
            'viewer' => $viewer,
            'targetUser' => $target,
            'record' => $record,
            'purposeOptions' => $purposeOptions,
            'intentOptions' => $intentOptions,
            'identityOptions' => $identityOptions,
            'events' => $events,
            'canReviewOthers' => $this->canReviewOthers($viewer),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        /** @var User $viewer */
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
            'target_user_id' => ['nullable', 'integer'],
        ]);

        $record = $this->purposeService->upsert($target, [
            'primary_purpose' => $validated['primary_purpose'],
            'secondary_intents' => $validated['secondary_intents'],
            'identity_alignment' => $validated['identity_alignment'],
            'purpose_story' => $validated['purpose_story'] ?? null,
            'male_signal_notes' => $validated['male_signal_notes'] ?? null,
        ], false);

        $target->onboardingEvents()->create([
            'action' => 'primary_purpose_settings_updated',
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
            event: 'primary_purpose_settings_updated',
            properties: [
                'primary_purpose' => $validated['primary_purpose'],
                'secondary_intents' => $validated['secondary_intents'],
                'secondary_intent_count' => count($validated['secondary_intents']),
                'identity_alignment' => $validated['identity_alignment'],
                'feature_flags' => $record->feature_flags,
            ],
            source: 'account-settings'
        );

        return redirect()
            ->route('account.purpose.edit', $viewer->id !== $target->id ? ['user_id' => $target->id] : [])
            ->with('success', 'Purpose and access settings updated.');
    }

    private function resolveTargetUser(Request $request, User $viewer, bool $forUpdate = false): User
    {
        if (! $this->canReviewOthers($viewer)) {
            return $viewer;
        }

        $lookup = $request->input('user_id') ?? $request->input('target_user_id');

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

        if ($forUpdate && $target->id !== $viewer->id && ! $this->canReviewOthers($viewer)) {
            abort(403);
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

