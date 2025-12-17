<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Business\BusinessProfile;
use App\Models\User;
use App\Services\Growth\ExperimentService;
use App\Services\Growth\MarketingAttributionService;
use App\Services\Growth\ReferralService;
use App\Services\Guardians\RegistrationIdentityFlagger;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\View\View;
use Illuminate\Support\Str;

use App\Services\UserPrimaryPurposeService;

final class RegisteredUserController extends Controller
{
    public function __construct(
        private RegistrationIdentityFlagger $registrationIdentityFlagger,
        private MarketingAttributionService $attributionService,
        private ExperimentService $experimentService,
        private ReferralService $referralService,
        private UserPrimaryPurposeService $purposeService
    )
    {
    }

    /**
     * Display the registration view.
     */
    public function create(): View
    {
        return view('auth.register', [
            'accountOptions' => $this->accountTypeOptions(),
            'intentOptions' => $this->intentOptions(),
            'portalOptions' => $this->portalOptions(),
            'wellnessOptions' => $this->wellnessPreferenceOptions(),
            'pronounOptions' => $this->pronounOptions(),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $accountTypes = array_keys($this->accountTypeOptions());
        $intentKeys = array_keys($this->intentOptions());
        $portalKeys = array_keys($this->portalOptions());
        $wellnessKeys = array_keys($this->wellnessPreferenceOptions());
        $pronounKeys = array_keys($this->pronounOptions());

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'account_type' => ['required', Rule::in($accountTypes)],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'pronouns' => ['required', Rule::in($pronounKeys)],
            'pronouns_custom' => ['nullable', 'string', 'max:50', 'required_if:pronouns,self_described'],
            'intent' => ['required', Rule::in($intentKeys)],
            'desired_portals' => ['required', 'array', 'min:1'],
            'desired_portals.*' => ['string', Rule::in($portalKeys)],
            'wellness_preferences' => ['nullable', 'array'],
            'wellness_preferences.*' => ['string', Rule::in($wellnessKeys)],
        ]);

        $accountType = $validated['account_type'] ?? 'candidate';

        $role = match ($accountType) {
            'company',
            'business_network',
            'real_estate',
            'tafe_university',
            'financial_literacy' => 'company',
            default => 'candidate',
        };

        $intentOptions = $this->intentOptions();
        $portalOptions = $this->portalOptions();
        $wellnessOptions = $this->wellnessPreferenceOptions();
        $pronounOptions = $this->pronounOptions();

        $selectedPronouns = $validated['pronouns'] === 'self_described'
            ? trim((string) ($validated['pronouns_custom'] ?? ''))
            : ($pronounOptions[$validated['pronouns']]['label'] ?? $validated['pronouns']);

        $intentions = array_filter([
            'pronouns' => $selectedPronouns,
            'intent' => [
                'value' => $validated['intent'],
                'label' => $intentOptions[$validated['intent']]['title'] ?? Str::headline($validated['intent']),
                'summary' => $intentOptions[$validated['intent']]['summary'] ?? null,
            ],
            'desired_portals' => collect($validated['desired_portals'] ?? [])
                ->unique()
                ->map(function (string $value) use ($portalOptions) {
                    $option = $portalOptions[$value] ?? [];

                    return [
                        'value' => $value,
                        'label' => $option['label'] ?? Str::headline($value),
                        'description' => $option['description'] ?? null,
                    ];
                })
                ->values()
                ->all(),
            'wellness_preferences' => collect($validated['wellness_preferences'] ?? [])
                ->unique()
                ->map(function (string $value) use ($wellnessOptions) {
                    $option = $wellnessOptions[$value] ?? [];

                    return [
                        'value' => $value,
                        'label' => $option['label'] ?? Str::headline($value),
                    ];
                })
                ->values()
                ->all(),
        ], fn ($value) => ! empty($value));

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $role,
            'account_classification' => $accountType,
            'pronouns' => $selectedPronouns,
            'user_intentions' => $intentions,
            'primary_role' => 'member',
            'secondary_roles' => [],
            'first_login' => true,
            'onboarding_completed' => false,
            'profile_completion_percentage' => 20,
            'profile_completed' => false,
        ]);

        event(new Registered($user));

        Auth::login($user);

        // Create Primary Purpose Record
        $this->purposeService->upsert($user, [
            'primary_purpose' => $accountType,
            'secondary_intents' => [$validated['intent']],
            'identity_alignment' => 'woman_identifying', // Default for now, or capture in form if needed
            'purpose_story' => null,
            'male_signal_notes' => null,
        ]);

        BusinessProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'venture_name' => $user->name.' Studio',
                'tagline' => 'Women-owned. Business Network powered.',
                'focus_pillars' => ['capital readiness', 'distribution', 'community'],
                'support_needs' => ['pilot customers', 'mentor circle'],
                'hero_theme' => 'blush',
                'slug' => BusinessProfile::generateUniqueSlug($user->name ?? 'business-hub'),
            ]
        );

        if ($user->account_classification === 'tafe_university') {
            $this->ensureTafeInstitution($user);
        }

        $this->registrationIdentityFlagger->handle($user, [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'pronouns' => $validated['pronouns'],
            'account_type' => $accountType,
            'intent' => $validated['intent'],
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        // Growth & Attribution Tracking
        $this->attributionService->attributeConversion($user);
        $this->experimentService->trackConversion('signup');

        // Handle Referral
        if (session()->has('referral_code')) {
            try {
                $this->referralService->acceptReferral(session()->get('referral_code'), $user);
                session()->forget('referral_code');
            } catch (\Exception $e) {
                // Fail silently if referral code is invalid or expired
            }
        }

        return redirect()->route('role-selection.show');
    }

    private function ensureTafeInstitution(User $user): void
    {
        if ($user->tafeInstitution) {
            return;
        }

        $placeholderName = $user->name." Education Hub";

        $institution = $user->tafeInstitution()->create([
            'name' => $placeholderName,
            'slug' => Str::slug($placeholderName).'-'.Str::random(4),
            'institution_type' => 'tafe',
            'tagline' => 'Designing future-ready pathways for women and gender-diverse students.',
            'summary' => 'Complete your institution setup to launch programmes, track cohorts, and connect directly with high-intent learners.',
            'mission_statement' => 'Increase wraparound support, industry placements, and co-created curriculum for women.',
            'brand_color' => '#E668B3',
            'status' => 'draft',
        ]);

        if ($institution && !$institution->socialProfile) {
            $institution->socialProfile()->create([
                'username' => Str::slug($institution->slug).'-edu',
                'display_name' => $institution->name,
                'profile_type' => 'education_provider',
                'bio' => 'Championing bold learning experiences for ambitious women.',
            ]);
        }
    }

    private function accountTypeOptions(): array
    {
        return config('signup.primary_purposes', []);
    }

    /**
     * @return (string|true)[][]
     *
     * @psalm-return array{she_her: array{label: 'She / Her'}, they_them: array{label: 'They / Them'}, he_him: array{label: 'He / Him'}, she_they: array{label: 'She / They'}, self_described: array{label: 'Self-described', requires_input: true}}
     */
    private function pronounOptions(): array
    {
        return [
            'she_her' => ['label' => 'She / Her'],
            'they_them' => ['label' => 'They / Them'],
            'he_him' => ['label' => 'He / Him'],
            'she_they' => ['label' => 'She / They'],
            'self_described' => ['label' => 'Self-described', 'requires_input' => true],
        ];
    }

    private function intentOptions(): array
    {
        return config('signup.secondary_intents', []);
    }

    /**
     * @return string[][]
     *
     * @psalm-return array{real_estate: array{label: 'Women Real Estate', description: 'Listings, relocation support, verified agents, and housing pathways.'}, business: array{label: 'Business Network', description: 'Founder hubs, supplier showcases, and capital matchmaking.'}, social_feed: array{label: 'Social & Community Feed', description: 'Story-driven community spaces with curated introductions.'}, public_sector: array{label: 'Public Sector & Policy', description: 'Civic labs, procurement journeys, and policy programs.'}, education: array{label: 'Education & TAFE', description: 'Learning pathways, upskilling programs, and institution partners.'}, financial_wellbeing: array{label: 'Financial Wellbeing', description: 'Money circles, literacy resources, and wellness challenges.'}}
     */
    private function portalOptions(): array
    {
        return [
            'real_estate' => [
                'label' => 'Women Real Estate',
                'description' => 'Listings, relocation support, verified agents, and housing pathways.',
            ],
            'business' => [
                'label' => 'Business Network',
                'description' => 'Founder hubs, supplier showcases, and capital matchmaking.',
            ],
            'social_feed' => [
                'label' => 'Social & Community Feed',
                'description' => 'Story-driven community spaces with curated introductions.',
            ],
            'public_sector' => [
                'label' => 'Public Sector & Policy',
                'description' => 'Civic labs, procurement journeys, and policy programs.',
            ],
            'education' => [
                'label' => 'Education & TAFE',
                'description' => 'Learning pathways, upskilling programs, and institution partners.',
            ],
            'financial_wellbeing' => [
                'label' => 'Financial Wellbeing',
                'description' => 'Money circles, literacy resources, and wellness challenges.',
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return array{caregiver_friendly: array{label: 'Caregiver-friendly pacing'}, trauma_informed: array{label: 'Trauma-informed content warnings'}, restorative_first: array{label: 'Rest-first scheduling nudges'}, sensory_safe: array{label: 'Sensory-safe design cues'}, celebratory_checkins: array{label: 'Celebratory accountability check-ins'}}
     */
    private function wellnessPreferenceOptions(): array
    {
        return [
            'caregiver_friendly' => ['label' => 'Caregiver-friendly pacing'],
            'trauma_informed' => ['label' => 'Trauma-informed content warnings'],
            'restorative_first' => ['label' => 'Rest-first scheduling nudges'],
            'sensory_safe' => ['label' => 'Sensory-safe design cues'],
            'celebratory_checkins' => ['label' => 'Celebratory accountability check-ins'],
        ];
    }
}

