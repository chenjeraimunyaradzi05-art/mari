<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Personas;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use App\Models\WomenRealEstate\WomenUserMedia;
use App\Services\WomenRealEstate\Ai\WomenPersonaAiService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Livewire\Component;
use Throwable;

final class Wizard extends Component
{
    public string $persona = WomenPersonaProfile::PERSONA_HOUSEHUNTER;

    public array $form = [];

    public array $schema = [];

    public array $mediaOptions = [];

    public ?int $featuredMediaId = null;

    public bool $highlightInFeed = false;

    public bool $autoShareOptIn = false;

    public int $completionScore = 0;

    public string $status = 'idle';

    public ?string $message = null;

    public array $sectionProgress = [];

    public bool $mediaDrawerVisible = false;

    public bool $showStoryBuilder = false;

    public bool $showTrustCoach = false;

    public string $storyBuilderPrompt = '';

    public ?string $storyBuilderSuggestion = null;

    public string $trustCoachFocus = '';

    public array $trustCoachChecklist = [];

    public bool $trustCoachFromAi = false;

    public array $personaCoachTips = [];

    public bool $personaCoachFromAi = false;

    public ?string $personaCoachProvider = null;

    public array $readinessSignals = [];

    public int $premiumThreshold = 80;

    protected ?WomenPersonaProfile $cachedProfile = null;

    protected bool $personaCoachInitialized = false;

    protected $listeners = ['refreshPersonaWizard' => 'hydrateProfile'];

    public function mount(?string $persona = null): void
    {
        $this->premiumThreshold = (int) config('women_real_estate.persona_profiles.premium_threshold', 80);

        if ($persona) {
            $this->persona = $persona;
        }

        $this->schema = $this->buildSchema();
        $this->form = $this->emptyForm();

        $this->hydrateProfile();
        $this->loadMediaOptions();
        $this->updateProgress();

        if (! $this->personaCoachInitialized) {
            $this->refreshPersonaCoachTips();
        }
    }

    public function updated($name, $value): void
    {
        if (Str::startsWith((string) $name, 'form.')) {
            $this->updateProgress();
            return;
        }

        if (in_array($name, ['highlightInFeed', 'autoShareOptIn', 'featuredMediaId'], true)) {
            $this->updateReadinessSignals();
        }
    }

    public function updatedPersona(): void
    {
        $this->form = $this->emptyForm();
        $this->hydrateProfile();
        $this->trustCoachFromAi = false;
        $this->trustCoachChecklist = $this->buildDefaultTrustCoachChecklist($this->trustCoachFocus);

        if (! $this->personaCoachInitialized) {
            $this->refreshPersonaCoachTips();
        }
    }

    public function saveSection(?string $sectionKey = null): void
    {
        $this->status = 'saving';
        $this->message = null;

        try {
            $user = $this->resolveUser();

            if (! $user) {
                $this->status = 'error';
                $this->message = 'You must be signed in.';
                return;
            }

            $payload = $this->buildPayload($sectionKey);

            $profile = WomenPersonaProfile::updateOrCreate(
                ['user_id' => $user->id, 'persona' => $this->persona],
                Arr::except($payload, ['persona'])
            );

            $profile->refreshCompletionScore();
            $profile->save();
            $profile->markUpdated();

            $this->completionScore = $profile->completion_score ?? 0;
            $this->status = 'success';
            $this->message = 'Persona profile saved';

            $this->dispatch('realEstateProfileProgress', [
                'complete' => $this->completionScore >= 80,
                'signals' => (int) round($this->completionScore / 10),
            ]);

            $this->updateProgress();
            $this->refreshPersonaCoachTips();
        } catch (Throwable $exception) {
            report($exception);
            $this->status = 'error';
            $this->message = 'Unable to save persona profile.';
        }
    }

    public function hydrateProfile(): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            return;
        }

        $profile = $this->personaProfile($user);

        $this->completionScore = $profile->completion_score ?? 0;
        $this->featuredMediaId = $profile->featured_media_id;
        $this->highlightInFeed = (bool) $profile->highlight_in_feed;
        $this->autoShareOptIn = (bool) $profile->auto_share_opt_in;

        foreach ($this->schema as $section => $config) {
            $stored = $profile->{$section} ?? [];

            foreach ($config['fields'] as $fieldKey => $fieldConfig) {
                $defaultVisibility = $fieldConfig['default_visibility'] ?? 'network';
                $value = data_get($stored, "{$fieldKey}.value", data_get($stored, $fieldKey));
                $visibility = data_get($stored, "{$fieldKey}.visibility", $defaultVisibility);

                    if (($fieldConfig['type'] ?? null) === 'multiselect' && is_string($value)) {
                        $value = array_values(array_filter(array_map('trim', explode(',', $value))));
                    }

                $this->form[$section][$fieldKey] = [
                    'value' => $value,
                    'visibility' => $visibility,
                ];
            }
        }

        $this->updateProgress();
        $this->refreshPersonaCoachTips();
    }

    public function loadMediaOptions(): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            $this->mediaOptions = [];
            return;
        }

        $this->mediaOptions = WomenUserMedia::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(40)
            ->get(['id', 'caption', 'media_type'])
            ->toArray();
    }

    public function render(): \Illuminate\Contracts\View\View
    {
        return view('livewire.women-real-estate.personas.wizard', [
            'schema' => $this->schema,
            'personaOptions' => WomenPersonaProfile::personaOptions(),
        ]);
    }

    /**
     * @return (array|bool|int|null|string)[]
     *
     * @psalm-return array{persona: string, visibility_preferences: array, featured_media_id: int|null, highlight_in_feed: bool, auto_share_opt_in: bool,...}
     */
    private function buildPayload(?string $sectionKey = null): array
    {
        $sections = $sectionKey ? [$sectionKey] : array_keys($this->schema);
        $data = [];

        foreach ($sections as $section) {
            $data[$section] = Arr::map($this->form[$section] ?? [], fn ($field) => [
                    'value' => $field['value'] ?? null,
                'visibility' => $field['visibility'] ?? 'network',
            ]);
        }

        return array_merge($data, [
            'persona' => $this->persona,
            'visibility_preferences' => $this->visibilityMap(),
            'featured_media_id' => $this->featuredMediaId,
            'highlight_in_feed' => $this->highlightInFeed,
            'auto_share_opt_in' => $this->autoShareOptIn,
        ]);
    }

    /**
     * @return (array|mixed|null|string)[][][]
     *
     * @psalm-return array<array<array{value: array<never, never>|null, visibility: 'network'|mixed}>>
     */
    private function emptyForm(): array
    {
        $form = [];

        foreach ($this->buildSchema() as $section => $config) {
            foreach ($config['fields'] as $key => $field) {
                $form[$section][$key] = [
                    'value' => $field['type'] === 'multiselect' ? [] : null,
                    'visibility' => $field['default_visibility'] ?? 'network',
                ];
            }
        }

        return $form;
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array<string, 'network'|mixed>
     */
    private function visibilityMap(): array
    {
        $map = [];

        foreach ($this->form as $section => $fields) {
            foreach ($fields ?? [] as $field => $payload) {
                $map["{$section}.{$field}"] = $payload['visibility'] ?? 'network';
            }
        }

        return $map;
    }

    public function toggleMediaDrawer(): void
    {
        $this->mediaDrawerVisible = ! $this->mediaDrawerVisible;
    }

    public function openStoryBuilder(): void
    {
        $this->storyBuilderSuggestion = null;
        $this->showStoryBuilder = true;
        $this->storyBuilderPrompt = $this->storyBuilderPrompt !== ''
            ? $this->storyBuilderPrompt
            : (string) data_get($this->form, 'identity.lived_experiences.value', '');
    }

    public function closeStoryBuilder(): void
    {
        $this->showStoryBuilder = false;
        $this->storyBuilderSuggestion = null;
    }

    public function generateStoryBuilderSuggestion(): void
    {
        $prompt = trim($this->storyBuilderPrompt);

        if ($prompt === '') {
            $this->storyBuilderSuggestion = null;
            return;
        }

        $user = $this->resolveUser();

        if (! $user) {
            $this->storyBuilderSuggestion = $this->fallbackStoryBuilderText($prompt);
            return;
        }

        try {
            $profile = $this->personaProfile($user);
            $summary = $this->personaAi()->buildStorySummary($user, $profile, $prompt, [
                'persona' => $this->persona,
                'form' => $this->form,
                'section_progress' => $this->sectionProgress,
            ]);

            $this->storyBuilderSuggestion = $summary;
        } catch (Throwable $exception) {
            report($exception);
            $this->storyBuilderSuggestion = $this->fallbackStoryBuilderText($prompt);
        }
    }

    public function applyStoryBuilderSuggestion(): void
    {
        if (! $this->storyBuilderSuggestion) {
            return;
        }

        $this->form['identity']['lived_experiences']['value'] = $this->storyBuilderSuggestion;
        $this->updateProgress();
        $this->closeStoryBuilder();
    }

    public function openTrustCoach(): void
    {
        $this->showTrustCoach = true;
        $this->generateTrustCoachChecklist();
    }

    public function closeTrustCoach(): void
    {
        $this->showTrustCoach = false;
    }

    public function generateTrustCoachChecklist(): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            $this->trustCoachFromAi = false;
            $this->trustCoachChecklist = $this->buildDefaultTrustCoachChecklist($this->trustCoachFocus);
            return;
        }

        try {
            $profile = $this->personaProfile($user);
            $tips = $this->personaAi()->trustCoachChecklist(
                $user,
                $profile,
                $this->sectionProgress,
                $this->trustCoachFocus !== '' ? $this->trustCoachFocus : null,
                4,
            );

            $this->trustCoachChecklist = $tips;
            $this->trustCoachFromAi = true;
        } catch (Throwable $exception) {
            report($exception);
            $this->trustCoachFromAi = false;
            $this->trustCoachChecklist = $this->buildDefaultTrustCoachChecklist($this->trustCoachFocus);
        }
    }

    public function refreshPersonaCoachTips(): void
    {
        $fallbackTips = $this->defaultPersonaCoachTips($this->persona);

        $this->personaCoachInitialized = true;
        $this->personaCoachTips = $fallbackTips;
        $this->personaCoachFromAi = false;
        $this->personaCoachProvider = null;

        $user = $this->resolveUser();

        if (! $user) {
            return;
        }

        try {
            $profile = $this->personaProfile($user);
            $response = $this->personaAi()->personaCoachingTips(
                $user,
                $profile,
                $this->persona,
                $this->formDraftPayload(),
                $this->sectionProgress,
            );

            $tips = Arr::get($response, 'tips', $fallbackTips);

            if (! is_array($tips) || $tips === []) {
                $tips = $fallbackTips;
            }

            $this->personaCoachTips = array_values($tips);
            $provider = Arr::get($response, 'provider');
            $this->personaCoachProvider = is_string($provider) ? $provider : null;
            $this->personaCoachFromAi = $this->personaCoachProvider !== null && $this->personaCoachProvider !== 'fallback';
        } catch (Throwable $exception) {
            report($exception);
            $this->personaCoachTips = $fallbackTips;
            $this->personaCoachFromAi = false;
            $this->personaCoachProvider = null;
        }
    }

    public function toggleChecklistItem(int $index): void
    {
        if (! isset($this->trustCoachChecklist[$index])) {
            return;
        }

        $current = $this->trustCoachChecklist[$index]['status'] ?? 'todo';
        $this->trustCoachChecklist[$index]['status'] = $current === 'done' ? 'todo' : 'done';
    }

    private function updateProgress(): void
    {
        $this->sectionProgress = $this->calculateSectionProgress();

        if ($this->trustCoachFromAi) {
            $this->trustCoachChecklist = collect($this->trustCoachChecklist)
                ->map(function ($tip) {
                    $section = $tip['section'] ?? null;

                    if ($section && isset($this->sectionProgress[$section])) {
                        $percent = $this->sectionProgress[$section]['percent'] ?? 0;
                        $tip['percent'] = $percent;
                        $tip['status'] = $percent >= 80 ? 'done' : ($tip['status'] ?? 'todo');
                    }

                    return $tip;
                })
                ->values()
                ->all();

            $this->updateReadinessSignals();

            return;
        }

        $this->trustCoachChecklist = $this->buildDefaultTrustCoachChecklist($this->trustCoachFocus);
        $this->updateReadinessSignals();
    }

    /**
     * @return int[][]
     *
     * @psalm-return array<array{complete: int<0, max>, total: int<0, max>, percent: int}>
     */
    private function calculateSectionProgress(): array
    {
        $progress = [];

        foreach ($this->schema as $section => $config) {
            $fields = $config['fields'] ?? [];
            $total = count($fields);
            $complete = 0;

            foreach ($fields as $fieldKey => $fieldConfig) {
                $value = $this->form[$section][$fieldKey]['value'] ?? null;

                if ($this->fieldHasValue($fieldConfig['type'] ?? 'text', $value)) {
                    $complete++;
                }
            }

            $percent = $total > 0 ? (int) round(($complete / $total) * 100) : 0;

            $progress[$section] = [
                'complete' => $complete,
                'total' => $total,
                'percent' => $percent,
            ];
        }

        return $progress;
    }

    private function fieldHasValue(string $type, mixed $value): bool
    {
        if ($type === 'multiselect') {
            return is_array($value) && count(array_filter($value)) > 0;
        }

        return ! in_array($value, [null, '', []], true);
    }

    /**
     * @return (int|string)[][]
     *
     * @psalm-return array<int, array{section: string, label: string, status: 'done'|'todo', percent: int<0, 100>}>
     */
    private function buildDefaultTrustCoachChecklist(?string $focus = null): array
    {
        $collection = collect($this->sectionProgress)
            ->map(fn ($meta, $section) => [
                'section' => (string) $section,
                'percent' => (int) ($meta['percent'] ?? 0),
            ])
            ->sortBy('percent');

        if ($focus) {
            $collection->prepend([
                'section' => Str::slug($focus, '_'),
                'percent' => 0,
            ]);
        }

        return $collection
            ->take(3)
            ->map(function ($meta) {
                $section = (string) ($meta['section'] ?? 'identity');
                $label = Str::headline(str_replace('_', ' ', $section));
                $percent = max(0, min(100, (int) ($meta['percent'] ?? 0)));

                return [
                    'section' => $section,
                    'label' => "Share more about {$label}",
                    'status' => $percent >= 80 ? 'done' : 'todo',
                    'percent' => $percent,
                ];
            })
            ->values()
            ->all();
    }

    private function updateReadinessSignals(): void
    {
        $identityPercent = (int) Arr::get($this->sectionProgress, 'identity.percent', 0);
        $mediaPercent = (int) Arr::get($this->sectionProgress, 'media.percent', 0);

        if ($this->featuredMediaId) {
            $mediaPercent = max($mediaPercent, 85);
        }

        $trustPercent = (int) round((
            ($this->highlightInFeed ? 1 : 0) +
            ($this->autoShareOptIn ? 1 : 0) +
            ($this->featuredMediaId ? 1 : 0)
        ) / 3 * 100);

        $premiumPercent = max($this->completionScore, $this->draftCompletionScore());

        $this->readinessSignals = [
            'story' => [
                'label' => 'Story clarity',
                'description' => $identityPercent >= 70
                    ? 'Identity reads warm enough for spotlight cards.'
                    : 'Add lived experiences or cultural roots for a richer intro.',
                'status' => $identityPercent >= 70 ? 'ready' : 'incomplete',
                'percent' => $identityPercent,
            ],
            'media' => [
                'label' => 'Media & hero card',
                'description' => $mediaPercent >= 70
                    ? 'Featured asset and hero copy can headline your card.'
                    : 'Pick a featured asset and fill hero copy inside Media.',
                'status' => $mediaPercent >= 70 ? 'ready' : 'incomplete',
                'percent' => $mediaPercent,
            ],
            'trust' => [
                'label' => 'Trust & sharing',
                'description' => $trustPercent >= 70
                    ? 'Discovery feed can highlight you with sharing toggled on.'
                    : 'Toggle feed highlight + auto-share once you are comfortable.',
                'status' => $trustPercent >= 70 ? 'ready' : 'incomplete',
                'percent' => $trustPercent,
            ],
            'premium' => [
                'label' => 'Premium unlock',
                'description' => $premiumPercent >= $this->premiumThreshold
                    ? 'Unlocks premium badges and JourneyHub shortcuts.'
                    : "Reach {$this->premiumThreshold}% to unlock premium feed boosts.",
                'status' => $premiumPercent >= $this->premiumThreshold ? 'ready' : 'incomplete',
                'percent' => $premiumPercent,
            ],
        ];
    }

    private function draftCompletionScore(): int
    {
        $filled = 0;
        $total = 0;

        foreach ($this->sectionProgress as $meta) {
            $filled += (int) ($meta['complete'] ?? 0);
            $total += (int) ($meta['total'] ?? 0);
        }

        if ($total === 0) {
            return 0;
        }

        return (int) round(($filled / $total) * 100);
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

    private function fallbackStoryBuilderText(string $prompt): string
    {
        return (string) Str::of($prompt)
            ->replaceMatches('/\s+/', ' ')
            ->squish()
            ->limit(220, '…');
    }

    /**
     * @return (mixed|null)[][]
     *
     * @psalm-return array<array<mixed|null>>
     */
    private function formDraftPayload(): array
    {
        $draft = [];

        foreach ($this->form as $section => $fields) {
            foreach (($fields ?? []) as $fieldKey => $meta) {
                $draft[$section][$fieldKey] = $meta['value'] ?? null;
            }
        }

        return $draft;
    }

    private function personaProfile(User $user): WomenPersonaProfile
    {
        if ($this->cachedProfile instanceof WomenPersonaProfile
            && $this->cachedProfile->user_id === $user->id
            && $this->cachedProfile->persona === $this->persona) {
            return $this->cachedProfile;
        }

        return $this->cachedProfile = WomenPersonaProfile::firstOrCreate(
            ['user_id' => $user->id, 'persona' => $this->persona],
            []
        );
    }

    private function personaAi(): WomenPersonaAiService
    {
        return app(WomenPersonaAiService::class);
    }

    /**
     * @return ((string|string[])[][]|string)[][]
     *
     * @psalm-return array{identity: array{label: 'Identity & Story', fields: array{pronouns: array{type: 'select', options: list{'she/her', 'she/they', 'they/them', 'prefer_not_to_say'}}, cultural_roots: array{type: 'text', placeholder: 'Describe heritage or community roots'}, languages: array{type: 'text', placeholder: 'English, Hindi, Mandarin'}, lived_experiences: array{type: 'textarea', placeholder: 'Share what shaped your housing journey'}}}, household: array{label: 'Household Snapshot', fields: array{household_type: array{type: 'select', options: list{'single', 'single_with_dependents', 'couple', 'multi_generational', 'prefer_not_to_say'}}, dependents: array{type: 'number', placeholder: '0'}, support_animals: array{type: 'select', options: list{'none', 'service_animal', 'therapy_pet', 'prefer_not_to_say'}}}}, lifestyle: array{label: 'Lifestyle & Safety', fields: array{community_focus: array{type: 'multiselect', options: list{'women_in_stem', 'parents', 'creatives', 'students', 'caregivers'}}, safety_needs: array{type: 'textarea', placeholder: 'Share any safety or accessibility needs'}, wellbeing_practices: array{type: 'textarea', placeholder: 'Yoga, cycling, nature walks...'}}}, work: array{label: 'Work & Ambitions', fields: array{industry: array{type: 'text', placeholder: 'Tech, healthcare, education...'}, employment_status: array{type: 'select', options: list{'full_time', 'part_time', 'founder', 'career_break', 'prefer_not_to_say'}}, income_stability: array{type: 'select', options: list{'steady', 'variable', 'building', 'prefer_not_to_say'}}, wealth_goals: array{type: 'textarea', placeholder: 'Pay down debt, invest in first home...'}}}, transport: array{label: 'Transport & Mobility', fields: array{primary_mode: array{type: 'select', options: list{'public_transit', 'walk', 'rideshare', 'drive', 'bike'}}, commute_time: array{type: 'text', placeholder: 'e.g. 30 min peak'}, mobility_supports: array{type: 'textarea', placeholder: 'Lift access, nearby parking, etc.'}}}, media: array{label: 'Media & Storytelling', fields: array{hero_tagline: array{type: 'text', placeholder: 'One line that captures you'}, intro_video_url: array{type: 'text', placeholder: 'Link to hosted clip or reel'}, share_preferences: array{type: 'select', options: list{'private', 'network', 'public'}, default_visibility: 'network'}}}}
     */
    private function buildSchema(): array
    {
        return [
            'identity' => [
                'label' => 'Identity & Story',
                'fields' => [
                    'pronouns' => [
                        'type' => 'select',
                        'options' => ['she/her', 'she/they', 'they/them', 'prefer_not_to_say'],
                    ],
                    'cultural_roots' => [
                        'type' => 'text',
                        'placeholder' => 'Describe heritage or community roots',
                    ],
                    'languages' => [
                        'type' => 'text',
                        'placeholder' => 'English, Hindi, Mandarin',
                    ],
                    'lived_experiences' => [
                        'type' => 'textarea',
                        'placeholder' => 'Share what shaped your housing journey',
                    ],
                ],
            ],
            'household' => [
                'label' => 'Household Snapshot',
                'fields' => [
                    'household_type' => [
                        'type' => 'select',
                        'options' => ['single', 'single_with_dependents', 'couple', 'multi_generational', 'prefer_not_to_say'],
                    ],
                    'dependents' => [
                        'type' => 'number',
                        'placeholder' => '0',
                    ],
                    'support_animals' => [
                        'type' => 'select',
                        'options' => ['none', 'service_animal', 'therapy_pet', 'prefer_not_to_say'],
                    ],
                ],
            ],
            'lifestyle' => [
                'label' => 'Lifestyle & Safety',
                'fields' => [
                    'community_focus' => [
                        'type' => 'multiselect',
                        'options' => ['women_in_stem', 'parents', 'creatives', 'students', 'caregivers'],
                    ],
                    'safety_needs' => [
                        'type' => 'textarea',
                        'placeholder' => 'Share any safety or accessibility needs',
                    ],
                    'wellbeing_practices' => [
                        'type' => 'textarea',
                        'placeholder' => 'Yoga, cycling, nature walks...',
                    ],
                ],
            ],
            'work' => [
                'label' => 'Work & Ambitions',
                'fields' => [
                    'industry' => [
                        'type' => 'text',
                        'placeholder' => 'Tech, healthcare, education...',
                    ],
                    'employment_status' => [
                        'type' => 'select',
                        'options' => ['full_time', 'part_time', 'founder', 'career_break', 'prefer_not_to_say'],
                    ],
                    'income_stability' => [
                        'type' => 'select',
                        'options' => ['steady', 'variable', 'building', 'prefer_not_to_say'],
                    ],
                    'wealth_goals' => [
                        'type' => 'textarea',
                        'placeholder' => 'Pay down debt, invest in first home...',
                    ],
                ],
            ],
            'transport' => [
                'label' => 'Transport & Mobility',
                'fields' => [
                    'primary_mode' => [
                        'type' => 'select',
                        'options' => ['public_transit', 'walk', 'rideshare', 'drive', 'bike'],
                    ],
                    'commute_time' => [
                        'type' => 'text',
                        'placeholder' => 'e.g. 30 min peak',
                    ],
                    'mobility_supports' => [
                        'type' => 'textarea',
                        'placeholder' => 'Lift access, nearby parking, etc.',
                    ],
                ],
            ],
            'media' => [
                'label' => 'Media & Storytelling',
                'fields' => [
                    'hero_tagline' => [
                        'type' => 'text',
                        'placeholder' => 'One line that captures you',
                    ],
                    'intro_video_url' => [
                        'type' => 'text',
                        'placeholder' => 'Link to hosted clip or reel',
                    ],
                    'share_preferences' => [
                        'type' => 'select',
                        'options' => ['private', 'network', 'public'],
                        'default_visibility' => 'network',
                    ],
                ],
            ],
        ];
    }

    private function resolveUser(): ?User
    {
        $user = Auth::user();

        return $user instanceof User ? $user : null;
    }
}

