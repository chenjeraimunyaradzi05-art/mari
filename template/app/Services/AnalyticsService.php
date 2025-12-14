<?php

namespace App\Services;

use App\Models\AppliedJob;
use App\Models\BillingCharge;
use App\Models\BillingMeter;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\Country;
use App\Models\Job;
use App\Models\JobCategory;
use App\Models\JobType;
use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

final class AnalyticsService
{
	private const CACHE_PREFIX = 'analytics.';
	private const CACHE_TTL = 300;
	private const PERIOD_KEYS = ['7days', '30days', '90days', 'year'];

	public function clearCache(): void
	{
		$baseKeys = [
			'overview',
			'application_status',
			'conversion_metrics',
			'monthly_revenue',
			'job_type_distribution',
			'geographic_distribution',
		];

		foreach ($baseKeys as $key) {
			Cache::forget(self::CACHE_PREFIX . $key);
		}

		$paramKeys = [
			'top_categories.8',
			'top_companies.5',
			'recent_applications.10',
			'recent_transactions.10',
		];

		foreach ($paramKeys as $key) {
			Cache::forget(self::CACHE_PREFIX . $key);
		}

		$seriesKeys = [
			'jobs_over_time',
			'applications_over_time',
			'revenue_over_time',
			'user_registrations_over_time',
		];

		foreach ($seriesKeys as $series) {
			foreach (self::PERIOD_KEYS as $period) {
				Cache::forget(self::CACHE_PREFIX . "{$series}.{$period}");
			}
		}
	}

	public function getOverviewStats(): array
	{
		return $this->remember('overview', function () {
			$today = Carbon::today();

			$totalJobs = Job::count();
			$activeJobs = Job::where('status', 'active')->count();
			$newJobsToday = Job::whereDate('created_at', $today)->count();

			$totalApplications = AppliedJob::count();
			$newApplicationsToday = AppliedJob::whereDate('created_at', $today)->count();
			$totalHired = $this->getTotalHired();

			$totalCandidates = Candidate::count();
			$totalCompanies = Company::count();
			$newUsersToday = User::whereDate('created_at', $today)->count();

			$totalRevenue = (float) Order::sum('amount');

			return [
				'total_jobs' => $totalJobs,
				'active_jobs' => $activeJobs,
				'new_jobs_today' => $newJobsToday,
				'total_applications' => $totalApplications,
				'pending_applications' => max($totalApplications - $totalHired, 0),
				'new_applications_today' => $newApplicationsToday,
				'total_candidates' => $totalCandidates,
				'total_companies' => $totalCompanies,
				'new_users_today' => $newUsersToday,
				'total_revenue' => $totalRevenue,
			];
		});
	}

	public function getTopJobCategories(int $limit = 8): array
	{
		return $this->remember('top_categories.' . $limit, function () use ($limit) {
			$categories = JobCategory::query()
				->select(['id', 'name'])
				->withCount('jobs')
				->orderByDesc('jobs_count')
				->limit($limit)
				->get();

			return [
				'labels' => $categories->pluck('name')->map(fn ($name) => $name ?? 'Unknown')->toArray(),
				'data' => $categories->pluck('jobs_count')->map(fn ($count) => (int) $count)->toArray(),
			];
		});
	}

	public function getApplicationStatusDistribution(): array
	{
		return $this->remember('application_status', function () {
			$totalApplications = AppliedJob::count();
			$eligible = BillingMeter::where('eligible', true)->count();
			$hired = $this->getTotalHired();
			$underReview = max($totalApplications - $eligible, 0);

			return [
				'labels' => ['Submitted', 'Under Review', 'Eligible', 'Hired', 'Rejected'],
				'data' => [
					$totalApplications,
					$underReview,
					$eligible,
					$hired,
					0,
				],
			];
		});
	}

	public function getTopCompaniesByJobs(int $limit = 5): array
	{
		return $this->remember('top_companies.' . $limit, function () use ($limit) {
			return Company::query()
				->withCount('jobs')
				->orderByDesc('jobs_count')
				->limit($limit)
				->get()
				->map(fn (Company $company) => [
					'id' => $company->id,
					'name' => $company->name ?? 'Unknown Company',
					'logo' => $company->logo,
					'jobs_count' => (int) $company->jobs_count,
				])
				->toArray();
		});
	}

	public function getRecentApplications(int $limit = 10): array
	{
		return $this->remember('recent_applications.' . $limit, function () use ($limit) {
			$applications = AppliedJob::query()
				->with(['job.company'])
				->latest('created_at')
				->limit($limit)
				->get();

			$candidateIds = $applications->pluck('candidate_id')->unique()->filter()->values();
			$candidates = Candidate::query()
				->whereIn('user_id', $candidateIds)
				->get()
				->keyBy('user_id');

			return $applications->map(function (AppliedJob $application) use ($candidates) {
				$candidate = $candidates->get($application->candidate_id);

				return [
					'candidate_name' => $candidate?->full_name ?? 'Unknown Candidate',
					'candidate_title' => $candidate?->title ?? 'N/A',
					'job_title' => $application->job?->title ?? 'N/A',
					'company_name' => $application->job?->company?->name ?? 'N/A',
					'status' => 'pending',
					'applied_at' => optional($application->created_at)->format('M d, Y'),
				];
			})->toArray();
		});
	}

	public function getRecentTransactions(int $limit = 10): array
	{
		return $this->remember('recent_transactions.' . $limit, function () use ($limit) {
			return Order::query()
				->with(['company', 'plan'])
				->latest('created_at')
				->limit($limit)
				->get()
				->map(function (Order $order) {
					return [
						'company_name' => $order->company->name ?? 'Unknown Company',
						'plan_name' => $order->plan->label ?? $order->package_name,
						'amount' => (float) $order->amount,
						'payment_provider' => $order->payment_provider,
						'paid_at' => optional($order->created_at)->format('M d, Y'),
					];
				})
				->toArray();
		});
	}

	public function getConversionMetrics(): array
	{
		return $this->remember('conversion_metrics', function () {
			$totalJobs = max(Job::count(), 1);
			$totalApplications = AppliedJob::count();
			$totalHired = $this->getTotalHired();

			$eligible = BillingMeter::where('eligible', true)->count();

			return [
				'avg_applications_per_job' => round($totalApplications / $totalJobs, 1),
				'hire_rate' => $totalApplications > 0 ? round(($totalHired / $totalApplications) * 100, 1) : 0.0,
				'total_hired' => $totalHired,
				'eligible_pipeline' => $eligible,
			];
		});
	}

	public function getMonthlyRevenueComparison(): array
	{
		return $this->remember('monthly_revenue', function () {
			$currentStart = Carbon::now()->startOfMonth();
			$currentEnd = Carbon::now()->endOfMonth();
			$previousStart = $currentStart->copy()->subMonth()->startOfMonth();
			$previousEnd = $currentStart->copy()->subMonth()->endOfMonth();

			$current = (float) Order::whereBetween('created_at', [$currentStart, $currentEnd])->sum('amount');
			$previous = (float) Order::whereBetween('created_at', [$previousStart, $previousEnd])->sum('amount');

			if ($previous > 0.0) {
				$growth = ($current - $previous) / $previous * 100;
			} else {
				$growth = $current > 0.0 ? 100.0 : 0.0;
			}

			return [
				'current_month' => $current,
				'previous_month' => $previous,
				'growth_percentage' => round($growth, 1),
			];
		});
	}

	public function getJobTypeDistribution(): array
	{
		return $this->remember('job_type_distribution', function () {
			$counts = Job::query()
				->selectRaw('job_type_id, COUNT(*) as total')
				->whereNotNull('job_type_id')
				->groupBy('job_type_id')
				->orderByDesc('total')
				->limit(10)
				->get();

			$typeNames = JobType::query()
				->whereIn('id', $counts->pluck('job_type_id'))
				->pluck('name', 'id');

			$labels = [];
			$data = [];

			foreach ($counts as $row) {
				$labels[] = $typeNames->get($row->job_type_id, 'Unknown');
				$data[] = (int) $row->total;
			}

			return [
				'labels' => $labels,
				'data' => $data,
			];
		});
	}

	public function getGeographicDistribution(): array
	{
		return $this->remember('geographic_distribution', function () {
			$counts = Job::query()
				->selectRaw('country_id, COUNT(*) as total')
				->whereNotNull('country_id')
				->groupBy('country_id')
				->orderByDesc('total')
				->limit(10)
				->get();

			$names = Country::query()
				->whereIn('id', $counts->pluck('country_id'))
				->pluck('name', 'id');

			$labels = [];
			$data = [];

			foreach ($counts as $row) {
				$labels[] = $names->get($row->country_id, 'Unknown');
				$data[] = (int) $row->total;
			}

			return [
				'labels' => $labels,
				'data' => $data,
			];
		});
	}

	public function getJobsOverTime(string $period = '30days'): array
	{
		return $this->remember('jobs_over_time.' . $period, function () use ($period) {
			[$start, $end, $groupFormat, $labelFormat, $interval] = $this->getPeriodConfig($period);

			$column = $interval === 'month' ? "DATE_FORMAT(created_at, '%Y-%m')" : 'DATE(created_at)';

			$records = Job::query()
				->selectRaw("{$column} as period, COUNT(*) as aggregate")
				->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
				->groupBy('period')
				->orderBy('period')
				->get()
				->pluck('aggregate', 'period')
				->map(fn ($value) => (int) $value)
				->toArray();

			return $this->buildTimeSeries($records, $start, $end, $groupFormat, $labelFormat, $interval);
		});
	}

	public function getApplicationsOverTime(string $period = '30days'): array
	{
		return $this->remember('applications_over_time.' . $period, function () use ($period) {
			[$start, $end, $groupFormat, $labelFormat, $interval] = $this->getPeriodConfig($period);

			$column = $interval === 'month' ? "DATE_FORMAT(created_at, '%Y-%m')" : 'DATE(created_at)';

			$records = AppliedJob::query()
				->selectRaw("{$column} as period, COUNT(*) as aggregate")
				->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
				->groupBy('period')
				->orderBy('period')
				->get()
				->pluck('aggregate', 'period')
				->map(fn ($value) => (int) $value)
				->toArray();

			return $this->buildTimeSeries($records, $start, $end, $groupFormat, $labelFormat, $interval);
		});
	}

	public function getRevenueOverTime(string $period = '30days'): array
	{
		return $this->remember('revenue_over_time.' . $period, function () use ($period) {
			[$start, $end, $groupFormat, $labelFormat, $interval] = $this->getPeriodConfig($period);

			$column = $interval === 'month' ? "DATE_FORMAT(created_at, '%Y-%m')" : 'DATE(created_at)';

			$records = Order::query()
				->selectRaw("{$column} as period, SUM(amount) as aggregate")
				->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
				->groupBy('period')
				->orderBy('period')
				->get()
				->pluck('aggregate', 'period')
				->map(fn ($value) => (float) $value)
				->toArray();

			return $this->buildTimeSeries($records, $start, $end, $groupFormat, $labelFormat, $interval, true);
		});
	}

	public function getUserRegistrationsOverTime(string $period = '30days'): array
	{
		return $this->remember('user_registrations_over_time.' . $period, function () use ($period) {
			[$start, $end, $groupFormat, $labelFormat, $interval] = $this->getPeriodConfig($period);

			$column = $interval === 'month' ? "DATE_FORMAT(created_at, '%Y-%m')" : 'DATE(created_at)';

			$records = User::query()
				->selectRaw("{$column} as period, COUNT(*) as aggregate")
				->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
				->groupBy('period')
				->orderBy('period')
				->get()
				->pluck('aggregate', 'period')
				->map(fn ($value) => (int) $value)
				->toArray();

			return $this->buildTimeSeries($records, $start, $end, $groupFormat, $labelFormat, $interval);
		});
	}

	private function remember(string $key, callable $callback)
	{
		if (self::CACHE_TTL <= 0) {
			return $callback();
		}

		return Cache::remember(self::CACHE_PREFIX . $key, self::CACHE_TTL, $callback);
	}

	/**
	 * @return (Carbon|string)[]
	 *
	 * @psalm-return list{Carbon, Carbon, 'Y-m'|'Y-m-d', 'M Y'|'M j', 'day'|'month'}
	 */
	private function getPeriodConfig(string $period): array
	{
		$today = Carbon::today();

		return match ($period) {
			'7days' => [$today->copy()->subDays(6), $today->copy(), 'Y-m-d', 'M j', 'day'],
			'90days' => [$today->copy()->subDays(89), $today->copy(), 'Y-m-d', 'M j', 'day'],
			'year' => [
				$today->copy()->startOfMonth()->subMonthsNoOverflow(11),
				$today->copy()->endOfMonth(),
				'Y-m',
				'M Y',
				'month',
			],
			default => [$today->copy()->subDays(29), $today->copy(), 'Y-m-d', 'M j', 'day'],
		};
	}

	/**
	 * @return (float|int|string)[][]
	 *
	 * @psalm-return array{labels: list{0?: string,...}, data: list{0?: float|int,...}}
	 */
	private function buildTimeSeries(array $records, Carbon $start, Carbon $end, string $groupFormat, string $labelFormat, string $interval, bool $asFloat = false): array
	{
		$labels = [];
		$data = [];
		$cursor = $start->copy();

		while ($cursor <= $end) {
			$key = $cursor->format($groupFormat);
			$labels[] = $cursor->format($labelFormat);

			$value = $records[$key] ?? 0;
			$data[] = $asFloat ? (float) $value : (int) $value;

			$cursor = $interval === 'month'
				? $cursor->addMonthNoOverflow()
				: $cursor->addDay();
		}

		return [
			'labels' => $labels,
			'data' => $data,
		];
	}

	private function getTotalHired(): int
	{
		return BillingCharge::where('status', BillingCharge::STATUS_INVOICED)->count();
	}
}


