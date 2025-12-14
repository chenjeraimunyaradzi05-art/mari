<?php

declare(strict_types=1);

namespace App\Livewire\Cohorts;

use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\WomenRealEstate\MentorshipMatchingService;
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

final class MentorMatches extends LivewireComponent
{
    public int $profileId;

    public array $matches = [];

    public function mount(int $profileId, array $matches = []): void
    {
        $this->profileId = $profileId;
        $this->matches = $matches !== [] ? $matches : $this->loadMatches();
    }

    public function refreshMatches(): void
    {
        $this->matches = $this->loadMatches();
    }

    public function render()
    {
        return view('livewire.cohorts.mentor-matches', [
            'matches' => $this->matches,
        ]);
    }

    private function loadMatches(): array
    {
        $profile = WomenCohortProfile::query()
            ->where('user_id', Auth::id())
            ->whereKey($this->profileId)
            ->firstOrFail();

        return app(MentorshipMatchingService::class)->recommendations($profile);
    }
}

