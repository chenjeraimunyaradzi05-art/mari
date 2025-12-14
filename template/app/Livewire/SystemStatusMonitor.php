<?php

namespace App\Livewire;

use Livewire\Component;
use Livewire\Attributes\Layout;
use Illuminate\Support\Carbon;

final class SystemStatusMonitor extends Component
{
    public int $refreshCount = 0;

    public function refresh(): void
    {
        $this->refreshCount++;
    }

    #[Layout('layouts.app')]
    public function render(): \Illuminate\Contracts\View\View
    {
        return view('livewire.system-status-monitor', [
            'serverTime' => Carbon::now()->toDateTimeString(),
            'memoryUsage' => round(memory_get_usage() / 1024 / 1024, 2) . ' MB',
            'randomMetric' => rand(10, 100),
        ]);
    }
}

