<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Collection;

final class WomenVerificationAnalyticsService
{
    private const CACHE_KEY = 'women_verification.analytics.summary';

    public function summary(): array
    {
        $config = (array) config('women_real_estate.verification.analytics');
        $slaHours = (int) ($config['sla_hours'] ?? 24);
        $dropoutHours = (int) ($config['dropout_hours'] ?? 72);
        $cacheTtl = (int) ($config['cache_ttl'] ?? 300);

        $resolver = fn (): array => $this->calculateSummary($slaHours, $dropoutHours);

        if ($cacheTtl <= 0) {
            return $resolver();
        }

        return $this->cache->remember(self::CACHE_KEY, $cacheTtl, $resolver);
    }

    /**
     * @return (CarbonImmutable|array|int)[]
     *
     * @psalm-return array{generated_at: CarbonImmutable, sla_threshold_hours: int, dropout_threshold_hours: int, sla: array, dropouts: array, status_breakdown: array, stage_breakdown: array}
     */
    private function calculateSummary(int $slaHours, int $dropoutHours): array
    {
        $generatedAt = CarbonImmutable::now();

        return [
            'generated_at' => $generatedAt,
            'sla_threshold_hours' => $slaHours,
            'dropout_threshold_hours' => $dropoutHours,
            'sla' => $this->buildSlaMetrics($slaHours, $generatedAt),
            'dropouts' => $this->buildDropoutMetrics($dropoutHours, $generatedAt),
            'status_breakdown' => $this->statusBreakdown(),
            'stage_breakdown' => $this->stageBreakdown(),
        ];
    }

    /**
     * @return (float|int|null)[]
     *
     * @psalm-return array{average_hours: float|null, median_hours: float|null, within_sla: int<0, max>, total_reviewed: int<0, max>, backlog_over_sla: int, backlog_pending_compliance: int, breach_rate: float|null}
     */
    private function buildSlaMetrics(int $slaHours, CarbonImmutable $now): array
    {
        $firstReviews = WomenAgentVerificationAudit::query()
            ->selectRaw('agent_id, MIN(created_at) as first_review_at')
            ->groupBy('agent_id')
            ->get();

        $durations = $this->turnaroundDurations($firstReviews);
        $totalReviewed = count($durations);
        $withinSla = $totalReviewed > 0
            ? count(array_filter($durations, static fn (float $hours): bool => $hours <= $slaHours + 1e-9))
            : 0;

        $average = $totalReviewed > 0 ? array_sum($durations) / $totalReviewed : null;
        $median = $this->median($durations);
        $breachRate = $totalReviewed > 0
            ? (($totalReviewed - $withinSla) / $totalReviewed)
            : null;

        return [
            'average_hours' => $average !== null ? round($average, 2) : null,
            'median_hours' => $median !== null ? round($median, 2) : null,
            'within_sla' => $withinSla,
            'total_reviewed' => $totalReviewed,
            'backlog_over_sla' => $this->pendingOverSla($slaHours, $now),
            'backlog_pending_compliance' => $this->pendingComplianceOverSla($slaHours, $now),
            'breach_rate' => $breachRate !== null ? round($breachRate, 4) : null,
        ];
    }

    /**
     * @param Collection<int, object{agent_id:mixed, first_review_at:mixed}> $firstReviews
     *
     * @return float[]
     *
     * @psalm-return list<float>
     */
    private function turnaroundDurations(Collection $firstReviews): array
    {
        if ($firstReviews->isEmpty()) {
            return [];
        }

        $agentIds = $firstReviews->pluck('agent_id')->map(static fn ($id): int => (int) $id)->all();
        $agents = WomenVerifiedAgent::query()
            ->whereIn('id', $agentIds)
            ->get(['id', 'created_at'])
            ->keyBy('id');

        $durations = [];

        foreach ($firstReviews as $row) {
            $agentId = (int) $row->agent_id;
            $agent = $agents->get($agentId);

            if ($agent === null || $agent->created_at === null || $row->first_review_at === null) {
                continue;
            }

            $firstReviewAt = CarbonImmutable::parse((string) $row->first_review_at);
            $hours = $agent->created_at->diffInSeconds($firstReviewAt) / 3600;
            $durations[] = max(0.0, $hours);
        }

        sort($durations);

        return $durations;
    }

    /**
     * @return (float|int|null)[]
     *
     * @psalm-return array{total_agents: int, dropout_count: int<min, max>, dropout_rate: float|null, pending_over_threshold: int, pending_information_over_threshold: int, rejected_total: int}
     */
    private function buildDropoutMetrics(int $dropoutHours, CarbonImmutable $now): array
    {
        $totalAgents = WomenVerifiedAgent::query()->count();

        if ($totalAgents === 0) {
            return [
                'total_agents' => 0,
                'dropout_count' => 0,
                'dropout_rate' => null,
                'pending_over_threshold' => 0,
                'pending_information_over_threshold' => 0,
                'rejected_total' => 0,
            ];
        }

        $threshold = $now->subHours($dropoutHours);

        $pending = WomenVerifiedAgent::query()
            ->where('status', 'pending')
            ->where('updated_at', '<=', $threshold)
            ->count();

        $pendingInfo = WomenVerifiedAgent::query()
            ->where('status', 'pending_information')
            ->where('updated_at', '<=', $threshold)
            ->count();

        $rejected = WomenVerifiedAgent::query()
            ->where('status', 'rejected')
            ->count();

        $dropoutCount = $pending + $pendingInfo + $rejected;
        $dropoutRate = $dropoutCount > 0 ? $dropoutCount / $totalAgents : 0.0;

        return [
            'total_agents' => $totalAgents,
            'dropout_count' => $dropoutCount,
            'dropout_rate' => round($dropoutRate, 4),
            'pending_over_threshold' => $pending,
            'pending_information_over_threshold' => $pendingInfo,
            'rejected_total' => $rejected,
        ];
    }

    private function pendingOverSla(int $slaHours, CarbonImmutable $now): int
    {
        return WomenVerifiedAgent::query()
            ->whereIn('status', ['pending', 'pending_information'])
            ->where('created_at', '<=', $now->subHours($slaHours))
            ->count();
    }

    private function pendingComplianceOverSla(int $slaHours, CarbonImmutable $now): int
    {
        return WomenVerifiedAgent::query()
            ->where('status', 'pending_compliance')
            ->where('updated_at', '<=', $now->subHours($slaHours))
            ->count();
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int>
     */
    private function statusBreakdown(): array
    {
        return WomenVerifiedAgent::query()
            ->selectRaw('status, COUNT(*) as total')
            ->whereNotNull('status')
            ->groupBy('status')
            ->orderByDesc('total')
            ->pluck('total', 'status')
            ->map(fn ($total): int => (int) $total)
            ->all();
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int>
     */
    private function stageBreakdown(): array
    {
        return WomenVerifiedAgent::query()
            ->selectRaw('verification_stage, COUNT(*) as total')
            ->whereNotNull('verification_stage')
            ->groupBy('verification_stage')
            ->orderByDesc('total')
            ->pluck('total', 'verification_stage')
            ->map(fn ($total): int => (int) $total)
            ->all();
    }

    /**
     * @param array<int, float> $values
     */
    private function median(array $values): ?float
    {
        $count = count($values);

        if ($count === 0) {
            return null;
        }

        $middle = (int) floor($count / 2);

        if ($count % 2 === 0) {
            return ($values[$middle - 1] + $values[$middle]) / 2;
        }

        return $values[$middle];
    }
}

