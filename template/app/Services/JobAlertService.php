<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\CandidateJobAlert;
use App\Models\Job;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class JobAlertService
{
	/**
	 * @psalm-return Collection<int, array{name: string, keywords: list{0: string, 1?: 'flexible'|'innovation'}, frequency: 'daily'|'weekly', locations: list{0: string, 1?: 'Melbourne'|'Remote', 2?: 'Remote'}, match_threshold: 60|65|70}>
	 */
	public function suggestAlerts(Candidate $candidate, int $limit = 3): Collection
	{
		$anchor = $candidate->dream_job ?? $candidate->title ?? 'career opportunity';
		$location = optional($candidate->candidateCity)->name ?? 'Remote friendly';

		$suggestions = collect([
			[
				'name' => "{$anchor} roles",
				'keywords' => [$anchor],
				'frequency' => 'daily',
				'locations' => [$location],
				'match_threshold' => 70,
			],
			[
				'name' => 'Leadership roles with flexible work',
				'keywords' => ['leadership', 'flexible'],
				'frequency' => 'weekly',
				'locations' => [$location, 'Remote'],
				'match_threshold' => 60,
			],
			[
				'name' => 'High-impact civic innovation teams',
				'keywords' => ['civic', 'innovation'],
				'frequency' => 'daily',
				'locations' => ['Sydney', 'Melbourne', 'Remote'],
				'match_threshold' => 65,
			],
		]);

		return $suggestions->take($limit)->values();
	}

	/**
	 * @return (\Illuminate\Support\Carbon|float|int|null)[]
	 *
	 * @psalm-return array{deliveries: int, clicks: int, applications: int, last_sent_at: \Illuminate\Support\Carbon|null, engagement_rate: float, conversion_rate: float}
	 */
	public function getAlertStats(CandidateJobAlert $alert): array
	{
		$logs = $alert->logs()->latest()->take(25)->get();

		return [
			'deliveries' => $logs->count(),
			'clicks' => $logs->where('status', 'clicked')->count(),
			'applications' => $logs->where('status', 'applied')->count(),
			'last_sent_at' => $alert->last_sent_at,
			'engagement_rate' => $alert->getEngagementRate(),
			'conversion_rate' => $alert->getConversionRate(),
		];
	}

	public function learnFromInteraction(?CandidateJobAlert $alert, ?Job $job, string $signal): void
	{
		if (! $alert) {
			return;
		}

		if ($signal === 'click') {
			$alert->increment('clicks_count');
		}

		if ($signal === 'apply') {
			$alert->increment('applications_count');
		}

		if ($job) {
			$keywords = collect($alert->keywords ?? [])
				->push(Str::lower($job->title))
				->unique()
				->values();

			$alert->forceFill(['keywords' => $keywords->all()])->save();
		}
	}
}


