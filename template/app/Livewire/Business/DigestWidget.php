<?php

declare(strict_types=1);

namespace App\Livewire\Business;

use App\Models\Business\BusinessProfile;
use App\Services\Business\BusinessInsightsService;
use App\Support\Livewire\FallbackComponent;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class DigestWidget extends LivewireComponent
{
    public int $profileId;

    /** @var array<string, mixed> */
    public array $snapshot = [];

    public bool $refreshing = false;

    protected $listeners = [
        'business-digest:refresh' => 'refreshSnapshot',
    ];

    public function mount(int $profileId, array $snapshot = []): void
    {
        $this->profileId = $profileId;
        $this->snapshot = $snapshot !== [] ? $snapshot : $this->loadSnapshot();
    }

    public function refreshSnapshot(BusinessInsightsService $insightsService = null): void
    {
        $this->refreshing = true;
        $insights = $insightsService ?? app(BusinessInsightsService::class);
        $this->snapshot = $insights->snapshot($this->resolveProfile());
        $this->refreshing = false;
    }

    public function render()
    {
        $snapshot = $this->snapshot ?: $this->loadSnapshot();

        return view('livewire.business.digest-widget', [
            'snapshot' => $snapshot,
            'kpis' => collect($snapshot['kpis'] ?? [])->values(),
            'nextMilestone' => $snapshot['next_milestone'] ?? null,
            'resourceSpotlight' => $snapshot['resource_spotlight'] ?? null,
        ]);
    }

    private function loadSnapshot(): array
    {
        return app(BusinessInsightsService::class)->snapshot($this->resolveProfile());
    }

    private function resolveProfile(): BusinessProfile
    {
        return BusinessProfile::query()
            ->with('milestones', 'user.socialProfile')
            ->whereKey($this->profileId)
            ->firstOrFail();
    }
}

