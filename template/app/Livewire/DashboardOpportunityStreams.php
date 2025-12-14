<?php

namespace App\Livewire;

use App\Support\Livewire\FallbackComponent;

trait DashboardOpportunityStreamsBehavior
{
    public array $streams = [];

    public array $expanded = [];

    public ?int $userId = null;

    public function mount(array $streams = [], ?int $userId = null): void
    {
        $this->streams = $streams;
        $this->userId = $userId;
    }

    public function toggle(string $key): void
    {
        $this->expanded[$key] = ! ($this->expanded[$key] ?? false);
    }

    public function expandAll(): void
    {
        foreach (array_keys($this->streams) as $key) {
            $this->expanded[$key] = true;
        }
    }

    public function collapseAll(): void
    {
        $this->expanded = [];
    }

    public function visibleItems(string $key): array
    {
        $items = $this->streams[$key] ?? [];

        if (($this->expanded[$key] ?? false) === true) {
            return $items;
        }

        return array_slice($items, 0, 3);
    }

    public function render()
    {
        return view('livewire.dashboard-opportunity-streams');
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class DashboardOpportunityStreams extends LivewireComponent
{
    use DashboardOpportunityStreamsBehavior;
}

