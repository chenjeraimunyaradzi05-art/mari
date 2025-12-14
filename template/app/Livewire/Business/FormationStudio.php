<?php

declare(strict_types=1);

namespace App\Livewire\Business;

use App\Models\User;
use App\Services\Business\BusinessFinancialTrackerService;
use App\Services\Business\FormationStudioService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class FormationStudio extends LivewireComponent
{
    public int $userId;

    /** @var array<int, string> */
    protected $listeners = [
        'formation-summary:set-entity' => 'handleSummaryEntitySelection',
        'formation-summary:set-timeframe' => 'handleSummaryTimeframeSelection',
    ];

    /** @var array<string, array<string, mixed>> */
    public array $entities = [];

    public string $selectedEntity = 'sole_trader';

    /** @var array<string, mixed> */
    public array $questionnaire = [
        'annual_revenue' => 60000,
        'hiring' => false,
        'external_investment' => false,
        'gst_registered' => false,
        'accounting_method' => 'cash',
        'partner_count' => 2,
        'family_owned' => false,
    ];

    /** @var array<string, mixed> */
    public array $analysis = [];

    /** @var array<int, array<string, mixed>> */
    public array $templates = [];

    /** @var array<string, array<string, string>> */
    public array $aiPrompts = [];

    /** @var array<string, int> */
    public array $templateAvailability = [];

    public string $timeframe = 'monthly';

    /** @var array<string, mixed> */
    public array $financials = [];

    /** @var array<string, bool> */
    public array $expandedSections = [];

    public string $disclaimer;

    public function mount(
        int $userId,
        FormationStudioService $studioService,
        BusinessFinancialTrackerService $trackerService
    ): void {
        $this->userId = $userId;

        $this->entities = $studioService->entities();
        $this->templates = $studioService->templates();
        $this->aiPrompts = $studioService->aiPrompts();
        $this->disclaimer = $studioService->disclaimer();
        $this->selectedEntity = array_key_first($this->entities) ?? 'sole_trader';
        $this->templateAvailability = $studioService->templateAvailability($this->selectedEntity);

        $this->analysis = $studioService->analyse($this->selectedEntity, $this->questionnaire);
        $this->financials = $trackerService->buildForUser($this->userId, $this->timeframe);

        $this->broadcastSelection();
    }

    public function selectEntity(string $entity): void
    {
        if (! isset($this->entities[$entity])) {
            return;
        }

        $this->selectedEntity = $entity;
        $this->analysis = app(FormationStudioService::class)->analyse($entity, $this->questionnaire);
        $this->templateAvailability = app(FormationStudioService::class)->templateAvailability($entity);
        $this->broadcastSelection();
    }

    public function updatedQuestionnaire(): void
    {
        $this->analysis = app(FormationStudioService::class)->analyse($this->selectedEntity, $this->questionnaire);
    }

    public function toggleExplanation(string $section): void
    {
        $this->expandedSections[$section] = ! ($this->expandedSections[$section] ?? false);
    }

    public function setTimeframe(string $timeframe): void
    {
        $allowed = ['weekly', 'monthly', 'quarterly', 'yearly'];
        if (! in_array($timeframe, $allowed, true)) {
            return;
        }

        $this->timeframe = $timeframe;
        $this->financials = app(BusinessFinancialTrackerService::class)->buildForUser($this->userId, $timeframe);
        $this->broadcastSelection();
    }

    public function render()
    {
        return view('livewire.business.formation-studio', [
            'entity' => $this->entities[$this->selectedEntity] ?? null,
            'aiPrompts' => $this->aiPrompts,
            'templates' => $this->templates,
            'financials' => $this->financials,
            'analysis' => $this->analysis,
            'expandedSections' => $this->expandedSections,
            'timeframe' => $this->timeframe,
        ]);
    }

    public function getUserProperty(): ?User
    {
        return User::query()->find($this->userId);
    }

    public function aiPrompt(string $key): string
    {
        $prompt = $this->aiPrompts[$key]['prompt'] ?? '';
        $entityLabel = Arr::get($this->entities[$this->selectedEntity] ?? [], 'label', 'Structure');
        $coFounders = (int) ($this->questionnaire['partner_count'] ?? 1);
        $equity = $coFounders > 0 ? number_format(100 / $coFounders, 2).'%' : 'N/A';

        return sprintf(
            $prompt,
            $entityLabel,
            $coFounders,
            $equity,
            $this->analysis['summary'] ?? 'Refer to questionnaire context.'
        );
    }

    public function handleSummaryEntitySelection(string|array $payload): void
    {
        $entity = is_array($payload) ? (string) ($payload['entity'] ?? '') : $payload;

        if ($entity === '') {
            return;
        }

        $this->selectEntity($entity);
    }

    public function handleSummaryTimeframeSelection(string|array $payload): void
    {
        $timeframe = is_array($payload) ? (string) ($payload['timeframe'] ?? '') : $payload;

        if ($timeframe === '') {
            return;
        }

        $this->setTimeframe($timeframe);
    }

    private function broadcastSelection(): void
    {
        $this->dispatch(
            'formation-summary-sync',
            entity: $this->selectedEntity,
            timeframe: $this->timeframe,
            availableTimeframes: $this->templateAvailability
        );
    }
}

