<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Onboarding;

use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use App\Models\WomenRealEstate\WomenPropertySeeker;
use App\Models\WomenRealEstate\WomenSocialNetworkConnection;
use App\Models\WomenRealEstate\WomenUserMedia;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Services\WomenRealEstate\Ai\WomenPersonaAiService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.app')]
final class JourneyHub extends Component
{
    public ?string $path = null;

    public ?string $buyerPlan = null;

    public bool $completed = false;

    public bool $profileComplete = false;

    public bool $mediaComplete = false;

    public bool $socialComplete = false;

    public array $personaCoachTips = [];

    public bool $personaCoachFromAi = false;

    public ?string $personaCoachProvider = null;

    protected $listeners = [
        'realEstateProfileProgress' => 'hydrateProgress',
        'realEstateMediaProgress' => 'hydrateProgress',
        'realEstateSocialProgress' => 'hydrateProgress',
    ];

    protected array $rules = [
        'path' => 'nullable|string',
        'buyerPlan' => 'nullable|string',
    ];

    public function mount(): void
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (! $user instanceof User) {
            return;
        }

        $this->path = $user->real_estate_entry_path;
        $this->buyerPlan = $user->real_estate_financing_plan;
        $this->completed = (bool) $user->real_estate_onboarded_at;

        $this->hydrateProgress();
    }

    public function selectPath(string $path, ?string $plan = null): void
    {
        $path = strtolower($path);
        $definitions = $this->pathDefinitions();

        if (! array_key_exists($path, $definitions)) {
            $this->addError('path', 'Select a valid pathway.');
            return;
        }

        if ($path === 'buy') {
            $plan = in_array($plan, ['cash', 'mortgage'], true)
                ? $plan
                : ($this->buyerPlan ?? 'mortgage');
            $this->buyerPlan = $plan;
        } else {
            $this->buyerPlan = null;
        }

        $this->path = $path;
        $this->persistSelection();
    }

    public function markCompleted(): void
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (! $user instanceof User) {
            return;
        }

        if (! $this->requirementsMet) {
            $this->addError('requirements', 'Complete your profile, media, and community steps before saving.');
            return;
        }

        if (! $user->real_estate_entry_path) {
            $this->addError('path', 'Choose one of the pathways first.');
            return;
        }

        $user->forceFill([
            'real_estate_onboarded_at' => now(),
        ])->save();

        $this->completed = true;
        session()->flash('realEstateOnboardingComplete', 'You are ready to explore the WomenRise real estate console.');
    }

    public function refreshPersonaCoachPanel(): void
    {
        $this->hydratePersonaCoach(force: true);
    }

    public function getRequirementsMetProperty(): bool
    {
        return $this->profileComplete && $this->mediaComplete && $this->socialComplete;
    }

    /**
     * @return (bool|string)[][]
     *
     * @psalm-return list{array{key: 'profile', label: string, description: string, complete: bool}, array{key: 'media', label: 'Media locker', description: 'Upload at least one photo or video so listings and posts have visuals ready.', complete: bool}, array{key: 'social', label: 'Community connections', description: 'Accept or create one trusted connection in the WomenRise network.', complete: bool}}
     */
    public function getProgressStepsProperty(): array
    {
        return [
            [
                'key' => 'profile',
                'label' => $this->profileLabel(),
                'description' => $this->profileDescription(),
                'complete' => $this->profileComplete,
            ],
            [
                'key' => 'media',
                'label' => 'Media locker',
                'description' => 'Upload at least one photo or video so listings and posts have visuals ready.',
                'complete' => $this->mediaComplete,
            ],
            [
                'key' => 'social',
                'label' => 'Community connections',
                'description' => 'Accept or create one trusted connection in the WomenRise network.',
                'complete' => $this->socialComplete,
            ],
        ];
    }

    public function getShowSeekerProfileProperty(): bool
    {
        return in_array($this->path, ['rent', 'buy'], true);
    }

    public function getShowAgentWizardProperty(): bool
    {
        return $this->path === 'agent';
    }

    public function getShowLandlordShortcutsProperty(): bool
    {
        return $this->path === 'lease';
    }

    public function getPathLabelProperty(): string
    {
        $definitions = $this->pathDefinitions();

        return $definitions[$this->path]['label'] ?? 'real estate pathway';
    }

    public function render(): \Illuminate\Contracts\View\View
    {
        return view('livewire.women-real-estate.onboarding.journey-hub', [
            'pathDefinitions' => $this->pathDefinitions(),
            'profileShortcuts' => $this->profileShortcuts(),
            'mediaShortcuts' => $this->mediaShortcuts(),
            'socialShortcuts' => $this->socialShortcuts(),
        ]);
    }

    /**
     * @return string[][]
     *
     * @psalm-return array{rent: array{label: 'Looking to Rent', chip: 'Househunter', description: 'Surface community-backed rentals, safety filters, and AI nudges built for women renting now.', cta: 'Personalise rental matches'}, lease: array{label: 'Lease a House', chip: 'Landlord / Investor', description: 'List women-first rentals, share property media, and manage inquiries with wraparound safety cues.', cta: 'Create a rental listing'}, agent: array{label: 'Registered Agent', chip: 'Verified advocate', description: 'Complete verification, publish your agent profile, and join women-led referral social loops.', cta: 'Start verification wizard'}, buy: array{label: 'Buying Cash or Mortgage', chip: 'Buyer / Investor', description: 'Capture purchase goals, compare cash vs mortgage, and sync with trusted agents.', cta: 'Plan my purchase path'}}
     */
    private function pathDefinitions(): array
    {
        return [
            'rent' => [
                'label' => 'Looking to Rent',
                'chip' => 'Househunter',
                'description' => 'Surface community-backed rentals, safety filters, and AI nudges built for women renting now.',
                'cta' => 'Personalise rental matches',
            ],
            'lease' => [
                'label' => 'Lease a House',
                'chip' => 'Landlord / Investor',
                'description' => 'List women-first rentals, share property media, and manage inquiries with wraparound safety cues.',
                'cta' => 'Create a rental listing',
            ],
            'agent' => [
                'label' => 'Registered Agent',
                'chip' => 'Verified advocate',
                'description' => 'Complete verification, publish your agent profile, and join women-led referral social loops.',
                'cta' => 'Start verification wizard',
            ],
            'buy' => [
                'label' => 'Buying Cash or Mortgage',
                'chip' => 'Buyer / Investor',
                'description' => 'Capture purchase goals, compare cash vs mortgage, and sync with trusted agents.',
                'cta' => 'Plan my purchase path',
            ],
        ];
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return list{array{label: 'Househunter Profile', description: 'Set budgets, bedrooms, suburbs, and move-in timelines to fuel AI matches.', route: string, visible: mixed}, array{label: 'Agent Verification', description: 'Submit license checks, references, and compliance docs for verified status.', route: string, visible: mixed}, array{label: 'Listing Console', description: 'Draft, price, and publish listings with AI scoring and safety prompts.', route: string, visible: mixed}}
     */
    private function profileShortcuts(): array
    {
        return [
            [
                'label' => 'Househunter Profile',
                'description' => 'Set budgets, bedrooms, suburbs, and move-in timelines to fuel AI matches.',
                'route' => route('women.real-estate.househunter-profile'),
                'visible' => $this->showSeekerProfile,
            ],
            [
                'label' => 'Agent Verification',
                'description' => 'Submit license checks, references, and compliance docs for verified status.',
                'route' => route('women.real-estate.agents.profile.edit'),
                'visible' => $this->showAgentWizard,
            ],
            [
                'label' => 'Listing Console',
                'description' => 'Draft, price, and publish listings with AI scoring and safety prompts.',
                'route' => route('women.real-estate.listings.create'),
                'visible' => $this->showLandlordShortcuts,
            ],
        ];
    }

    /**
     * @return (bool|string)[][]
     *
     * @psalm-return list{array{label: 'Upload property media', description: 'Drag in photos or clips to showcase rentals, agent reels, or buyer inspo.', route: string, visible: bool}}
     */
    private function mediaShortcuts(): array
    {
        return [
            [
                'label' => 'Upload property media',
                'description' => 'Drag in photos or clips to showcase rentals, agent reels, or buyer inspo.',
                'route' => route('women.real-estate.listings.index'),
                'visible' => $this->path !== null,
            ],
        ];
    }

    /**
     * @return (string|true)[][]
     *
     * @psalm-return list{array{label: 'Women Real Estate Network', description: 'Connect with landlords, investors, and other women navigating property decisions.', route: string, visible: true}, array{label: 'Social Feed Preview', description: 'Jump into the main WomenRise social feed with real estate tags highlighted.', route: string, visible: true}}
     */
    private function socialShortcuts(): array
    {
        return [
            [
                'label' => 'Women Real Estate Network',
                'description' => 'Connect with landlords, investors, and other women navigating property decisions.',
                'route' => route('women.real-estate.network.connections'),
                'visible' => true,
            ],
            [
                'label' => 'Social Feed Preview',
                'description' => 'Jump into the main WomenRise social feed with real estate tags highlighted.',
                'route' => route('social.feed.preview'),
                'visible' => true,
            ],
        ];
    }

    private function persistSelection(): void
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (! $user) {
            return;
        }

        $user->forceFill([
            'real_estate_entry_path' => $this->path,
            'real_estate_financing_plan' => $this->buyerPlan,
        ])->save();

        $this->completed = (bool) $user->real_estate_onboarded_at;

        $this->hydrateProgress();
    }

    public function hydrateProgress(): void
    {
        $user = Auth::user();

        if (! $user instanceof User || ! $this->path) {
            $this->profileComplete = false;
            $this->mediaComplete = false;
            $this->socialComplete = false;
            $this->personaCoachTips = [];
            $this->personaCoachFromAi = false;
            $this->personaCoachProvider = null;
            return;
        }

        $userId = $user->getKey();

        $this->profileComplete = $this->resolveProfileCompletion($userId);
        $this->mediaComplete = WomenUserMedia::where('user_id', $userId)->exists();
        $this->socialComplete = WomenSocialNetworkConnection::query()
            ->where(function ($query) use ($userId): void {
                $query->where('user_id_1', $userId)
                    ->orWhere('user_id_2', $userId);
            })
            ->whereIn('status', ['accepted', 'connected'])
            ->exists();

        $this->hydratePersonaCoach();
    }

    private function resolveProfileCompletion(int $userId): bool
    {
        return match ($this->path) {
            'agent' => WomenVerifiedAgent::where('user_id', $userId)->exists(),
            'lease' => WomenListing::where('owner_id', $userId)->exists(),
            default => WomenPropertySeeker::where('user_id', $userId)->exists(),
        };
    }

    private function profileLabel(): string
    {
        return match ($this->path) {
            'agent' => 'Agent verification',
            'lease' => 'Listing profile',
            'buy' => 'Buyer preferences',
            default => 'Househunter profile',
        };
    }

    private function profileDescription(): string
    {
        return match ($this->path) {
            'agent' => 'Complete your verification wizard so WomenRise can badge you as trusted.',
            'lease' => 'Share rental inventory details so seekers can discover your properties.',
            'buy' => 'Set purchase goals (cash or mortgage) for personalized guidance.',
            default => 'Tell us budgets, locations, and timelines so we can match you faster.',
        };
    }

    private function hydratePersonaCoach(bool $force = false): void
    {
        $persona = $this->personaForPath();

        if (! $persona) {
            $this->personaCoachTips = [];
            $this->personaCoachFromAi = false;
            $this->personaCoachProvider = null;
            return;
        }

        $this->personaCoachTips = $this->defaultPersonaCoachTips($persona);
        $this->personaCoachFromAi = false;
        $this->personaCoachProvider = null;

        if ($this->requirementsMet && ! $force) {
            return;
        }

        /** @var User|null $user */
        $user = Auth::user();

        if (! $user instanceof User) {
            return;
        }

        $profile = WomenPersonaProfile::firstOrCreate([
            'user_id' => $user->getKey(),
            'persona' => $persona,
        ]);

        try {
            $response = $this->personaCoachService()->personaCoachingTips(
                $user,
                $profile,
                $persona,
                $this->profileDraftPayload($profile),
                $this->profileSectionProgress($profile),
            );

            $tips = Arr::get($response, 'tips');

            if (is_array($tips) && $tips !== []) {
                $this->personaCoachTips = array_values($tips);
                $provider = Arr::get($response, 'provider');
                $this->personaCoachProvider = is_string($provider) ? $provider : null;
                $this->personaCoachFromAi = $this->personaCoachProvider !== null && $this->personaCoachProvider !== 'fallback';
            }
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function personaForPath(): string|null
    {
        return match ($this->path) {
            'rent' => WomenPersonaProfile::PERSONA_HOUSEHUNTER,
            'buy' => WomenPersonaProfile::PERSONA_INVESTOR,
            'agent' => WomenPersonaProfile::PERSONA_AGENT,
            'lease' => WomenPersonaProfile::PERSONA_LANDLORD,
            default => null,
        };
    }

    private function personaCoachService(): WomenPersonaAiService
    {
        return app(WomenPersonaAiService::class);
    }

    /**
     * @return array[]
     *
     * @psalm-return array{media?: array, transport?: array, work?: array, lifestyle?: array, household?: array, identity?: array}
     */
    private function profileDraftPayload(WomenPersonaProfile $profile): array
    {
        $sections = ['identity', 'household', 'lifestyle', 'work', 'transport', 'media'];
        $draft = [];

        foreach ($sections as $section) {
            $payload = (array) $profile->{$section};

            foreach ($payload as $fieldKey => $value) {
                if (is_array($value) && array_key_exists('value', $value)) {
                    $draft[$section][$fieldKey] = $value['value'];
                    continue;
                }

                $draft[$section][$fieldKey] = $value;
            }
        }

        return $draft;
    }

    /**
     * @return int[][]
     *
     * @psalm-return array{media: array{complete: int<0, max>, total: int<0, max>, percent: int}, transport: array{complete: int<0, max>, total: int<0, max>, percent: int}, work: array{complete: int<0, max>, total: int<0, max>, percent: int}, lifestyle: array{complete: int<0, max>, total: int<0, max>, percent: int}, household: array{complete: int<0, max>, total: int<0, max>, percent: int}, identity: array{complete: int<0, max>, total: int<0, max>, percent: int}}
     */
    private function profileSectionProgress(WomenPersonaProfile $profile): array
    {
        $sections = ['identity', 'household', 'lifestyle', 'work', 'transport', 'media'];
        $progress = [];

        foreach ($sections as $section) {
            $payload = (array) $profile->{$section};
            $total = count($payload);
            $complete = 0;

            foreach ($payload as $value) {
                $valueToCheck = is_array($value) && array_key_exists('value', $value)
                    ? $value['value']
                    : $value;

                if ($this->valueFilled($valueToCheck)) {
                    $complete++;
                }
            }

            $progress[$section] = [
                'complete' => $complete,
                'total' => $total,
                'percent' => $total > 0 ? (int) round(($complete / max(1, $total)) * 100) : 0,
            ];
        }

        return $progress;
    }

    private function valueFilled(mixed $value): bool
    {
        if (is_array($value)) {
            return count(array_filter($value, fn ($entry) => $entry !== null && $entry !== '')) > 0;
        }

        return ! in_array($value, [null, '', []], true);
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array<int, array{title: string, body: string, cta: mixed}>
     */
    private function defaultPersonaCoachTips(?string $persona): array
    {
        $catalog = (array) config('women_real_estate.persona_profiles.hints', []);
        $bucket = $catalog[$persona] ?? $catalog['default'] ?? [];

        return collect($bucket)
            ->map(function ($hint) {
                return [
                    'title' => (string) Arr::get($hint, 'title', 'Keep going'),
                    'body' => (string) Arr::get($hint, 'body', ''),
                    'cta' => Arr::get($hint, 'cta'),
                ];
            })
            ->filter(fn (array $hint) => $hint['body'] !== '')
            ->take(3)
            ->values()
            ->all();
    }
}
