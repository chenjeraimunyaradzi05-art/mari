<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\SocialProfile;
use App\Models\Job;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class CareerInsightsService
{


	public function generateInsights(Candidate $candidate): array
	{
		return $this->cacheService->getCareerInsights($candidate->id, function () use ($candidate) {
			$candidate->loadMissing(['skills.skill', 'experiences', 'educations', 'profession', 'user.socialProfile', 'socialProfile']);

			$experienceYears = $this->calculateExperienceYears($candidate);
			$skills = $candidate->skills
				->map(fn ($skill) => $skill->skill?->name)
				->filter()
				->unique()
				->values();

			$profileScore = (int) ($candidate->profile_score ?? $candidate->profile_completion ?? 0);
			$socialProfile = $this->resolveSocialProfile($candidate);
			$socialTrust = (int) ($socialProfile?->trust_score ?? 0);
			$lastEngagedAt = $socialProfile?->last_engaged_at;
			$latestActivity = $lastEngagedAt?->diffForHumans() ?? $candidate->updated_at?->diffForHumans();
			$recommendations = $this->recommendSkills($skills);
			$marketTrends = $this->marketSignals($candidate);

			return [
				'snapshot' => [
					'experience_years' => $experienceYears,
					'primary_profession' => $candidate->profession?->name,
					'skill_count' => $skills->count(),
					'profile_score' => $profileScore,
					'social_trust_score' => $socialTrust,
					'social_last_engaged' => $lastEngagedAt?->toDateTimeString(),
					'latest_activity' => $latestActivity,
				],
				'social_engagement' => $this->buildSocialEngagementSummary($socialProfile, $latestActivity, $socialTrust),
				'current_position' => $this->buildCurrentPosition($candidate, $experienceYears),
				'skill_analysis' => $this->buildSkillAnalysis($skills, $experienceYears),
				'career_progression' => $this->buildCareerProgression($candidate),
				'salary_insights' => $this->buildSalaryInsights($candidate),
				'learning_recommendations' => $this->buildLearningRecommendations($recommendations, $skills),
				'industry_trends' => $this->buildIndustryTrends($marketTrends),
				'next_opportunities' => $this->buildNextOpportunities($candidate),
				'strength_weakness' => $this->buildStrengthWeakness($skills, $recommendations),
				'growth_opportunities' => $this->recommendGrowthPaths($candidate, $experienceYears),
				'skill_recommendations' => $recommendations,
				'market_trends' => $marketTrends,
			];
		});
	}

	private function resolveSocialProfile(Candidate $candidate): ?SocialProfile
	{
		if ($candidate->relationLoaded('socialProfile') && $candidate->socialProfile) {
			return $candidate->socialProfile;
		}

		return $candidate->user?->socialProfile;
	}

	/**
	 * @return (int|mixed|null|string)[]
	 *
	 * @psalm-return array{status: string, message: string, latest_activity: null|string, trust_score: int, last_engaged_at?: mixed|null}
	 */
	private function buildSocialEngagementSummary(?SocialProfile $profile, ?string $latestActivity, int $trustScore): array
	{
		if (! $profile) {
			return [
				'status' => 'unlinked',
				'message' => 'Connect your social profile to unlock trust insights.',
				'latest_activity' => $latestActivity,
				'trust_score' => $trustScore,
			];
		}

		$lastEngagedAt = $profile->last_engaged_at;
		$now = Carbon::now();
		$engagementBucket = 'dormant';
		if ($lastEngagedAt && $lastEngagedAt->greaterThanOrEqualTo($now->copy()->subDays(30))) {
			$engagementBucket = 'warming';
		}
		if ($lastEngagedAt && $lastEngagedAt->greaterThanOrEqualTo($now->copy()->subDays(7))) {
			$engagementBucket = 'active';
		}

		return [
			'status' => $engagementBucket,
			'message' => match ($engagementBucket) {
				'active' => 'Great job staying active—your recent engagement boosts visibility.',
				'warming' => 'Rejoin the conversation this week to keep your profile at the top of feeds.',
				default => 'Post, follow, or react to re-engage your network and improve trust.',
			},
			'latest_activity' => $latestActivity,
			'trust_score' => $trustScore,
			'last_engaged_at' => $lastEngagedAt?->toDateTimeString(),
		];
	}

	private function calculateExperienceYears(Candidate $candidate): float
	{
		$months = $candidate->experiences
			->filter(fn ($experience) => $experience->start)
			->reduce(function (float $carry, $experience) {
				$start = Carbon::parse($experience->start);
				$end = $experience->currently_working ? Carbon::now() : ($experience->end ? Carbon::parse($experience->end) : Carbon::now());

				return $carry + (float) max(0, $start->diffInMonths($end));
			}, 0.0);

		return round($months / 12, 1);
	}

	/**
	 * @return string[][]
	 *
	 * @psalm-return list{0: array{title: string, description: string, confidence: 'high'|'medium'}, 1: array{title: 'Expand AI-powered capabilities'|'Explore mentorship opportunities'|'Strengthen core experience', description: 'Integrate AI-assisted workflows to improve productivity and stay competitive in emerging tech roles.'|'Lead internal initiatives or mentor junior teammates to unlock leadership-track opportunities.'|'Target mid-level roles that build end-to-end project ownership to accelerate your growth.', confidence: 'medium'}, 2?: array{title: 'Expand AI-powered capabilities', description: 'Integrate AI-assisted workflows to improve productivity and stay competitive in emerging tech roles.', confidence: 'medium'}}
	 */
	private function recommendGrowthPaths(Candidate $candidate, float $experienceYears): array
	{
		$paths = [];

		if ($candidate->profession?->name) {
			$paths[] = [
				'title' => 'Advance in ' . $candidate->profession->name,
				'description' => 'Focus on leadership responsibilities and stakeholder management to move towards senior ' . Str::lower($candidate->profession->name) . ' roles.',
				'confidence' => 'high',
			];
		}

		if ($experienceYears < 3) {
			$paths[] = [
				'title' => 'Strengthen core experience',
				'description' => 'Target mid-level roles that build end-to-end project ownership to accelerate your growth.',
				'confidence' => 'medium',
			];
		} else {
			$paths[] = [
				'title' => 'Explore mentorship opportunities',
				'description' => 'Lead internal initiatives or mentor junior teammates to unlock leadership-track opportunities.',
				'confidence' => 'medium',
			];
		}

		$paths[] = [
			'title' => 'Expand AI-powered capabilities',
			'description' => 'Integrate AI-assisted workflows to improve productivity and stay competitive in emerging tech roles.',
			'confidence' => 'medium',
		];

		return $paths;
	}

	/**
	 * @return (string|string[])[][]
	 *
	 * @psalm-return array<int, array{skill: string, reason: 'In-demand across the top 20% of roles similar to your profile.', tags: list{'trending', 'high-impact'}}>
	 */
	private function recommendSkills(Collection $existingSkills): array
	{
		$emergingSkills = collect(['Generative AI', 'Prompt Engineering', 'Data Storytelling', 'Cloud Security', 'Microservices']);

		return $emergingSkills
			->reject(fn (string $skill) => $existingSkills->contains(fn ($existing) => Str::lower($existing) === Str::lower($skill)))
			->map(fn (string $skill) => [
				'skill' => $skill,
				'reason' => 'In-demand across the top 20% of roles similar to your profile.',
				'tags' => ['trending', 'high-impact'],
			])
			->take(5)
			->values()
			->all();
	}

	/**
	 * @return (int|string)[]
	 *
	 * @psalm-return array{active_roles: int, featured_roles: int, trend_direction: 'rising'|'steady', insight: 'Demand is steady. Sharpen your profile narrative and refresh skills to stay competitive.'|'Premium listings are surging. Highlight leadership wins and apply within 48 hours of new matches.'}
	 */
	private function marketSignals(Candidate $candidate): array
	{
		$baseQuery = Job::query();

		if ($candidate->profession_id) {
			$baseQuery->where('job_role_id', $candidate->profession_id);
		}

		$activeCount = (clone $baseQuery)
			->where('status', 'active')
			->count();

		$featuredCount = (clone $baseQuery)
			->where('status', 'active')
			->where('featured', true)
			->count();

		$direction = $featuredCount > ($activeCount * 0.2) ? 'rising' : 'steady';
		$insight = $direction === 'rising'
			? 'Premium listings are surging. Highlight leadership wins and apply within 48 hours of new matches.'
			: 'Demand is steady. Sharpen your profile narrative and refresh skills to stay competitive.';

		return [
			'active_roles' => $activeCount,
			'featured_roles' => $featuredCount,
			'trend_direction' => $direction,
			'insight' => $insight,
		];
	}

	/**
	 * @return (float|null|string)[]
	 *
	 * @psalm-return array{current_role: string, current_company: null|string, tenure: null|string, total_experience: float, summary: string}
	 */
	private function buildCurrentPosition(Candidate $candidate, float $experienceYears): array
	{
		$experiences = $candidate->experiences
			->sortByDesc(function ($experience) {
				$end = $experience->currently_working
					? now()
					: ($experience->end ? Carbon::parse($experience->end) : ($experience->start ? Carbon::parse($experience->start) : null));

				return ($end?->timestamp ?? 0) + ($experience->currently_working ? 100000 : 0);
			});

		$current = $experiences->first();
		$role = $current?->designation ?? $candidate->profession?->name ?? 'Emerging talent';
		$company = $current?->company;
		$duration = null;

		if ($current && $current->start) {
			$start = Carbon::parse($current->start);
			$end = $current->currently_working ? null : ($current->end ? Carbon::parse($current->end) : null);
			$duration = $start->format('M Y') . ' - ' . ($current->currently_working ? 'Present' : ($end?->format('M Y') ?? 'Present'));
		}

		$summaryParts = array_filter([
			$role,
			$company ? 'at ' . $company : null,
			$experienceYears > 0 ? 'with ~' . $experienceYears . ' yrs total experience' : null,
		]);

		return [
			'current_role' => $role,
			'current_company' => $company,
			'tenure' => $duration,
			'total_experience' => round(max($experienceYears, 0), 1),
			'summary' => $summaryParts ? implode(' ', $summaryParts) : 'Add your most recent role to unlock deeper insights.',
		];
	}

	/**
	 * @return (int|string|string[])[]
	 *
	 * @psalm-return array{summary: string, top_skills: array<int, string>, coverage: int}
	 */
	private function buildSkillAnalysis(Collection $skills, float $experienceYears): array
	{
		if ($skills->isEmpty()) {
			return [
				'summary' => 'Add at least five technical and leadership skills so we can benchmark you against top performers.',
				'top_skills' => [],
				'coverage' => 0,
			];
		}

		$top = $skills->map(fn ($skill) => Str::title($skill))->values();
		$headline = $top->take(3)->implode(', ');
		$summary = sprintf(
			'Your profile signals strength in %s. Keep pairing these with measurable outcomes to elevate your story.',
			$headline
		);

		if ($experienceYears < 3) {
			$summary .= ' Highlight rapid wins to offset limited tenure.';
		}

		return [
			'summary' => $summary,
			'top_skills' => $top->take(10)->all(),
			'coverage' => $skills->count(),
		];
	}

	/**
	 * @return (string|string[][])[]
	 *
	 * @psalm-return array{summary: string, timeline: array<int, array{role: string, company: string, duration: string}>}
	 */
	private function buildCareerProgression(Candidate $candidate): array
	{
		$experiences = $candidate->experiences
			->filter(fn ($experience) => $experience->start)
			->sortBy(fn ($experience) => Carbon::parse($experience->start)->timestamp)
			->values();

		if ($experiences->isEmpty()) {
			return [
				'summary' => 'Add previous roles to unlock your progression timeline and identify leadership jumps.',
				'timeline' => [],
			];
		}

		$timeline = $experiences->map(function ($experience) {
			$start = Carbon::parse($experience->start)->format('M Y');
			$end = $experience->currently_working ? 'Present' : ($experience->end ? Carbon::parse($experience->end)->format('M Y') : 'Present');

			return [
				'role' => $experience->designation,
				'company' => $experience->company,
				'duration' => $start . ' - ' . $end,
			];
		});

		$first = $timeline->first();
		$current = $timeline->last();
		$summary = sprintf(
			'Progressed from %s (%s) to %s (%s). Position yourself for the next strategic jump.',
			$first['role'] ?? 'early career roles',
			$first['company'] ?? 'initial company',
			$current['role'] ?? 'current role',
			$current['company'] ?? 'current company'
		);

		return [
			'summary' => $summary,
			'timeline' => $timeline->all(),
		];
	}

	/**
	 * @return (int[]|null|string)[]
	 *
	 * @psalm-return array{summary: string, range: list{int, int}|null}
	 */
	private function buildSalaryInsights(Candidate $candidate): array
	{
		$query = Job::query()
			->where('status', 'active')
			->whereNotNull('min_salary')
			->whereNotNull('max_salary');

		if ($candidate->profession_id) {
			$query->where('job_role_id', $candidate->profession_id);
		} elseif ($candidate->job_category_id) {
			$query->where('job_category_id', $candidate->job_category_id);
		}

		$jobs = $query->limit(100)->get(['min_salary', 'max_salary', 'salary_type_id']);

		if ($jobs->isEmpty()) {
			return [
				'summary' => 'Add salary expectations to your profile; we will benchmark them against live roles automatically.',
				'range' => null,
			];
		}

		$avgMin = (int) round($jobs->avg('min_salary'));
		$avgMax = (int) round($jobs->avg('max_salary'));
		$summary = sprintf(
			'Employers hiring for similar profiles are offering approximately %s - %s (%s roles analysed).',
			$this->formatCurrency($avgMin),
			$this->formatCurrency($avgMax),
			$jobs->count()
		);

		return [
			'summary' => $summary,
			'range' => [$avgMin, $avgMax],
		];
	}

	/**
	 * @return (array|string)[]
	 *
	 * @psalm-return array{summary: string, suggestions: array}
	 */
	private function buildLearningRecommendations(array $recommendations, Collection $skills): array
	{
		if (empty($recommendations)) {
			return [
				'summary' => 'Great job keeping skills current. Revisit quarterly to stay aligned with market demand.',
				'suggestions' => [],
			];
		}

		$top = collect($recommendations)->take(3)->pluck('skill')->implode(', ');
		$summary = sprintf('Prioritise %s to stay ahead of peers and unlock premium matches.', $top);

		return [
			'summary' => $summary,
			'suggestions' => $recommendations,
		];
	}

	/**
	 * @return (int|mixed|string)[]
	 *
	 * @psalm-return array{summary: 'Stay active on the platform to capture new roles as they launch.'|mixed, active_roles: 0|mixed, featured_roles: 0|mixed, trend_direction: 'steady'|mixed}
	 */
	private function buildIndustryTrends(array $marketTrends): array
	{
		return [
			'summary' => $marketTrends['insight'] ?? 'Stay active on the platform to capture new roles as they launch.',
			'active_roles' => $marketTrends['active_roles'] ?? 0,
			'featured_roles' => $marketTrends['featured_roles'] ?? 0,
			'trend_direction' => $marketTrends['trend_direction'] ?? 'steady',
		];
	}

	/**
	 * @return (int|string)[]
	 *
	 * @psalm-return array{summary: string, count_last_30_days: int<min, max>}
	 */
	private function buildNextOpportunities(Candidate $candidate): array
	{
		$recentJobsQuery = Job::query()
			->where('status', 'active')
			->whereDate('created_at', '>=', now()->subDays(30));

		if ($candidate->profession_id) {
			$recentJobsQuery->where('job_role_id', $candidate->profession_id);
		} elseif ($candidate->job_category_id) {
			$recentJobsQuery->where('job_category_id', $candidate->job_category_id);
		}

		$recentCount = $recentJobsQuery->count();
		$highlight = $recentJobsQuery->orderByDesc('created_at')->limit(3)->pluck('title');

		$summaryParts = [];
		$summaryParts[] = $recentCount > 0
			? sprintf('%s matching roles published in the last 30 days.', $recentCount)
			: 'No fresh openings found in the last 30 days—broaden your preferences to uncover more matches.';

		if ($highlight->isNotEmpty()) {
			$summaryParts[] = 'Recent highlights: ' . $highlight->implode(', ');
		}

		return [
			'summary' => implode(' ', $summaryParts),
			'count_last_30_days' => $recentCount,
		];
	}

	/**
	 * @return (string|string[])[]
	 *
	 * @psalm-return array{summary: string, strengths: array<string>, gaps: array<string>}
	 */
	private function buildStrengthWeakness(Collection $skills, array $recommendations): array
	{
		$topStrengths = $skills->map(fn ($skill) => Str::title($skill))->take(5)->all();
		$gaps = collect($recommendations)->pluck('skill')->take(5)->map(fn ($skill) => Str::title($skill))->all();

		if (empty($topStrengths) && empty($gaps)) {
			return [
				'summary' => 'Add skills and certifications so we can spotlight your signature strengths.',
				'strengths' => [],
				'gaps' => [],
			];
		}

		$summary = '';
		if (! empty($topStrengths)) {
			$summary .= 'Strengths: ' . implode(', ', array_slice($topStrengths, 0, 3)) . '. ';
		}
		if (! empty($gaps)) {
			$summary .= 'Focus on ' . implode(', ', array_slice($gaps, 0, 3)) . ' to close high-impact gaps.';
		}

		return [
			'summary' => trim($summary),
			'strengths' => $topStrengths,
			'gaps' => $gaps,
		];
	}

	private function formatCurrency(int $value): string
	{
		if ($value >= 1000) {
			return '$' . number_format($value);
		}

		return '$' . $value;
	}
}


