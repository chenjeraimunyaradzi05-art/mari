<?php

declare(strict_types=1);

namespace App\Livewire\Mortgage;

use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\WomenRealEstate\GoalTrackingService;
use App\Services\WomenRealEstate\MortgageGuidanceService;
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

final class Widget extends LivewireComponent
{
    public int $profileId;

    public array $insight = [];

    public function mount(int $profileId, array $insight = []): void
    {
        $this->profileId = $profileId;
        $this->insight = $insight !== [] ? $insight : $this->loadInsight();
    }

    public function refreshInsight(): void
    {
        $this->insight = $this->loadInsight();
    }

    public function render()
    {
        return view('livewire.mortgage.widget', [
            'insight' => $this->insight,
        ]);
    }

    private function loadInsight(): array
    {
        $profile = WomenCohortProfile::query()
            ->with('goalTrackers')
            ->where('user_id', Auth::id())
            ->whereKey($this->profileId)
            ->firstOrFail();

        $goalSummary = app(GoalTrackingService::class)->summary($profile);

        return app(MortgageGuidanceService::class)->insight($profile, $goalSummary);
    }
}

