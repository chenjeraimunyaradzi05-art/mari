<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\City;
use App\Models\Company;
use App\Models\Experience;
use App\Models\Job;
use App\Models\JobExperience;
use App\Models\JobType;
use App\Models\IndustryType;
use App\Models\Skill;
use App\Models\TeamSize;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AdvancedSearchService
{
	public function searchJobs(array $filters = []): LengthAwarePaginator
	{
		if (! $this->tableAvailable('jobs')) {
			return $this->fakePaginator($this->fakeJobResults(), $filters);
		}

		$query = Job::query()->with(['company', 'jobType', 'city']);

		if ($keyword = $this->stringFilter($filters, 'search')) {
			$query->where(function (Builder $builder) use ($keyword) {
				$builder->where('title', 'like', "%{$keyword}%")
					->orWhere('company_name', 'like', "%{$keyword}%");
			});
		}

		if ($categories = $this->arrayFilter($filters, 'job_categories')) {
			$query->whereIn('job_category_id', $categories);
		}

		if ($jobTypes = $this->arrayFilter($filters, 'job_types')) {
			$query->whereIn('job_type_id', $jobTypes);
		}

		if ($locations = $this->arrayFilter($filters, 'locations')) {
			$query->whereIn('city_id', $locations);
		} elseif ($location = $this->stringFilter($filters, 'location')) {
			$query->whereHas('city', function (Builder $builder) use ($location) {
				$builder->where('name', 'like', "%{$location}%");
			});
		}

		if ($minSalary = data_get($filters, 'min_salary')) {
			$query->where(fn (Builder $builder) => $builder->where('min_salary', '>=', $minSalary));
		}

		if ($maxSalary = data_get($filters, 'max_salary')) {
			$query->where(fn (Builder $builder) => $builder->where('max_salary', '<=', $maxSalary));
		}

		$query->orderByDesc('highlight')->orderByDesc('created_at');

		return $this->transformPaginator(
			$query->paginate($this->perPage($filters))->appends($filters),
			fn (Job $job) => [
				'id' => $job->id,
				'title' => $job->title,
				'subtitle' => $job->company_name ?? optional($job->company)->name ?? 'Confidential company',
				'summary' => $this->summarise($job->description),
				'highlights' => array_values(array_filter([
					optional($job->jobType)->name,
					optional($job->city)->name,
					$this->formatSalaryRange($job->min_salary, $job->max_salary, $job->custom_salary),
				])),
			]
		);
	}

	public function searchCandidates(array $filters = []): LengthAwarePaginator
	{
		if (! $this->tableAvailable('candidates')) {
			return $this->fakePaginator($this->fakeCandidateResults(), $filters);
		}

		$query = Candidate::query()->with(['profession', 'candidateCity', 'experience']);

		if ($keyword = $this->stringFilter($filters, 'search')) {
			$query->where(function (Builder $builder) use ($keyword) {
				$builder->where('full_name', 'like', "%{$keyword}%")
					->orWhere('title', 'like', "%{$keyword}%")
					->orWhere('bio', 'like', "%{$keyword}%");
			});
		}

		if ($skills = $this->arrayFilter($filters, 'skills')) {
			$query->whereHas('skills', function (Builder $builder) use ($skills) {
				$builder->whereIn('skill_id', $skills);
			});
		}

		if ($experience = $this->arrayFilter($filters, 'experience_levels')) {
			$query->whereIn('experience_id', $experience);
		}

		if ($locations = $this->arrayFilter($filters, 'locations')) {
			$query->whereIn('city', $locations);
		}

		$query->orderByDesc('updated_at');

		return $this->transformPaginator(
			$query->paginate($this->perPage($filters))->appends($filters),
			function (Candidate $candidate) {
				return [
					'id' => $candidate->id,
					'title' => $candidate->full_name ?? 'Candidate #'.$candidate->id,
					'subtitle' => $candidate->title ?? optional($candidate->profession)->name ?? 'Candidate profile',
					'summary' => $this->summarise($candidate->bio),
					'highlights' => array_values(array_filter([
						optional($candidate->candidateCity)->name,
						optional($candidate->experience)->name,
						$candidate->profile_complete ? $candidate->profile_complete.'% profile' : null,
					])),
				];
			}
		);
	}

	public function searchCompanies(array $filters = []): LengthAwarePaginator
	{
		if (! $this->tableAvailable('companies')) {
			return $this->fakePaginator($this->fakeCompanyResults(), $filters);
		}

		$query = Company::query()->with(['industryType', 'teamSize', 'companyCity']);

		if ($keyword = $this->stringFilter($filters, 'search')) {
			$query->where(function (Builder $builder) use ($keyword) {
				$builder->where('name', 'like', "%{$keyword}%")
					->orWhere('bio', 'like', "%{$keyword}%")
					->orWhere('vision', 'like', "%{$keyword}%");
			});
		}

		if ($industries = $this->arrayFilter($filters, 'industries')) {
			$query->whereIn('industry_type_id', $industries);
		}

		if ($teamSizes = $this->arrayFilter($filters, 'team_sizes')) {
			$query->whereIn('team_size_id', $teamSizes);
		}

		if ($locations = $this->arrayFilter($filters, 'locations')) {
			$query->whereIn('city', $locations);
		}

		$query->orderByDesc('updated_at');

		return $this->transformPaginator(
			$query->paginate($this->perPage($filters))->appends($filters),
			function (Company $company) {
				return [
					'id' => $company->id,
					'title' => $company->name ?? 'Company #'.$company->id,
					'subtitle' => optional($company->industryType)->name ?? 'Private Company',
					'summary' => $this->summarise($company->bio),
					'highlights' => array_values(array_filter([
						optional($company->companyCity)->name,
						optional($company->teamSize)->name,
						$company->website,
					])),
				];
			}
		);
	}

	public function getFacets(string $type, array $filters = []): array
	{
		return match ($type) {
			'candidates' => $this->candidateFacets(),
			'companies' => $this->companyFacets(),
			default => $this->jobFacets(),
		};
	}

	public function getAutocompleteSuggestions(string $type, string $term, int $limit = 10): array
	{
		if ($this->tableAvailable('search_suggestions')) {
			return DB::table('search_suggestions')
				->where('suggestion_type', $type)
				->where('term', 'like', $term.'%')
				->orderByDesc('popularity')
				->limit($limit)
				->pluck('term')
				->toArray();
		}

		$pool = match ($type) {
			'skills' => ['Product strategy', 'Data storytelling', 'Cloud governance', 'Stakeholder engagement'],
			'locations' => ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
			default => ['AI product manager', 'Customer success lead', 'Partnerships lead', 'Platform engineer'],
		};

		return collect($pool)
			->filter(fn ($suggestion) => Str::contains(Str::lower($suggestion), Str::lower($term)))
			->take($limit)
			->values()
			->toArray();
	}

	public function trackSearch(?int $userId, string $query, string $type, int $resultsCount): void
	{
		if (! $this->tableAvailable('search_history')) {
			return;
		}

		DB::table('search_history')->insert([
			'user_id' => $userId,
			'query' => $query,
			'search_type' => $type,
			'results_count' => $resultsCount,
			'filters' => json_encode([]),
			'ip_address' => request()->ip(),
			'user_agent' => request()->userAgent(),
			'created_at' => now(),
		]);
	}

	public function saveSearch(int $userId, string $userType, array $filters, string $name): void
	{
		if (! $this->tableAvailable('saved_searches')) {
			return;
		}

		DB::table('saved_searches')->insert([
			'user_id' => $userId,
			'user_type' => $userType,
			'name' => $name,
			'search_type' => $filters['type'] ?? 'jobs',
			'filters' => json_encode($filters),
			'alert_frequency' => null,
			'created_at' => now(),
			'updated_at' => now(),
		]);
	}

	/**
	 * @psalm-return Collection<int, array{id: mixed, name: mixed, type: mixed, filters: array<never, never>|mixed, created_at: Carbon|null}>|Collection<never, never>
	 */
	public function getSavedSearches(int $userId, string $userType): Collection
	{
		if (! $this->tableAvailable('saved_searches')) {
			return collect();
		}

		return DB::table('saved_searches')
			->where('user_id', $userId)
			->where('user_type', $userType)
			->orderByDesc('created_at')
			->get()
			->map(fn ($row) => [
				'id' => $row->id,
				'name' => $row->name,
				'type' => $row->search_type,
				'filters' => json_decode($row->filters, true) ?? [],
				'created_at' => $row->created_at ? Carbon::parse($row->created_at) : null,
			]);
	}

	public function deleteSavedSearch(int $id, int $userId): void
	{
		if (! $this->tableAvailable('saved_searches')) {
			return;
		}

		DB::table('saved_searches')
			->where('id', $id)
			->where('user_id', $userId)
			->delete();
	}

	/**
	 * @psalm-return Collection<int, \stdClass>|Collection<never, never>
	 */
	public function getSearchHistory(int $userId, int $limit = 10): Collection
	{
		if (! $this->tableAvailable('search_history')) {
			return collect();
		}

		return DB::table('search_history')
			->where('user_id', $userId)
			->orderByDesc('created_at')
			->limit($limit)
			->get();
	}

	public function getPopularSearches(string $type, int $limit = 10): Collection
	{
		if (! $this->tableAvailable('search_history')) {
			return collect($this->fakePopularSearches($type));
		}

		return DB::table('search_history')
			->select('query', DB::raw('count(*) as total'))
			->where('search_type', $type)
			->groupBy('query')
			->orderByDesc('total')
			->limit($limit)
			->get();
	}

	protected function jobFacets(): array
	{
		if (! $this->tableAvailable('jobs')) {
			return $this->fallbackFacets('jobs');
		}

		return [
			'job_type' => $this->aggregateFacet('jobs', 'job_type_id', fn (array $ids) => $this->labelMap(JobType::class, $ids)),
			'experience' => $this->aggregateFacet('jobs', 'job_experience_id', fn (array $ids) => $this->labelMap(JobExperience::class, $ids)),
			'location' => $this->aggregateFacet('jobs', 'city_id', fn (array $ids) => $this->labelMap(City::class, $ids)),
		];
	}

	protected function candidateFacets(): array
	{
		if (! $this->tableAvailable('candidates')) {
			return $this->fallbackFacets('candidates');
		}

		return [
			'experience' => $this->aggregateFacet('candidates', 'experience_id', fn (array $ids) => $this->labelMap(Experience::class, $ids)),
			'location' => $this->aggregateFacet('candidates', 'city', fn (array $ids) => $this->labelMap(City::class, $ids)),
			'skills' => $this->aggregatePivotFacet('candidate_skills', 'skill_id', fn (array $ids) => $this->labelMap(Skill::class, $ids)),
		];
	}

	protected function companyFacets(): array
	{
		if (! $this->tableAvailable('companies')) {
			return $this->fallbackFacets('companies');
		}

		return [
			'industry' => $this->aggregateFacet('companies', 'industry_type_id', fn (array $ids) => $this->labelMap(IndustryType::class, $ids)),
			'team_size' => $this->aggregateFacet('companies', 'team_size_id', fn (array $ids) => $this->labelMap(TeamSize::class, $ids)),
			'location' => $this->aggregateFacet('companies', 'city', fn (array $ids) => $this->labelMap(City::class, $ids)),
		];
	}

	protected function aggregateFacet(string $table, string $column, callable $labelResolver, int $limit = 6): array
	{
		if (! $this->tableAvailable($table)) {
			return [];
		}

		$rows = DB::table($table)
			->select($column, DB::raw('count(*) as aggregate'))
			->whereNotNull($column)
			->groupBy($column)
			->orderByDesc('aggregate')
			->take($limit)
			->get();

		$ids = $rows->pluck($column)->filter()->values()->all();
		$labels = $labelResolver($ids);

		return $rows->mapWithKeys(function ($row) use ($column, $labels) {
			$id = $row->{$column};
			$label = $labels[$id] ?? "ID {$id}";
			return [$label => (int) $row->aggregate];
		})->toArray();
	}

	protected function aggregatePivotFacet(string $table, string $column, callable $labelResolver, int $limit = 6): array
	{
		if (! $this->tableAvailable($table)) {
			return [];
		}

		$rows = DB::table($table)
			->select($column, DB::raw('count(*) as aggregate'))
			->whereNotNull($column)
			->groupBy($column)
			->orderByDesc('aggregate')
			->take($limit)
			->get();

		$ids = $rows->pluck($column)->filter()->values()->all();
		$labels = $labelResolver($ids);

		return $rows->mapWithKeys(function ($row) use ($column, $labels) {
			$id = $row->{$column};
			$label = $labels[$id] ?? "ID {$id}";
			return [$label => (int) $row->aggregate];
		})->toArray();
	}

	protected function labelMap(string $modelClass, array $ids): array
	{
		if (empty($ids)) {
			return [];
		}

		/** @var \Illuminate\Database\Eloquent\Model $modelClass */
		return $modelClass::whereIn('id', $ids)->pluck('name', 'id')->all();
	}

	protected function tableAvailable(string $table): bool
	{
		static $cache = [];

		if (array_key_exists($table, $cache)) {
			return $cache[$table];
		}

		return $cache[$table] = Schema::hasTable($table);
	}

	/**
	 * @psalm-return int<5, 50>
	 */
	protected function perPage(array $filters): int
	{
		$perPage = (int) ($filters['per_page'] ?? 12);

		return min(max($perPage, 5), 50);
	}

	protected function stringFilter(array $filters, string $key): string|null
	{
		$value = trim((string) ($filters[$key] ?? ''));

		return $value !== '' ? $value : null;
	}

	/**
	 * @psalm-return list<mixed>
	 */
	protected function arrayFilter(array $filters, string $key): array
	{
		$value = $filters[$key] ?? [];
		$value = is_string($value) ? explode(',', $value) : $value;

		return array_values(array_filter((array) $value, fn ($item) => $item !== '' && $item !== null));
	}

	protected function transformPaginator(LengthAwarePaginator $paginator, callable $callback): LengthAwarePaginator
	{
		$paginator->setCollection($paginator->getCollection()->map($callback));

		return $paginator;
	}

	protected function summarise(?string $value): string
	{
		return $value ? Str::limit(strip_tags($value), 220) : 'Details will appear once the underlying service returns data.';
	}

	protected function formatSalaryRange(float|null $min, float|null $max, ?string $custom): string|null
	{
		if ($custom) {
			return $custom;
		}

		if ($min && $max) {
			return sprintf('AU$%s - AU$%s', number_format($min), number_format($max));
		}

		if ($min) {
			return sprintf('From AU$%s', number_format($min));
		}

		if ($max) {
			return sprintf('Up to AU$%s', number_format($max));
		}

		return null;
	}

	/**
	 * @psalm-return LengthAwarePaginator<int, mixed>
	 */
	protected function fakePaginator(Collection $items, array $filters): LengthAwarePaginator
	{
		$perPage = $this->perPage($filters);
		$page = (int) max($filters['page'] ?? LengthAwarePaginator::resolveCurrentPage(), 1);
		$slice = $items->forPage($page, $perPage)->values();

		return new LengthAwarePaginator(
			$slice,
			$items->count(),
			$perPage,
			$page,
			['path' => request()->url() ?: url()->current(), 'query' => request()->query()]
		);
	}

	/**
	 * @psalm-return Collection<int<0, 2>, array{title: 'AI Product Manager'|'People Experience Lead'|'Senior Platform Engineer', subtitle: 'Atlas Platforms • Brisbane'|'Aurora Labs • Sydney'|'CivicLab • Melbourne', summary: 'Design community-driven onboarding journeys for national service hiring pilots.'|'Scale our event-driven pipeline powering workforce intelligence dashboards.'|'Shape the Athena AI roadmap with product squads focused on equitable hiring experiences.', highlights: list{'Contract'|'Full-time', 'Hybrid'|'Kubernetes'|'Remote friendly', 'AU$180k base'|'Equity plan'|'Impact team'}}>
	 */
	protected function fakeJobResults(): Collection
	{
		return collect([
			[
				'title' => 'AI Product Manager',
				'subtitle' => 'Aurora Labs • Sydney',
				'summary' => 'Shape the Athena AI roadmap with product squads focused on equitable hiring experiences.',
				'highlights' => ['Full-time', 'Hybrid', 'AU$180k base'],
			],
			[
				'title' => 'People Experience Lead',
				'subtitle' => 'CivicLab • Melbourne',
				'summary' => 'Design community-driven onboarding journeys for national service hiring pilots.',
				'highlights' => ['Contract', 'Remote friendly', 'Impact team'],
			],
			[
				'title' => 'Senior Platform Engineer',
				'subtitle' => 'Atlas Platforms • Brisbane',
				'summary' => 'Scale our event-driven pipeline powering workforce intelligence dashboards.',
				'highlights' => ['Full-time', 'Kubernetes', 'Equity plan'],
			],
		]);
	}

	/**
	 * @psalm-return Collection<int<0, 1>, array{title: 'Noah Kelly'|'Priya Raman', subtitle: 'AI Strategy Leader'|'Growth PM', summary: 'Led responsible AI initiatives for workforce planning platforms across APAC.'|'Scaled marketplace onboarding engines for two ASX-listed companies.', highlights: list{'Melbourne'|'Sydney', '12 years experience'|'Product', 'Bilingual'|'Security cleared'}}>
	 */
	protected function fakeCandidateResults(): Collection
	{
		return collect([
			[
				'title' => 'Priya Raman',
				'subtitle' => 'AI Strategy Leader',
				'summary' => 'Led responsible AI initiatives for workforce planning platforms across APAC.',
				'highlights' => ['Melbourne', '12 years experience', 'Security cleared'],
			],
			[
				'title' => 'Noah Kelly',
				'subtitle' => 'Growth PM',
				'summary' => 'Scaled marketplace onboarding engines for two ASX-listed companies.',
				'highlights' => ['Sydney', 'Product', 'Bilingual'],
			],
		]);
	}

	/**
	 * @psalm-return Collection<int<0, 1>, array{title: 'CivicWorks Studio'|'Northstar Careers', subtitle: 'GovTech Lab'|'Human services', summary: 'Delivers wrap-around support for multi-state apprenticeship programs.'|'Partners with local councils to build last-mile workforce services.', highlights: list{'Adelaide'|'Sydney', '100-250 employees'|'50-100 employees', 'Public benefit company'|'Series B'}}>
	 */
	protected function fakeCompanyResults(): Collection
	{
		return collect([
			[
				'title' => 'CivicWorks Studio',
				'subtitle' => 'GovTech Lab',
				'summary' => 'Partners with local councils to build last-mile workforce services.',
				'highlights' => ['Sydney', '50-100 employees', 'Series B'],
			],
			[
				'title' => 'Northstar Careers',
				'subtitle' => 'Human services',
				'summary' => 'Delivers wrap-around support for multi-state apprenticeship programs.',
				'highlights' => ['Adelaide', '100-250 employees', 'Public benefit company'],
			],
		]);
	}

	/**
	 * @return (int|string)[][]
	 *
	 * @psalm-return list{0: array{query: 'ai policy lead'|'product designer'|'social impact', total: 28|42|67}, 1?: array{query: 'community manager'|'service delivery lead', total: 31|48}}
	 */
	protected function fakePopularSearches(string $type): array
	{
		return match ($type) {
			'candidates' => [
				['query' => 'product designer', 'total' => 42],
				['query' => 'service delivery lead', 'total' => 31],
			],
			'companies' => [
				['query' => 'social impact', 'total' => 28],
			],
			default => [
				['query' => 'ai policy lead', 'total' => 67],
				['query' => 'community manager', 'total' => 48],
			],
		};
	}

	/**
	 * @return int[][]
	 *
	 * @psalm-return array{experience?: array{Senior: 48|62, 'Mid-level'?: 36, 'Early career'?: 14, Mid?: 55, Entry?: 18}, location: array{Sydney: 14|28|50, Melbourne?: 22|33, Perth?: 6, Remote?: 24}, skills?: array{'Product strategy': 32, 'Data storytelling': 21}, industry?: array{GovTech: 18, Education: 12}, team_size?: array{'11-50': 20, '51-200': 8}, job_type?: array{'Full-time': 120, 'Part-time': 48, Contract: 26}}
	 */
	protected function fallbackFacets(string $type): array
	{
		return match ($type) {
			'candidates' => [
				'experience' => ['Senior' => 48, 'Mid-level' => 36, 'Early career' => 14],
				'location' => ['Sydney' => 28, 'Melbourne' => 22],
				'skills' => ['Product strategy' => 32, 'Data storytelling' => 21],
			],
			'companies' => [
				'industry' => ['GovTech' => 18, 'Education' => 12],
				'team_size' => ['11-50' => 20, '51-200' => 8],
				'location' => ['Sydney' => 14, 'Perth' => 6],
			],
			default => [
				'job_type' => ['Full-time' => 120, 'Part-time' => 48, 'Contract' => 26],
				'experience' => ['Senior' => 62, 'Mid' => 55, 'Entry' => 18],
				'location' => ['Sydney' => 50, 'Melbourne' => 33, 'Remote' => 24],
			],
		};
	}
}


