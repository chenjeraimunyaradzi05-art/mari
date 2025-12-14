<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Badge;
use App\Models\Candidate;
use App\Models\City;
use App\Models\InterviewQuestion;
use App\Models\Job;
use App\Models\Order;
use App\Models\Progress;
use App\Models\UserPlan;
use App\Models\WarmupMetricEvent;
use App\Models\WarmupMetricSnapshot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

final class CompanyDashboardController extends Controller
{
    function index() : View {
        $user = Auth::user();

        if (!$user) {
            abort(403);
        }

        $companyId = $user->company?->id;

        $jobPosts = Job::where('company_id', $companyId)
            ->where('status', 'pending')
            ->count();

        $totalJobs = Job::where('company_id', $companyId)->count();
        $totalOrders = Order::where('company_id', $companyId)->count();
        $userPlan = UserPlan::where('company_id', $companyId)->first();

        $progress = Progress::where('user_id', $user->id)->get();
        if ($progress->isEmpty()) {
            $progress = collect([[ 'value' => 0, 'target' => 100 ]]);
        }

        $badges = Badge::where('user_id', $user->id)->get();

        $latestSnapshot = WarmupMetricSnapshot::latestSnapshot()->first();
        $previousSnapshot = $this->resolvePreviousSnapshot($latestSnapshot);

        $aiHealthMetrics = $this->buildAiHealthMetrics($latestSnapshot, $previousSnapshot);
        $aiActionSummaries = $this->buildAiActionSummaries();
        $aiQueueSnapshot = $this->buildAiQueueSnapshot();

        $salaryInsights = $this->buildSalaryInsights($companyId);
        $interviewToolkit = $this->buildInterviewToolkitInsights();
        $talentPoolSummary = $this->buildTalentPoolSummary();

        return view('frontend.company-dashboard.dashboard', compact(
            'jobPosts',
            'totalJobs',
            'totalOrders',
            'userPlan',
            'progress',
            'badges',
            'aiHealthMetrics',
            'aiActionSummaries',
            'aiQueueSnapshot',
            'salaryInsights',
            'interviewToolkit',
            'talentPoolSummary'
        ));
    }

    private function resolvePreviousSnapshot(?WarmupMetricSnapshot $latest): WarmupMetricSnapshot|null
    {
        if (!$latest) {
            return null;
        }

        return WarmupMetricSnapshot::latestSnapshot()
            ->where('snapshot_date', '<', $latest->snapshot_date)
            ->first();
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{label: 'Successful AI calls (24h)', value: string, trend: string}, 1?: array{label: 'Average response time (ms)', value: string, trend: string}, 2?: array{label: 'Fallback rate', value: string, trend: string}}
     */
    private function buildAiHealthMetrics(?WarmupMetricSnapshot $latest, ?WarmupMetricSnapshot $previous): array
    {
        if (!$latest) {
            return [];
        }

        $fallbackCurrent = $this->calculateFallbackRate($latest);
        $fallbackPrevious = $this->calculateFallbackRate($previous);

        return [
            [
                'label' => 'Successful AI calls (24h)',
                'value' => number_format($latest->success_count ?? 0),
                'trend' => $this->formatTrend($latest->success_count ?? null, optional($previous)->success_count),
            ],
            [
                'label' => 'Average response time (ms)',
                'value' => number_format($latest->avg_duration_ms ?? 0) . ' ms',
                'trend' => $this->formatTrend($latest->avg_duration_ms ?? null, optional($previous)->avg_duration_ms),
            ],
            [
                'label' => 'Fallback rate',
                'value' => number_format(($fallbackCurrent ?? 0) * 100, 2) . '%',
                'trend' => $this->formatTrend($fallbackCurrent, $fallbackPrevious, true),
            ],
        ];
    }

    private function calculateFallbackRate(?WarmupMetricSnapshot $snapshot): ?float
    {
        if (!$snapshot) {
            return null;
        }

        $total = ($snapshot->success_count ?? 0) + ($snapshot->failure_count ?? 0);
        if ($total === 0) {
            return 0.0;
        }

        return ($snapshot->failure_count ?? 0) / $total;
    }

    private function formatTrend(?float $current, ?float $previous, bool $asPercentagePoints = false): string
    {
        if ($current === null || $previous === null) {
            return 'Trend unavailable';
        }

        if ($previous == 0.0) {
            return $current == 0.0 ? 'No change' : 'New baseline';
        }

        if ($asPercentagePoints) {
            $change = $current - $previous;
            if (abs($change) < 0.0005) {
                return 'Flat vs previous';
            }

            $sign = $change > 0 ? '+' : '−';
            $value = number_format(abs($change) * 100, 2);

            return sprintf('%s%s pts', $sign, $value);
        }

        $percentageChange = (($current - $previous) / $previous) * 100;
        if (abs($percentageChange) < 0.05) {
            return 'Flat vs previous';
        }

        $sign = $percentageChange > 0 ? '+' : '−';
        $formatted = number_format(abs($percentageChange), 1);

        return sprintf('%s%s%%', $sign, $formatted);
    }

    /**
     * @psalm-return array<int, mixed>
     */
    private function buildAiActionSummaries(): array
    {
        $events = WarmupMetricEvent::query()
            ->selectRaw('action, COUNT(*) as total_events, SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failures')
            ->where('created_at', '>=', now()->subDays(14))
            ->groupBy('action')
            ->orderByDesc('failures')
            ->orderByDesc('total_events')
            ->take(4)
            ->get();

        if ($events->isEmpty()) {
            return [];
        }

        return $events->map(function ($row) {
            $total = (int) ($row->total_events ?? 0);
            $failures = (int) ($row->failures ?? 0);
            $failureRate = $total > 0 ? round(($failures / $total) * 100, 1) : 0;

            return [
                'action' => Str::of($row->action ?? 'core pipeline')->headline(),
                'total' => $total,
                'failure_rate' => $failureRate,
            ];
        })->toArray();
    }

    /**
     * @return (float|int|string)[]
     *
     * @psalm-return array{window: 'Last 24 hours', total: int<min, max>, successful: int, failed: int, pending: int, failure_rate: 0|float}
     */
    private function buildAiQueueSnapshot(): array
    {
        $statusCounts = WarmupMetricEvent::query()
            ->where('created_at', '>=', now()->subHours(24))
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        if (empty($statusCounts)) {
            return [
                'window' => 'Last 24 hours',
                'total' => 0,
                'successful' => 0,
                'failed' => 0,
                'pending' => 0,
                'failure_rate' => 0,
            ];
        }

        $successful = $this->sumByKeys($statusCounts, ['success', 'succeeded', 'completed']);
        $failed = $this->sumByKeys($statusCounts, ['failed', 'error', 'errored']);
        $pending = $this->sumByKeys($statusCounts, ['pending', 'running', 'queued', 'processing', 'in_progress']);

        $total = array_sum(array_map('intval', $statusCounts));
        $failureRate = $total > 0 ? round(($failed / $total) * 100, 1) : 0;

        return [
            'window' => 'Last 24 hours',
            'total' => $total,
            'successful' => $successful,
            'failed' => $failed,
            'pending' => $pending,
            'failure_rate' => $failureRate,
        ];
    }

    /**
     * @return (Job|\Illuminate\Support\Collection|bool|float|int|null)[]
     *
     * @psalm-return array{has_data: bool, average_min?: float|null, average_max?: float|null, roles_with_range?: int, custom_samples?: \Illuminate\Support\Collection, recent_role?: Job|null}
     */
    private function buildSalaryInsights(?int $companyId): array
    {
        if (!$companyId) {
            return [
                'has_data' => false,
            ];
        }

        $jobs = Job::query()
            ->where('company_id', $companyId);

        $rangeJobs = (clone $jobs)
            ->where('salary_mode', 'range')
            ->whereNotNull('min_salary')
            ->whereNotNull('max_salary');

        $averageMin = (clone $rangeJobs)->avg('min_salary');
        $averageMax = (clone $rangeJobs)->avg('max_salary');
        $rolesWithRange = (clone $rangeJobs)->count();

        $customSamples = (clone $jobs)
            ->where('salary_mode', 'custom')
            ->whereNotNull('custom_salary')
            ->latest()
            ->take(5)
            ->pluck('custom_salary', 'title');

        $recentRole = (clone $jobs)
            ->select(['title', 'salary_mode', 'min_salary', 'max_salary', 'custom_salary'])
            ->latest()
            ->first();

        return [
            'has_data' => $rolesWithRange > 0 || $customSamples->isNotEmpty(),
            'average_min' => $averageMin ? round($averageMin) : null,
            'average_max' => $averageMax ? round($averageMax) : null,
            'roles_with_range' => $rolesWithRange,
            'custom_samples' => $customSamples,
            'recent_role' => $recentRole,
        ];
    }

    /**
     * @return (bool|float|mixed|null)[]
     *
     * @psalm-return array{has_data: bool, total_questions?: mixed, popular_types?: mixed, average_time_limit?: float|null}
     */
    private function buildInterviewToolkitInsights(): array
    {
        $query = InterviewQuestion::query()->active();

        $total = (clone $query)->count();

        if ($total === 0) {
            return [
                'has_data' => false,
            ];
        }

        $typeBreakdown = (clone $query)
            ->selectRaw('type, COUNT(*) as total')
            ->groupBy('type')
            ->orderByDesc('total')
            ->take(4)
            ->get()
            ->map(fn ($row) => [
                'type' => $row->type ?? 'general',
                'total' => (int) $row->total,
            ]);

        $averageTime = (clone $query)
            ->whereNotNull('time_limit')
            ->avg('time_limit');

        return [
            'has_data' => true,
            'total_questions' => $total,
            'popular_types' => $typeBreakdown,
            'average_time_limit' => $averageTime ? round($averageTime / 60, 1) : null,
        ];
    }

    /**
     * @return (\Illuminate\Database\Eloquent\Collection|\Illuminate\Support\Collection|bool|int|mixed)[]
     *
     * @psalm-return array{has_data: bool, total_candidates?: mixed, recent_candidates?: mixed, video_profiles?: 0|mixed, top_cities?: \Illuminate\Database\Eloquent\Collection<int, array{name: 'Unknown city'|mixed, count: int}>|\Illuminate\Support\Collection<int, array{name: 'Unknown city'|mixed, count: int}>}
     */
    private function buildTalentPoolSummary(): array
    {
        $totalCandidates = Candidate::count();

        if ($totalCandidates === 0) {
            return [
                'has_data' => false,
            ];
        }

        $recentCandidates = Candidate::where('created_at', '>=', now()->subDays(30))->count();
        $videoProfiles = Schema::hasColumn('candidates', 'profile_video_url')
            ? Candidate::whereNotNull('profile_video_url')->count()
            : 0;

        $topCitiesRaw = Candidate::query()
            ->selectRaw('city, COUNT(*) as total')
            ->whereNotNull('city')
            ->groupBy('city')
            ->orderByDesc('total')
            ->take(3)
            ->get();

        $cityNames = City::whereIn('id', $topCitiesRaw->pluck('city')->filter())
            ->pluck('name', 'id');

        $topCities = $topCitiesRaw->map(function ($row) use ($cityNames) {
            return [
                'name' => $cityNames[$row->city] ?? 'Unknown city',
                'count' => (int) $row->total,
            ];
        });

        return [
            'has_data' => true,
            'total_candidates' => $totalCandidates,
            'recent_candidates' => $recentCandidates,
            'video_profiles' => $videoProfiles,
            'top_cities' => $topCities,
        ];
    }

    /**
     * @psalm-return int<min, max>
     */
    private function sumByKeys(array $source, array $keys): int
    {
        $sum = 0;
        foreach ($keys as $key) {
            $sum += (int) ($source[$key] ?? 0);
        }

        return $sum;
    }
}

