<?php

declare(strict_types=1);

namespace App\Livewire\Business;

use App\Models\BusinessDisclaimerAcceptance;
use App\Models\User;
use App\Services\Business\FormationStudioService;
use App\Services\BusinessStructureWizardService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class BusinessFormationStudio extends LivewireComponent
{
    private const LEGAL_DISCLAIMER_COPY = 'Educational information only. Seek qualified legal/tax advice before acting.';

    public ?User $user = null;

    public ?int $userId = null;

    /** @var array<string, mixed> */
    public array $questionnaire = [];

    /** @var array<string, mixed> */
    public array $structureAdvice = [];

    /** @var array<int, array<string, mixed>> */
    public array $entityOptions = [];

    /** @var array<int, array<string, string>> */
    public array $comparisonGrid = [];

    /** @var array<int, array<string, string>> */
    public array $summaryKpis = [];

    public string $recommendedEntityKey = 'sole_trader';

    public string $defaultTimeframe = 'monthly';

    /** @var array<string, mixed> */
    public array $documentWorkspace = [];

    public int $templateCount = 0;

    public int $aiPromptCount = 0;

    public string $disclaimer = '';

    /** @var array<string, string> */
    public array $entityLabelMap = [];

    public string $aiEntryUrl = '';

    /** @var array<string, int> */
    public array $templateAvailability = [];

    /** @var array<string, mixed> */
    public array $deltaSummary = [];

    /** @var array<int, array<string, mixed>> */
    public array $structureDeck = [];

    /** @var array<int, array<string, string>> */
    public array $aiDraftPresets = [];

    public string $aiDraftEndpoint = '';

    /** @var array<string, mixed> */
    public array $aiDraftContext = [];

    public string $csrfToken = '';

    public bool $showDisclaimerBanner = true;

    public string $legalDisclaimerCopy = self::LEGAL_DISCLAIMER_COPY;

    /** @var array<string, mixed> */
    protected array $normalizedResponses = [];

    protected BusinessStructureWizardService $wizard;

    protected FormationStudioService $studio;

    public function boot(
        BusinessStructureWizardService $wizard,
        FormationStudioService $studio
    ): void {
        $this->wizard = $wizard;
        $this->studio = $studio;
    }

    public function mount(): void
    {
        $authUser = Auth::user();
        if ($authUser instanceof User) {
            $authUser->loadMissing('businessProfile');
        }

        $this->user = $authUser;
        $this->userId = $this->user?->id;
        $this->aiEntryUrl = (string) config('ai.entry_url');
        $this->aiDraftEndpoint = route('api.v1.ai.business-documents.store');
        $this->csrfToken = csrf_token() ?: Str::random(40);

        $this->questionnaire = $this->buildInitialQuestionnaire();
        $this->refreshStudioData();

        $this->showDisclaimerBanner = ! $this->hasDismissedDisclaimerBanner();
    }

    public function updatedQuestionnaire(): void
    {
        $this->refreshStudioData();
        if ($this->normalizedResponses !== []) {
            $this->persistQuestionnaire($this->normalizedResponses);
        }
    }

    public function render()
    {
        return view('livewire.business.business-formation-studio');
    }

    public function dismissDisclaimerBanner(): void
    {
        $identifier = $this->disclaimerIdentifier();

        if (! $identifier) {
            $this->showDisclaimerBanner = false;

            return;
        }

        $attributes = array_merge($identifier['match'], [
            'banner' => $this->disclaimerBannerKey(),
        ]);

        $values = [
            'session_id' => $identifier['session_id'],
            'dismissed_at' => now(),
            'metadata' => [
                'component' => static::class,
                'copy' => $this->legalDisclaimerCopy,
            ],
        ];

        BusinessDisclaimerAcceptance::updateOrCreate($attributes, $values);

        $this->showDisclaimerBanner = false;
    }

    private function refreshStudioData(): void
    {
        $entities = $this->studio->entities();
        $templates = $this->studio->templates();
        $aiPrompts = $this->studio->aiPrompts();
        $this->disclaimer = $this->studio->disclaimer();

        $responses = $this->gatherQuestionnaireResponses();
        $this->normalizedResponses = $responses;

        $this->structureAdvice = $this->wizard->analyze($responses);
        $this->structureDeck = $this->structureAdvice['structure_deck'] ?? [];

        $this->entityOptions = collect($entities)
            ->map(function (array $entity, string $key) {
                $isRecommended = str_contains($this->structureAdvice['recommended_structure'], $entity['label']);

                return [
                    'key' => $key,
                    'label' => $entity['label'],
                    'summary' => $entity['summary'],
                    'tax_rate' => $entity['tax_rate'],
                    'setup_cost' => $entity['setup_cost'],
                    'liability' => $entity['liability'],
                    'compliance' => $entity['compliance'],
                    'gst' => data_get($entity, 'gst.treatment'),
                    'is_recommended' => $isRecommended,
                    'fit_score' => $isRecommended
                        ? $this->structureAdvice['confidence_score']
                        : max(55, $this->structureAdvice['confidence_score'] - 18),
                ];
            })
            ->values()
            ->all();

        $this->recommendedEntityKey = collect($this->entityOptions)
            ->firstWhere('is_recommended', true)['key']
            ?? ($this->entityOptions[0]['key'] ?? 'sole_trader');

        $this->comparisonGrid = collect($entities)
            ->map(function (array $entity, string $key) {
                return [
                    'key' => $key,
                    'label' => $entity['label'],
                    'liability' => $entity['liability'],
                    'liability_risk' => $entity['liability_risk'] ?? '',
                    'compliance' => $entity['compliance'],
                    'compliance_level' => $entity['compliance_level'] ?? $entity['compliance'],
                    'tax_rate' => $entity['tax_rate'],
                    'setup_cost' => $entity['setup_cost'],
                    'setup_cost_value' => (float) ($entity['setup_cost_value'] ?? 0),
                    'funding' => $entity['funding_friendliness'] ?? '—',
                    'gst' => data_get($entity, 'gst.reporting'),
                    'is_recommended' => $key === $this->recommendedEntityKey,
                ];
            })
            ->values()
            ->all();

        $this->summaryKpis = [
            ['label' => 'Recommended', 'value' => $this->structureAdvice['recommended_structure'] ?? ''],
            ['label' => 'Confidence', 'value' => ($this->structureAdvice['confidence_score'] ?? 0).'%'],
            ['label' => 'Setup cost', 'value' => $this->structureAdvice['setup_cost'] ?? ''],
            ['label' => 'Tax treatment', 'value' => $this->structureAdvice['tax_implications'] ?? ''],
        ];

        $this->deltaSummary = $this->buildDeltaSummary($entities, $this->recommendedEntityKey);

        $this->documentWorkspace = [
            'templates' => collect($templates)
                ->map(fn (array $template) => array_merge($template, [
                    'timeframes' => $template['timeframes'] ?? ['weekly', 'monthly', 'quarterly', 'yearly'],
                    'updated_label' => Carbon::parse($template['updated_at'])->format('M d, Y'),
                    'download_url' => route('business.templates.download', $template['slug']),
                    'prerequisites' => $template['prerequisites'] ?? [],
                ]))
                ->values()
                ->all(),
            'ai_prompts' => $aiPrompts,
            'disclaimer' => $this->disclaimer,
        ];

        $this->aiDraftPresets = collect($aiPrompts)
            ->map(fn (array $prompt, string $key) => [
                'key' => $key,
                'label' => $prompt['label'],
                'template' => $key,
                'prompt' => $this->formatAiDraftPrompt($key, $prompt['prompt'], $responses),
            ])
            ->values()
            ->all();

        $this->templateCount = count($templates);
        $this->aiPromptCount = count($aiPrompts);
        $this->entityLabelMap = collect($this->entityOptions)
            ->mapWithKeys(fn ($entity) => [$entity['key'] => $entity['label']])
            ->all();
        $this->templateAvailability = $this->studio->templateAvailability($this->recommendedEntityKey);
        $this->aiDraftContext = [
            'questionnaire' => $responses,
            'recommended_structure' => $this->structureAdvice['recommended_structure'] ?? null,
            'confidence' => $this->structureAdvice['confidence_score'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildInitialQuestionnaire(): array
    {
        $stored = (array) data_get($this->user, 'businessProfile.formation_questionnaire', []);
        $desiredPortals = collect(data_get($this->user, 'user_intentions.desired_portals', []))
            ->pluck('value')
            ->all();

        return [
            'annual_revenue' => (int) ($stored['annual_revenue']
                ?? data_get($this->user, 'businessProfile.metrics.annual_revenue', 120000)),
            'hiring' => (bool) ($stored['hiring']
                ?? in_array('team', (array) data_get($this->user, 'secondary_roles', []), true)),
            'external_investment' => (bool) ($stored['external_investment']
                ?? in_array('investors', $desiredPortals, true)),
            'complexity' => $stored['complexity'] ?? 'medium',
            'gst_registered' => (bool) ($stored['gst_registered']
                ?? data_get($this->user, 'businessProfile.metrics.gst_registered', false)),
            'team_size' => max(0, (int) ($stored['team_size']
                ?? data_get($this->user, 'businessProfile.team_size', 1))),
            'partner_count' => max(1, (int) ($stored['partner_count']
                ?? data_get($this->user, 'businessProfile.metrics.partner_count', 1))),
            'asset_protection' => $stored['asset_protection']
                ?? data_get($this->user, 'businessProfile.metrics.asset_protection', 'medium'),
            'family_owned' => (bool) ($stored['family_owned']
                ?? data_get($this->user, 'businessProfile.metrics.family_owned', false)),
            'international_trade' => (bool) ($stored['international_trade']
                ?? data_get($this->user, 'businessProfile.metrics.international_trade', false)),
            'ip_strategy' => (bool) ($stored['ip_strategy']
                ?? data_get($this->user, 'businessProfile.metrics.ip_strategy', false)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function gatherQuestionnaireResponses(): array
    {
        return [
            'annual_revenue' => max(0, (int) ($this->questionnaire['annual_revenue'] ?? 0)),
            'hiring' => (bool) ($this->questionnaire['hiring'] ?? false),
            'external_investment' => (bool) ($this->questionnaire['external_investment'] ?? false),
            'complexity' => $this->questionnaire['complexity'] ?? 'medium',
            'gst_registered' => (bool) ($this->questionnaire['gst_registered'] ?? false),
            'team_size' => max(0, (int) ($this->questionnaire['team_size'] ?? 0)),
            'partner_count' => max(1, (int) ($this->questionnaire['partner_count'] ?? 1)),
            'asset_protection' => $this->questionnaire['asset_protection'] ?? 'medium',
            'family_owned' => (bool) ($this->questionnaire['family_owned'] ?? false),
            'international_trade' => (bool) ($this->questionnaire['international_trade'] ?? false),
            'ip_strategy' => (bool) ($this->questionnaire['ip_strategy'] ?? false),
        ];
    }

    /**
     * @param  array<string, mixed>  $responses
     */
    private function persistQuestionnaire(array $responses): void
    {
        if (! $this->user) {
            return;
        }

        $profile = $this->user->businessProfile;

        if (! $profile) {
            $profile = $this->user->businessProfile()->create();
            $this->user->setRelation('businessProfile', $profile);
        }

        if (! $profile) {
            return;
        }

        $profile->forceFill([
            'formation_questionnaire' => $responses,
        ])->save();
    }

    /**
     * @param  array<string, array<string, mixed>>  $entities
     * @return array<string, mixed>
     */
    private function buildDeltaSummary(array $entities, string $recommendedKey): array
    {
        $baseline = $entities['sole_trader'] ?? reset($entities);
        $target = $entities[$recommendedKey] ?? $baseline;

        if (! $baseline || ! $target || $recommendedKey === 'sole_trader') {
            return [];
        }

        $items = array_filter([
            $this->formatCostDelta(
                (float) ($target['setup_cost_value'] ?? 0),
                (float) ($baseline['setup_cost_value'] ?? 0)
            ),
            $this->describeLiabilityDelta(
                $target['liability_risk'] ?? null,
                $baseline['liability_risk'] ?? null
            ),
            $this->describeComplianceDelta(
                $target['compliance_level'] ?? null,
                $baseline['compliance_level'] ?? null
            ),
        ]);

        return [
            'headline' => sprintf('%s vs %s', $target['label'], $baseline['label']),
            'items' => array_values($items),
        ];
    }

    private function formatCostDelta(float $target, float $baseline): ?array
    {
        $delta = $target - $baseline;

        if (abs($delta) < 1) {
            return null;
        }

        $sign = $delta > 0 ? '+' : '–';
        $formatted = $this->humanCurrency(abs($delta));

        return ['label' => 'Setup cost', 'value' => sprintf('%s%s setup', $sign, $formatted)];
    }

    private function describeLiabilityDelta(?string $target, ?string $baseline): ?array
    {
        if (! $target || ! $baseline) {
            return null;
        }

        $targetLower = strtolower($target);
        $baselineLower = strtolower($baseline);

        if ($targetLower === $baselineLower) {
            return null;
        }

        if (str_contains($targetLower, 'limited') && ! str_contains($baselineLower, 'limited')) {
            return ['label' => 'Liability', 'value' => '– personal liability'];
        }

        if (! str_contains($targetLower, 'limited') && str_contains($baselineLower, 'limited')) {
            return ['label' => 'Liability', 'value' => '+ personal guarantees'];
        }

        if (str_contains($targetLower, 'trustee')) {
            return ['label' => 'Liability', 'value' => 'Trustee-managed risk'];
        }

        if (str_contains($targetLower, 'shared')) {
            return ['label' => 'Liability', 'value' => '+ shared liability'];
        }

        return ['label' => 'Liability', 'value' => $target];
    }

    private function describeComplianceDelta(?string $target, ?string $baseline): ?array
    {
        if (! $target || ! $baseline) {
            return null;
        }

        $targetScore = $this->complianceScore($target);
        $baselineScore = $this->complianceScore($baseline);
        $delta = $targetScore - $baselineScore;

        if ($delta === 0) {
            return null;
        }

        return [
            'label' => 'Compliance',
            'value' => $delta > 0 ? '+ more admin lift' : '– admin lift',
        ];
    }

    private function complianceScore(string $label): int
    {
        $normalized = strtolower($label);

        if (str_contains($normalized, 'high')) {
            return 3;
        }

        if (str_contains($normalized, 'moderate')) {
            return 2;
        }

        return 1;
    }

    private function humanCurrency(float $amount): string
    {
        if ($amount >= 1000) {
            $value = round($amount / 1000, 1);
            $formatted = rtrim(rtrim((string) $value, '0'), '.');

            return '$'.$formatted.'k';
        }

        return '$'.number_format((int) round($amount));
    }

    private function formatAiDraftPrompt(string $key, string $template, array $responses): string
    {
        $entityLabel = $this->entityLabelMap[$this->recommendedEntityKey] ?? ($this->structureAdvice['recommended_structure'] ?? 'Structure');
        $coFounders = max(1, (int) ($responses['partner_count'] ?? 1));
        $equity = $coFounders > 0 ? number_format(100 / $coFounders, 2).'%' : 'N/A';
        $riskNote = $this->structureAdvice['cons'][0] ?? 'Highlight compliance obligations and funding expectations.';

        return match ($key) {
            'founders_agreement' => sprintf(
                $template,
                $entityLabel,
                $coFounders,
                $equity,
                $riskNote
            ),
            'bas_summary' => sprintf(
                $template,
                $this->formatCurrency($responses['annual_revenue'] ?? 0, 0.1),
                $this->formatCurrency($responses['annual_revenue'] ?? 0, 0.035),
                $this->formatCurrency($responses['annual_revenue'] ?? 0, 0.015),
                $this->formatCurrency($responses['annual_revenue'] ?? 0, 0.005)
            ),
            default => $template,
        };
    }

    private function formatCurrency(int $revenue, float $ratio): string
    {
        $amount = $revenue * $ratio;

        return '$'.number_format(max(0, (int) round($amount)));
    }

    private function hasDismissedDisclaimerBanner(): bool
    {
        $identifier = $this->disclaimerIdentifier();

        if (! $identifier) {
            return false;
        }

        return BusinessDisclaimerAcceptance::query()
            ->where('banner', $this->disclaimerBannerKey())
            ->where($identifier['field'], $identifier['value'])
            ->exists();
    }

    /**
     * @return array{
     *     field: string,
     *     value: int|string,
     *     match: array<string, int|string>,
     *     session_id: string|null,
     * }|null
     */
    private function disclaimerIdentifier(): ?array
    {
        if ($this->userId) {
            return [
                'field' => 'user_id',
                'value' => $this->userId,
                'match' => ['user_id' => $this->userId],
                'session_id' => $this->currentSessionId(),
            ];
        }

        $sessionId = $this->currentSessionId();

        if (! $sessionId) {
            return null;
        }

        return [
            'field' => 'session_id',
            'value' => $sessionId,
            'match' => ['session_id' => $sessionId],
            'session_id' => $sessionId,
        ];
    }

    private function currentSessionId(): ?string
    {
        if (! Session::isStarted()) {
            Session::start();
        }

        return Session::getId();
    }

    private function disclaimerBannerKey(): string
    {
        return 'formation_studio_top_banner_v1';
    }
}

