<?php

namespace App\Console\Commands\Social;

use App\Models\SocialMetricsDaily;
use App\Services\Social\SocialMetricsAggregationService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

final class BackfillExtendedSocialMetrics extends Command
{
    protected $signature = 'social:metrics:backfill-extended
        {--days=45 : Number of trailing days to process when start/end not provided}
        {--start= : Inclusive YYYY-MM-DD start date override}
        {--end= : Inclusive YYYY-MM-DD end date override}
        {--chunk=200 : Persona chunk size}
        {--persona=* : Limit to one or more persona IDs}
        {--dry-run : Only log work without mutating data}';

    protected $description = 'Recompute 30-day heatmaps and cohort metadata for social_metrics_daily records.';

    /**
     * @return Carbon[]
     *
     * @psalm-return list{Carbon, Carbon}
     */
    private function resolveDateRange(): array
    {
        $startOption = $this->option('start');
        $endOption = $this->option('end');

        $end = $endOption ? Carbon::parse($endOption)->endOfDay() : Carbon::now()->endOfDay();

        if ($startOption) {
            $start = Carbon::parse($startOption)->startOfDay();
        } else {
            $days = max(1, (int) $this->option('days'));
            $start = $end->copy()->subDays($days - 1)->startOfDay();
        }

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
        }

        return [$start, $end];
    }

    /**
     * @psalm-return Collection<int, int>
     */
    private function collectPersonaFilter(): Collection
    {
        return collect($this->option('persona'))
            ->filter()
            ->map(fn ($value) => (int) $value)
            ->filter(fn ($value) => $value > 0)
            ->unique()
            ->values();
    }

    /**
     * @psalm-return Collection<int, Collection>
     */
    private function resolvePersonaChunksForDate(Carbon $date, Collection $personaFilter, int $chunkSize): Collection
    {
        if ($personaFilter->isNotEmpty()) {
            return $personaFilter->chunk($chunkSize)->values();
        }

        $personaIds = SocialMetricsDaily::query()
            ->whereDate('captured_on', $date->toDateString())
            ->orderBy('persona_id')
            ->pluck('persona_id');

        return $personaIds->chunk($chunkSize)->values();
    }
}

