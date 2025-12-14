<?php

declare(strict_types=1);

namespace App\Livewire\Goals;

use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\WomenRealEstate\GoalTrackingService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Facades\Auth;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class Tracker extends LivewireComponent
{
    public int $profileId;

    public array $summary = [];

    public function mount(int $profileId, array $summary = []): void
    {
        $this->profileId = $profileId;
        $this->summary = $summary !== [] ? $summary : $this->loadSummary();
    }

    public function refreshSummary(): void
    {
        $this->summary = $this->loadSummary();
    }

    public function render()
    {
        return view('livewire.goals.tracker', [
            'goals' => $this->summary['goals'] ?? [],
            'overallProgress' => $this->summary['overall_progress'] ?? 0,
            'primaryGoal' => $this->summary['primary_goal'] ?? null,
        ]);
    }

    private function loadSummary(): array
    {
        $profile = WomenCohortProfile::query()
            ->with('goalTrackers')
            ->where('user_id', Auth::id())
            ->whereKey($this->profileId)
            ->firstOrFail();

        return app(GoalTrackingService::class)->summary($profile);
    }
}

