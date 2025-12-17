<?php

namespace App\Observers;

use App\Events\Social\EngagementMetricUpdated;
use App\Models\SocialFollow;
use App\Observers\Concerns\InteractsWithCounters;

final class SocialFollowObserver
{
	use InteractsWithCounters;

	protected function adjustCounters(SocialFollow $follow, int $delta, string $channel): void
	{
		if ($delta === 0) {
			return;
		}

		if ($follower = $this->resolveRelation($follow, 'follower')) {
			$this->adjustCounter($follower, 'following_count', $delta);
		}

		if ($following = $this->resolveRelation($follow, 'following')) {
			$this->adjustCounter($following, 'followers_count', $delta);
		}

		event(new EngagementMetricUpdated(
			channel: $channel,
			subject: $follow,
			meta: [
				'follower_id' => $follow->follower_id,
				'following_id' => $follow->following_id,
				'delta' => $delta,
			],
		));
	}
}

