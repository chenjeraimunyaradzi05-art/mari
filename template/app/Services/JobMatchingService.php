<?php

namespace App\Services;

use App\Models\Candidate;
use Illuminate\Support\Collection;

final class JobMatchingService
{


	/**
	 * @psalm-return Collection<int, mixed>
	 */
	public function findMatchingJobs(Candidate $candidate, int $limit = 5, float $minimumScore = 50.0): Collection
	{
		$recommendations = $this->jobRecommendationService
			->generateJobRecommendations($candidate->id)
			->filter(fn (array $match) => ($match['score'] ?? 0) >= $minimumScore)
			->take($limit)
			->values();

		return $recommendations;
	}
}


