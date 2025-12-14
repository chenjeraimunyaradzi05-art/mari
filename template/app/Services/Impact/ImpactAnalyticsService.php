<?php

namespace App\Services\Impact;

use App\DataTransferObjects\Impact\ImpactMetric;
use App\Models\AppliedJob;
use App\Models\BundleOffer;
use App\Models\Business\BusinessProfile;
use App\Models\BusinessCashbookEntry;
use App\Models\Budget;
use App\Models\HousingListing;
use App\Models\ImpactIndexSnapshot;
use App\Models\Job;
use App\Models\MentorshipMatch;
use App\Models\OpportunityRadarEntry;
use App\Models\User;
use App\Models\WomenHousingListing;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use function data_get;

final class ImpactAnalyticsService
{
    public function __construct(private CacheRepository $cache)
    {
    }
    private const CACHE_TTL_SECONDS = 900;

    /**
     * @return (Collection|mixed)[]
     *
     * @psalm-return array{timeframe: mixed, window_start: mixed, window_end: mixed, generated_at: mixed, metrics: Collection<int<0, 4>, ImpactMetric>}
     */
    public function getPublicMetrics(string $timeframe = 'daily'): array
    {
        $dataset = $this->cachedAggregate($timeframe);

        $metrics = collect([
            $this->metricFromDataset(
                dataset: $dataset,
                key: 'members_total',
                label: 'Community Members',
                description: 'Verified members inside Athena',
                icon: 'members'
            ),
            $this->metricFromDataset(
                dataset: $dataset,
                key: 'jobs_secured',
                label: 'Jobs Secured',
                description: 'Roles secured through Athena matching',
                icon: 'jobs'
            ),
            $this->metricFromDataset(
                dataset: $dataset,
                key: 'housing_transitions',
                label: 'Housing Transitions',
                description: 'Moves supported via vetted housing network',
                icon: 'housing'
            ),
            $this->metricFromDataset(
                dataset: $dataset,
                key: 'businesses_trading',
                label: 'Businesses Trading',
                description: 'Women-led ventures trading with Athena support',
                icon: 'ventures'
            ),
            $this->metricFromDataset(
                dataset: $dataset,
                key: 'mentorship_matches_active',
                label: 'Mentorship Matches',
                description: 'Active safeguarded mentorship pairs',
                icon: 'mentorship'
            ),
        ]);

        return [
            'timeframe' => $dataset['timeframe'],
            'window_start' => $dataset['window_start'],
            'window_end' => $dataset['window_end'],
            'generated_at' => $dataset['generated_at'],
            'metrics' => $metrics,
        ];
    }

    /**
     * @return (Collection|mixed)[]
     *
     * @psalm-return array{timeframe: mixed, window_start: mixed, window_end: mixed, generated_at: mixed, metrics: Collection<int<0, 9>, ImpactMetric>}
     */
    public function getPartnerMetrics(string $timeframe = 'monthly'): array
    {
        $dataset = $this->cachedAggregate($timeframe);

        $metrics = collect([
            $this->metricFromDataset($dataset, 'jobs_secured', 'Jobs Secured', 'Closed placements via Athena', 'jobs'),
            $this->metricFromDataset($dataset, 'job_opportunities_active', 'Active Job Opportunities', 'Live vetted roles on platform', 'roles'),
            $this->metricFromDataset($dataset, 'housing_transitions', 'Housing Transitions', 'Supported moves into safer housing', 'housing'),
            $this->metricFromDataset($dataset, 'safe_housing_supply', 'Safe Housing Supply', 'Verified listings available now', 'safety'),
            $this->metricFromDataset($dataset, 'businesses_trading', 'Businesses Trading', 'Women-led ventures trading', 'ventures'),
            $this->metricFromDataset($dataset, 'budgets_created', 'Budget Resets', 'Members with live budget plans', 'budget'),
            $this->metricFromDataset($dataset, 'cashbook_entries_reviewed', 'AI-reviewed Cashbook Entries', 'Entries processed by AI assistant', 'ai'),
            $this->metricFromDataset($dataset, 'mentorship_matches_active', 'Mentorship Matches', 'Active mentorship cohorts', 'mentorship'),
            $this->metricFromDataset($dataset, 'radar_actions', 'Opportunity Radar Actions', 'High-signal alerts attendees acted on', 'radar'),
            $this->metricFromDataset($dataset, 'impact_velocity', 'Impact Velocity', 'Composite conversion index', 'velocity'),
        ]);

        return [
            'timeframe' => $dataset['timeframe'],
            'window_start' => $dataset['window_start'],
            'window_end' => $dataset['window_end'],
            'generated_at' => $dataset['generated_at'],
            'metrics' => $metrics,
        ];
    }

    public function captureSnapshot(string $timeframe = 'daily', bool $publish = true): ImpactIndexSnapshot
    {
        $dataset = $this->cachedAggregate($timeframe, true);

        return ImpactIndexSnapshot::updateOrCreate(
            [
                'timeframe' => $timeframe,
                'snapshot_date' => now()->toDateString(),
            ],
            [
                'metrics' => $dataset['metrics'],
                'is_public' => $publish,
                'published_at' => $publish ? now() : null,
            ]
        );
    }

    private function cachedAggregate(string $timeframe, bool $refresh = false): array
    {
        $cacheKey = sprintf('impact:metrics:%s', $timeframe);

        if (! $refresh && ($cached = $this->cache->get($cacheKey))) {
            return $cached;
        }

        $payload = $this->aggregateMetrics($timeframe);
        $this->cache->put($cacheKey, $payload, self::CACHE_TTL_SECONDS);

        return $payload;
    }

    /**
     * @return (array[]|null|string)[]
     *
     * @psalm-return array{timeframe: string, window_start: null|string, window_end: string, generated_at: string, metrics: array{members_total: array, jobs_secured: array, job_opportunities_active: array, housing_transitions: array, safe_housing_supply: array, businesses_trading: array, mentorship_matches_active: array, budgets_created: array, cashbook_entries_reviewed: array, radar_actions: array, bundle_savings_modelled: array, impact_velocity: array}}
     */
    private function aggregateMetrics(string $timeframe): array
    {
        [$windowStart, $windowEnd] = $this->resolveWindow($timeframe);
        $previousSnapshot = $this->previousSnapshot($timeframe);

        $membersQuery = User::query();
        $membersTotal = (clone $membersQuery)->count();
        $memberGrowth = $this->countForWindow($membersQuery, $windowStart, $windowEnd);

        $jobsQuery = AppliedJob::query();
        $jobsTotal = (clone $jobsQuery)->count();
        $jobsWindow = $this->countForWindow($jobsQuery, $windowStart, $windowEnd);

        $jobsActive = Job::query()->where('status', 'active')->count();

        $housingTransitionsQuery = WomenHousingListing::query()
            ->where('moderation_status', 'clean')
            ->where('verification_status', 'verified');
        $housingTransitionsTotal = (clone $housingTransitionsQuery)->count();
        $housingTransitionsWindow = $this->countForWindow($housingTransitionsQuery, $windowStart, $windowEnd, 'updated_at');

        $safeHousingQuery = HousingListing::query()->where('status', 'published');
        $safeHousingTotal = (clone $safeHousingQuery)->count();

        $businessQuery = BusinessProfile::query()->where('stage', 'trading');
        $businessTotal = (clone $businessQuery)->count();
        $businessWindow = $this->countForWindow($businessQuery, $windowStart, $windowEnd);

        $mentorshipQuery = MentorshipMatch::query()->where('status', 'active');
        $mentorshipTotal = (clone $mentorshipQuery)->count();
        $mentorshipWindow = $this->countForWindow($mentorshipQuery, $windowStart, $windowEnd, 'started_at');

        $budgetQuery = Budget::query();
        $budgetTotal = (clone $budgetQuery)->count();
        $budgetWindow = $this->countForWindow($budgetQuery, $windowStart, $windowEnd, 'updated_at');

        $cashbookQuery = BusinessCashbookEntry::query()->where('reviewed_by_ai', true);
        $cashbookTotal = (clone $cashbookQuery)->count();
        $cashbookWindow = $this->countForWindow($cashbookQuery, $windowStart, $windowEnd, 'updated_at');

        $radarQuery = OpportunityRadarEntry::query()->where('score', '>=', 70);
        $radarTotal = (clone $radarQuery)->count();
        $radarWindow = $this->countForWindow($radarQuery, $windowStart, $windowEnd, 'notified_at');

        $bundleOfferQuery = BundleOffer::query()->where('status', '!=', 'archived');
        $bundleSavingsTotal = (float) (clone $bundleOfferQuery)->sum('projected_savings_annual');
        $bundleSavingsWindow = $this->sumForWindow($bundleOfferQuery, $windowStart, $windowEnd, 'created_at', 'projected_savings_annual');

        $impactVelocity = $this->impactVelocityIndex($jobsWindow, $housingTransitionsWindow, $businessWindow, $memberGrowth);

        $metrics = [
            'members_total' => $this->composeMetric($membersTotal, $memberGrowth, $previousSnapshot, 'members_total', ['unit' => 'people']),
            'jobs_secured' => $this->composeMetric($jobsTotal, $jobsWindow, $previousSnapshot, 'jobs_secured', ['unit' => 'placements']),
            'job_opportunities_active' => $this->composeMetric($jobsActive, null, $previousSnapshot, 'job_opportunities_active', ['unit' => 'roles']),
            'housing_transitions' => $this->composeMetric($housingTransitionsTotal, $housingTransitionsWindow, $previousSnapshot, 'housing_transitions', ['unit' => 'households']),
            'safe_housing_supply' => $this->composeMetric($safeHousingTotal, null, $previousSnapshot, 'safe_housing_supply', ['unit' => 'listings']),
            'businesses_trading' => $this->composeMetric($businessTotal, $businessWindow, $previousSnapshot, 'businesses_trading', ['unit' => 'ventures']),
            'mentorship_matches_active' => $this->composeMetric($mentorshipTotal, $mentorshipWindow, $previousSnapshot, 'mentorship_matches_active', ['unit' => 'matches']),
            'budgets_created' => $this->composeMetric($budgetTotal, $budgetWindow, $previousSnapshot, 'budgets_created', ['unit' => 'plans']),
            'cashbook_entries_reviewed' => $this->composeMetric($cashbookTotal, $cashbookWindow, $previousSnapshot, 'cashbook_entries_reviewed', ['unit' => 'entries']),
            'radar_actions' => $this->composeMetric($radarTotal, $radarWindow, $previousSnapshot, 'radar_actions', ['unit' => 'alerts']),
            'bundle_savings_modelled' => $this->composeMetric($bundleSavingsTotal, $bundleSavingsWindow, $previousSnapshot, 'bundle_savings_modelled', ['unit' => 'AUD']),
            'impact_velocity' => $this->composeMetric($impactVelocity, null, $previousSnapshot, 'impact_velocity', ['unit' => 'index', 'meta' => ['components' => ['jobs', 'housing', 'businesses']]]),
        ];

        return [
            'timeframe' => $timeframe,
            'window_start' => $windowStart?->toDateTimeString(),
            'window_end' => $windowEnd->toDateTimeString(),
            'generated_at' => now()->toDateTimeString(),
            'metrics' => $metrics,
        ];
    }

    private function metricFromDataset(
        array $dataset,
        string $key,
        string $label,
        string $description,
        ?string $icon = null
    ): ImpactMetric {
        $stat = $dataset['metrics'][$key] ?? ['value' => 0, 'window' => null, 'previous' => null];
        $unit = $stat['unit'] ?? null;
        $previous = $stat['previous'] ?? null;
        $change = $previous !== null ? $stat['value'] - $previous : ($stat['window'] ?? null);

        return new ImpactMetric(
            key: $key,
            label: $label,
            value: $stat['value'],
            unit: $unit,
            change: $change,
            icon: $icon,
            description: $description,
            meta: array_merge([
                'window' => $stat['window'],
                'previous' => $previous,
            ], $stat['meta'] ?? [])
        );
    }

    /**
     * @return (float|int|mixed|null)[]
     *
     * @psalm-return array{value: float|int|mixed, window: float|int|mixed|null, previous: float|int|mixed|null,...}
     */
    private function composeMetric(
        int|float $value,
        int|float|null $window,
        ?ImpactIndexSnapshot $previousSnapshot,
        string $key,
        array $extra = []
    ): array {
        return array_merge([
            'value' => $value,
            'window' => $window,
            'previous' => $this->extractPreviousValue($previousSnapshot, $key),
        ], $extra);
    }

    private function extractPreviousValue(?ImpactIndexSnapshot $snapshot, string $key): int|float|null
    {
        if (! $snapshot) {
            return null;
        }

        $value = data_get($snapshot->metrics, $key);

        if (is_array($value)) {
            return $value['value'] ?? null;
        }

        return is_numeric($value) ? (int) $value : null;
    }

    /**
     * @return (Carbon|null)[]
     *
     * @psalm-return list{Carbon|null, Carbon}
     */
    private function resolveWindow(string $timeframe): array
    {
        $end = now();

        $start = match ($timeframe) {
            'daily' => (clone $end)->startOfDay(),
            'weekly' => (clone $end)->startOfWeek(),
            'monthly' => (clone $end)->startOfMonth(),
            'quarterly' => (clone $end)->firstOfQuarter(),
            'yearly' => (clone $end)->startOfYear(),
            default => null,
        };

        return [$start, $end];
    }

    private function countForWindow(Builder $query, ?Carbon $start, ?Carbon $end, string $column = 'created_at'): int
    {
        $builder = clone $query;

        return $builder
            ->when($start, fn (Builder $inner) => $inner->where($column, '>=', $start))
            ->when($end, fn (Builder $inner) => $inner->where($column, '<=', $end))
            ->count();
    }

    private function sumForWindow(Builder $query, ?Carbon $start, ?Carbon $end, string $column, string $valueColumn): float
    {
        $builder = clone $query;

        return (float) $builder
            ->when($start, fn (Builder $inner) => $inner->where($column, '>=', $start))
            ->when($end, fn (Builder $inner) => $inner->where($column, '<=', $end))
            ->sum($valueColumn);
    }

    private function previousSnapshot(string $timeframe): ImpactIndexSnapshot|null
    {
        return ImpactIndexSnapshot::query()
            ->where('timeframe', $timeframe)
            ->where('snapshot_date', '<', now()->toDateString())
            ->latest('snapshot_date')
            ->first();
    }

    private function impactVelocityIndex(int $jobsWindow, int $housingWindow, int $businessWindow, int $memberGrowth): float
    {
        $numerator = $jobsWindow + $housingWindow + $businessWindow;

        if ($memberGrowth <= 0) {
            return (float) $numerator;
        }

        return round($numerator / max(1, $memberGrowth), 2);
    }
}

