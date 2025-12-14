<?php

namespace App\Jobs;

use App\Mail\DreamPathwayMatchMail;
use App\Models\CareerInterest;
use App\Services\Careers\CareerInterestMatchService;
use App\Support\InAppNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

final class WarmCandidateJobMatches implements ShouldQueue
{
	use Dispatchable;
	use InteractsWithQueue;
	use Queueable;
	use SerializesModels;

	public int $tries = 3;
	public int $timeout = 90;

	/**
	 * @param  array<int, array<string, mixed>>|null  $overrideMatches
	 */
	public function __construct(
		public int $careerInterestId,
		public ?int $limit = null,
		public ?array $overrideMatches = null
	) {
		$this->limit = $limit ?? (int) config('careers.scan_limit', 5);
		$this->onQueue(config('careers.matches_queue', 'career-matches'));
	}

	/**
	 * @param  array<int, array<string, mixed>>  $matches
	 */
	private function dispatchNotifications(CareerInterest $interest, array $matches): void
	{
		$payload = [
			'interest_id' => $interest->getKey(),
			'title' => $interest->title,
			'pathway_type' => $interest->pathway_type,
			'matches' => $matches,
			'cta_url' => route('careers.wishlist'),
		];

		if ($interest->notify_in_app) {
			InAppNotifier::notifyUser($interest->user_id, 'career_interest.match', $payload);
		}

		if ($interest->notify_email && $interest->user?->email) {
			Mail::to($interest->user->email)->queue(new DreamPathwayMatchMail($interest, $matches));
		}
	}
}


