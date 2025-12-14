<?php

namespace App\Jobs;

use App\Services\Impact\ImpactAnalyticsService;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class GenerateImpactReport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct(
        protected User $user,
        protected string $format = 'json'
    ) {}

    protected function convertToCsv(array $metrics): string
    {
        $csv = "Metric,Value,Unit,Description\n";

        foreach ($metrics['metrics'] as $metric) {
            $csv .= sprintf(
                "%s,%s,%s,\"%s\"\n",
                $metric->label,
                $metric->value,
                $metric->unit ?? '',
                $metric->description
            );
        }

        return $csv;
    }
}

