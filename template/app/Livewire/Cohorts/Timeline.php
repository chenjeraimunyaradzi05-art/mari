<?php

declare(strict_types=1);

namespace App\Livewire\Cohorts;

use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\WomenRealEstate\WomenCohortTimelineService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
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

final class Timeline extends LivewireComponent
{
    public int $profileId;

    public array $events = [];

    public function mount(int $profileId, array $events = []): void
    {
        $this->profileId = $profileId;
        $this->events = $events !== [] ? $events : $this->loadEvents();
    }

    public function refreshEvents(): void
    {
        $this->events = $this->loadEvents();
    }

    public function render()
    {
        return view('livewire.cohorts.timeline', [
            'events' => $this->events,
        ]);
    }

    private function loadEvents(): array
    {
        $profile = WomenCohortProfile::query()
            ->where('user_id', Auth::id())
            ->whereKey($this->profileId)
            ->firstOrFail();

        $service = app(WomenCohortTimelineService::class);

        return $service->recentEvents($profile, 20)
            ->map(function ($event) {
                $metadata = $event->metadata ?? [];

                return [
                    'id' => $event->id,
                    'headline' => $event->headline,
                    'summary' => $event->summary,
                    'activation_steps' => Arr::get($metadata, 'activation_steps', []),
                    'values_alignment' => Arr::get($metadata, 'values_alignment', []),
                    'provider' => Arr::get($metadata, 'ai_provider'),
                    'score' => Arr::get($metadata, 'score'),
                    'subject' => Arr::get($metadata, 'subject'),
                    'occurred_at' => optional($event->occurred_at)->diffForHumans(),
                ];
            })
            ->all();
    }
}

