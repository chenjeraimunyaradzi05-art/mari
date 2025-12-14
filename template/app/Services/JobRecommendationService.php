<?php

namespace App\Services;

use App\Models\AppliedJob;
use App\Models\Candidate;
use App\Models\Job;
use App\Models\JobRecommendationAudit;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

final class JobRecommendationService
{


	public function generateJobRecommendations(?int $candidateId, array $preferences = []): Collection
	{
		if (!$candidateId) {
			return collect();
		}

		$candidate = Candidate::with(['skills.skill', 'profession', 'experiences'])->find($candidateId);

		if (!$candidate) {
			return collect();
		}

		return $this->cacheService->getJobRecommendations($candidateId, function () use ($candidate, $preferences) {
			$jobs = $this->buildBaseQuery($candidate, $preferences)->limit(60)->get();

			$candidateSkills = $candidate->skills
				->map(fn ($skill) => Str::lower($skill->skill?->name ?? ''))
				->filter()
				->unique()
				->values()
				->all();

			$scored = $jobs->map(function (Job $job) use ($candidate, $candidateSkills) {
				$analysis = $this->scoreJob($candidate, $job, $candidateSkills);

				return [
					'job' => $job,
					'score' => $analysis['score'],
					'skill_matches' => $analysis['skill_matches'],
					'reasons' => $analysis['reasons'],
					'flags' => $analysis['flags'],
				];
			});

			$withContext = $this->applyContextualAdjustments($scored->sortByDesc('score')->values(), $candidate);
			$diversified = $this->diversifyMatches($withContext, 40);
			$this->logFairnessSnapshot($diversified, $candidate);

			return $diversified->values();
		});
	}

	/**
	 * @return (int|null|string)[]
	 *
	 * @psalm-return array{generated_at: string, active_jobs: int, candidate_matches: int, candidate_id: int|null}
	 */
	public function getRecommendationMetrics(?int $candidateId = null, ?Collection $matches = null): array
	{
		$activeJobsQuery = Job::query();

		if (Schema::hasColumn('jobs', 'status')) {
			$activeJobsQuery->where('status', 'active');
		}

		if (Schema::hasColumn('jobs', 'deadline')) {
			$activeJobsQuery->where(function (Builder $query) {
				$query->whereNull('deadline')->orWhere('deadline', '>=', Carbon::today()->toDateString());
			});
		}

		if (Schema::hasColumn('jobs', 'deleted_at')) {
			$activeJobsQuery->whereNull('deleted_at');
		}

		$activeJobs = $activeJobsQuery->count();

		$matchCount = $matches?->count();

		return [
			'generated_at' => Carbon::now()->toDateTimeString(),
			'active_jobs' => $activeJobs,
			'candidate_matches' => $matchCount ?? 0,
			'candidate_id' => $candidateId,
		];
	}

	/**
	 * @psalm-return Builder<Job>
	 */
	private function buildBaseQuery(Candidate $candidate, array $preferences): Builder
	{
		$query = Job::query()
			->with(['company', 'jobType', 'jobRole', 'jobExperience', 'skills.skill', 'country', 'state', 'city'])
			->orderByDesc('created_at');

		if (Schema::hasColumn('jobs', 'status')) {
			$query->where('status', 'active');
		}

		if (Schema::hasColumn('jobs', 'deleted_at')) {
			$query->whereNull('deleted_at');
		}

		if (Schema::hasColumn('jobs', 'deadline')) {
			$query->where(function (Builder $builder) {
				$builder->whereNull('deadline')->orWhere('deadline', '>=', Carbon::today()->toDateString());
			});
		}

		if ($candidate->job_category_id || $candidate->profession_id) {
			$query->where(function (Builder $builder) use ($candidate) {
				$hasCategoryClause = false;

				if ($candidate->job_category_id) {
					$builder->where('job_category_id', $candidate->job_category_id);
					$hasCategoryClause = true;
				}

				if ($candidate->profession_id) {
					if ($hasCategoryClause) {
						$builder->orWhere('job_role_id', $candidate->profession_id);
					} else {
						$builder->where('job_role_id', $candidate->profession_id);
					}
				}
			});
		}

		if (!empty($preferences['job_category_id'])) {
			$query->where('job_category_id', $preferences['job_category_id']);
		}

		if (!empty($preferences['job_type_id'])) {
			$query->where('job_type_id', $preferences['job_type_id']);
		}

		if (!empty($preferences['salary_min']) && Schema::hasColumn('jobs', 'min_salary')) {
			$query->where('min_salary', '>=', $preferences['salary_min']);
		}

		if (!empty($preferences['salary_max']) && Schema::hasColumn('jobs', 'max_salary')) {
			$query->where(function (Builder $builder) use ($preferences) {
				$builder->whereNull('max_salary')->orWhere('max_salary', '<=', $preferences['salary_max']);
			});
		}

		if (!empty($preferences['job_location'])) {
			$query->where(function (Builder $builder) use ($preferences) {
				$location = Str::lower($preferences['job_location']);
				$builder->whereRaw('LOWER(address) LIKE ?', ["%$location%"]);
			});
		}

		return $query;
	}

	/**
	 * @return ((bool|string)[]|float)[]
	 *
	 * @psalm-return array{score: float, skill_matches: array<int, string>, matched_skills: array<int, string>, missing_skills: array<int, string>, reasons: list{0?: string, 1?: string, 2?: string, 3?: 'Featured by the hiring company'|'Preferred location match'|'Recently posted opportunity', 4?: 'Featured by the hiring company'|'Recently posted opportunity', 5?: 'Featured by the hiring company'}, flags: array{is_new: bool, is_featured: bool, location_match: bool}}
	 */
	private function scoreJob(Candidate $candidate, Job $job, array $candidateSkills): array
	{
		$score = 30.0;
		$reasons = [];

		// Match by profession/job role
		if ($candidate->profession_id && $job->job_role_id && (int) $candidate->profession_id === (int) $job->job_role_id) {
			$score += 15;
			$reasons[] = 'Matches your profession focus';
		}

		// Experience alignment
		if ($candidate->experience_id && $job->job_experience_id) {
			if ((int) $candidate->experience_id >= (int) $job->job_experience_id) {
				$score += 10;
				$reasons[] = 'You meet the required experience level';
			} else {
				$score -= 5;
				$reasons[] = 'Experience level may be slightly lower than required';
			}
		}

		// Skill matching
		$jobSkills = $job->skills
			->map(fn ($skill) => Str::lower($skill->skill?->name ?? ''))
			->filter()
			->unique()
			->values()
			->all();

		$skillMatches = array_values(array_intersect($jobSkills, $candidateSkills));
		$missingSkills = array_values(array_diff($jobSkills, $candidateSkills));

		$formattedMatches = collect($skillMatches)
			->map(fn (string $skill) => Str::ucfirst($skill))
			->values()
			->all();

		$formattedMissing = collect($missingSkills)
			->map(fn (string $skill) => Str::ucfirst($skill))
			->values()
			->all();

		if ($skillMatches) {
			$skillScore = min(40, count($skillMatches) * 12);
			$score += $skillScore;
			$topMatches = collect($skillMatches)
				->map(fn (string $skill) => Str::ucfirst($skill))
				->take(4)
				->implode(', ');
			$reasons[] = 'Strong skill overlap: ' . $topMatches;
		}

		// Location affinity
		$locationScore = 0;
		if ($candidate->country && $job->country_id && (int) $candidate->country === (int) $job->country_id) {
			$locationScore += 10;
		}

		if ($candidate->state && $job->state_id && (int) $candidate->state === (int) $job->state_id) {
			$locationScore += 5;
		}

		if ($candidate->city && $job->city_id && (int) $candidate->city === (int) $job->city_id) {
			$locationScore += 5;
		}

		if ($locationScore > 0) {
			$score += $locationScore;
			$reasons[] = 'Preferred location match';
		}

		// Featured or fresh jobs get a small boost
		$isNew = $job->created_at ? $job->created_at->greaterThanOrEqualTo(Carbon::now()->subDays(7)) : false;
		if ($isNew) {
			$score += 5;
			$reasons[] = 'Recently posted opportunity';
		}

		if ($job->featured ?? false) {
			$score += 5;
			$reasons[] = 'Featured by the hiring company';
		}

		$normalizedScore = round(min(100, max(0, $score)), 1);

		return [
			'score' => $normalizedScore,
			'skill_matches' => $formattedMatches,
			'matched_skills' => $formattedMatches,
			'missing_skills' => $formattedMissing,
			'reasons' => $reasons,
			'flags' => [
				'is_new' => $isNew,
				'is_featured' => (bool) ($job->featured ?? false),
				'location_match' => $locationScore >= 10,
			],
		];
	}

	private function applyContextualAdjustments(Collection $matches, Candidate $candidate): Collection
	{
		if ($matches->isEmpty()) {
			return $matches;
		}

		$applications = AppliedJob::query()
			->whereIn('candidate_id', array_filter([$candidate->id, $candidate->user_id]))
			->pluck('job_id')
			->all();

		$appliedLookup = array_fill_keys($applications, true);
		$now = Carbon::now();

		return $matches->map(function (array $match) use ($appliedLookup, $now) {
			$job = $match['job'];
			$adjustments = [];
			$adjustedScore = $match['score'];

			if ($job->created_at) {
				$daysOld = max(0, $job->created_at->diffInDays($now));
				$recencyBoost = max(0, 10 - ($daysOld * 0.6));
				if ($recencyBoost > 0) {
					$adjustedScore += $recencyBoost;
					$adjustments['recency'] = round($recencyBoost, 2);
				}
			}

			if (isset($appliedLookup[$job->id])) {
				$adjustedScore -= 15;
				$adjustments['prior_application'] = -15;
			}

			$appCount = $job->applications_count ?? null;
			if (is_numeric($appCount)) {
				$popularityBoost = min(5, ($appCount / 50));
				if ($popularityBoost > 0) {
					$adjustedScore += $popularityBoost;
					$adjustments['popularity'] = round($popularityBoost, 2);
				}
			}

			if (!empty($job->is_urgent)) {
				$adjustedScore += 4;
				$adjustments['urgency'] = 4;
			}

			$match['score'] = round(min(100, max(0, $adjustedScore)), 1);
			$match['context_adjustments'] = $adjustments;

			return $match;
		})->sortByDesc('score')->values();
	}

	private function diversifyMatches(Collection $matches, int $limit): Collection
	{
		if ($matches->isEmpty()) {
			return $matches;
		}

		$lambda = 0.75;
		$selected = collect();
		$remaining = $matches->values();
		$target = min($limit, $remaining->count());

		while ($selected->count() < $target && $remaining->isNotEmpty()) {
			$bestKey = null;
			$bestScore = null;

			foreach ($remaining as $key => $candidateMatch) {
				$relevance = $candidateMatch['score'];
				$diversity = $this->calculateDiversityScore($candidateMatch, $selected);
				$mmrScore = ($lambda * $relevance) + ((1 - $lambda) * ($diversity * 100));

				if ($bestScore === null || $mmrScore > $bestScore) {
					$bestScore = $mmrScore;
					$bestKey = $key;
				}
			}

			if ($bestKey === null) {
				break;
			}

			$chosen = $remaining->get($bestKey);
			$chosen['mmr_score'] = round($bestScore, 2);
			$chosen['diversity_score'] = round($this->calculateDiversityScore($chosen, $selected), 3);
			$selected->push($chosen);
			$remaining = $remaining->reject(fn ($_, $idx) => $idx === $bestKey)->values();
		}

		return $selected;
	}

	private function calculateDiversityScore(array $match, Collection $selected): float
	{
		if ($selected->isEmpty()) {
			return 1.0;
		}

		$job = $match['job'];
		$components = [];

		$companyId = $job->company_id ?? $job->company?->id;
		if ($companyId) {
			$sameEmployer = $selected->filter(fn ($item) => ($item['job']->company_id ?? $item['job']->company?->id) === $companyId)->count();
			$components[] = max(0.0, 1 - ($sameEmployer / 3));
		}

		$roleId = $job->job_role_id;
		if ($roleId) {
			$sameRole = $selected->filter(fn ($item) => $item['job']->job_role_id === $roleId)->count();
			$components[] = max(0.0, 1 - ($sameRole / 5));
		}

		$locationKey = implode('-', array_filter([
			$job->country_id ?? $job->country?->id,
			$job->state_id ?? $job->state?->id,
			$job->city_id ?? $job->city?->id,
		]));

		if ($locationKey !== '') {
			$sameLocation = $selected->filter(function ($item) use ($locationKey) {
				$otherKey = implode('-', array_filter([
					$item['job']->country_id ?? $item['job']->country?->id,
					$item['job']->state_id ?? $item['job']->state?->id,
					$item['job']->city_id ?? $item['job']->city?->id,
				]));

				return $otherKey === $locationKey;
			})->count();
			$components[] = max(0.0, 1 - ($sameLocation / 4));
		}

		if (empty($components)) {
			return 1.0;
		}

		return array_sum($components) / count($components);
	}

	private function logFairnessSnapshot(Collection $matches, Candidate $candidate): void
	{
		if ($matches->isEmpty()) {
			return;
		}

		try {
			$total = $matches->count();
			$scores = $matches->pluck('score')->filter(fn ($value) => is_numeric($value));
			$averageScore = $scores->avg() ?? 0.0;
			$scoreVariance = $scores->isNotEmpty()
				? $scores->map(fn ($value) => pow($value - $averageScore, 2))->avg()
				: 0.0;

			$employers = $matches->map(fn ($match) => $match['job']->company_id ?? $match['job']->company?->id)->filter();
			$roles = $matches->map(fn ($match) => $match['job']->job_role_id)->filter();
			$locations = $matches->map(function ($match) {
				return implode('-', array_filter([
					$match['job']->country_id ?? $match['job']->country?->id,
					$match['job']->state_id ?? $match['job']->state?->id,
					$match['job']->city_id ?? $match['job']->city?->id,
				]));
			})->filter();

			$employerDiversity = $total > 0 ? round($employers->unique()->count() / $total, 4) : 0.0;
			$roleDiversity = $total > 0 ? round($roles->unique()->count() / $total, 4) : 0.0;
			$locationDiversity = $total > 0 ? round($locations->unique()->count() / $total, 4) : 0.0;

			JobRecommendationAudit::create([
				'candidate_id' => $candidate->id,
				'match_total' => $total,
				'employer_diversity' => $employerDiversity,
				'role_diversity' => $roleDiversity,
				'location_diversity' => $locationDiversity,
				'average_score' => round($averageScore, 2),
				'score_variance' => round($scoreVariance, 4),
				'recorded_at' => Carbon::now(),
				'payload' => [
					'job_ids' => $matches->pluck('job.id')->filter()->values()->take(50)->toArray(),
					'matches' => $matches->take(20)->map(function ($match) {
						return [
							'job_id' => $match['job']->id,
							'score' => $match['score'],
							'diversity_score' => $match['diversity_score'] ?? null,
							'mmr_score' => $match['mmr_score'] ?? null,
							'context_adjustments' => $match['context_adjustments'] ?? [],
						];
					})->values()->toArray(),
				],
			]);

			Log::info('job_recommendation.fairness_snapshot', [
				'candidate_id' => $candidate->id,
				'total_matches' => $total,
				'employer_diversity' => $employerDiversity,
				'role_diversity' => $roleDiversity,
				'location_diversity' => $locationDiversity,
				'average_score' => round($averageScore, 2),
			]);
		} catch (\Throwable $throwable) {
			Log::debug('job_recommendation.fairness_snapshot_failed', [
				'candidate_id' => $candidate->id ?? null,
				'message' => $throwable->getMessage(),
			]);
		}
	}
}


