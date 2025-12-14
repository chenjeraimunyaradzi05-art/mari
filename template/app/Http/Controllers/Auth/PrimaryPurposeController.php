<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserPrimaryPurposeService;
use App\Services\PurposeAnalyticsReporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

final class PrimaryPurposeController extends Controller
{
    public function __construct(private UserPrimaryPurposeService $purposeService, private PurposeAnalyticsReporter $purposeAnalytics)
    {
    }

    public function show(Request $request): View
    {
        /** @var User $user */
        $user = $request->user() ?? Auth::user();
        abort_unless($user, 403);

        $purposeOptions = config('signup.primary_purposes', []);
        $intentOptions = config('signup.secondary_intents', []);
        $identityOptions = config('signup.identity_alignment_options', []);

        $record = $user->primaryPurposeProfile;

        $user->onboardingEvents()->create([
            'action' => 'primary_purpose_wizard_viewed',
            'payload' => [
                'has_record' => (bool) $record,
                'account_classification' => $user->account_classification,
            ],
            'occurred_at' => now(),
        ]);

        return view('auth.primary-purpose', [
            'user' => $user,
            'purposeOptions' => $purposeOptions,
            'intentOptions' => $intentOptions,
            'identityOptions' => $identityOptions,
            'selectedPurpose' => old('primary_purpose', $record->primary_purpose ?? $user->account_classification ?? 'candidate'),
            'selectedIntents' => old('secondary_intents', $record?->secondary_intents ?? Arr::wrap(data_get($user->user_intentions, 'intent.value'))),
            'selectedAlignment' => old('identity_alignment', $record->identity_alignment ?? 'woman_identifying'),
            'purposeStory' => old('purpose_story', $record->purpose_story ?? ''),
            'maleSignalNotes' => old('male_signal_notes', $record->male_signal_notes ?? ''),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user, 403);

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
            'agency_name' => ['nullable', 'string', 'max:255'],
        ]);

        $primaryPurpose = $validated['primary_purpose'];
        $secondaryIntents = collect($validated['secondary_intents'])->unique()->values()->all();

        $maleSignalNotes = $validated['male_signal_notes'] ?? null;
        if (!empty($validated['agency_name'])) {
            $agencyName = $validated['agency_name'];
            $maleSignalNotes = "Agency: {$agencyName}\n" . $maleSignalNotes;
        }

        $record = $this->purposeService->upsert($user, [
            'primary_purpose' => $primaryPurpose,
            'secondary_intents' => $secondaryIntents,
            'identity_alignment' => $validated['identity_alignment'],
            'purpose_story' => $validated['purpose_story'] ?? null,
            'male_signal_notes' => trim($maleSignalNotes) ?: null,
        ]);

        $user->onboardingEvents()->create([
            'action' => 'primary_purpose_wizard_completed',
            'payload' => [
                'primary_purpose' => $primaryPurpose,
                'secondary_intents' => $secondaryIntents,
                'identity_alignment' => $validated['identity_alignment'],
                'feature_flags' => $record->feature_flags,
            ],
            'occurred_at' => now(),
        ]);

        if ($record->wasRecentlyCreated) {
            $user->onboardingEvents()->create([
                'action' => 'primary_purpose_wizard_first_completion',
                'payload' => ['primary_purpose' => $primaryPurpose],
                'occurred_at' => now(),
            ]);
        }

        return redirect()
            ->route('role-selection.show')
            ->with('success', 'Purpose captured. Next, tell Athena about your working roles.');
    }

    public function telemetry(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user, 403);

        $validated = $request->validate([
            'event' => ['required', 'string', 'in:abandoned,step_exit'],
            'step' => ['nullable', 'string'],
            'time_on_page' => ['nullable', 'numeric'],
            'source' => ['nullable', 'string'],
        ]);

        $action = 'primary_purpose_wizard_' . $validated['event'];

        $payload = [
            'step' => $validated['step'] ?? null,
            'time_on_page' => isset($validated['time_on_page']) ? (float) $validated['time_on_page'] : null,
            'source' => $validated['source'] ?? 'web',
        ];

        $user->onboardingEvents()->create([
            'action' => $action,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);

        // Record analytic event for funnel reporting
        $this->purposeAnalytics->report($user, $user, $action, [
            'primary_purpose' => optional($user->primaryPurposeProfile)->primary_purpose,
            'step' => $payload['step'],
            'time_on_page' => $payload['time_on_page'],
        ], $payload['source']);

        return response()->json(['ok' => true]);
    }
}

