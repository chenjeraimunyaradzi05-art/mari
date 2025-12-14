<?php

namespace App\Observers;

use App\Events\Social\EngagementMetricUpdated;
use App\Models\SocialComment;
use App\Models\SocialPost;
use App\Models\SocialPostReaction;
use App\Observers\Concerns\InteractsWithCounters;

final class SocialPostReactionObserver
{
	use InteractsWithCounters;

	protected function syncLikeable(SocialPostReaction $reaction, int $delta, string $channel): void
	{
		if ($delta === 0) {
			return;
		}

		$likeable = $reaction->likeable;

		if ($likeable instanceof SocialPost || $likeable instanceof SocialComment) {
			$this->adjustCounter($likeable, 'likes_count', $delta);
		} else {
			return;
		}

		event(new EngagementMetricUpdated(
			channel: $channel,
			subject: $reaction,
			meta: [
				'likeable_type' => $reaction->likeable_type,
				'likeable_id' => $reaction->likeable_id,
				'social_profile_id' => $reaction->social_profile_id,
				'delta' => $delta,
			],
		));
	}
}

