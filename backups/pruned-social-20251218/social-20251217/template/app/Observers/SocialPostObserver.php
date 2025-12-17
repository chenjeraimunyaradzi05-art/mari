<?php

namespace App\Observers;

use App\Events\Social\EngagementMetricUpdated;
use App\Models\SocialPost;
use App\Observers\Concerns\InteractsWithCounters;

final class SocialPostObserver
{
	use InteractsWithCounters;

	protected function syncPostCount(SocialPost $post, int $delta, string $channel): void
	{
		if ($delta !== 0 && ($profile = $this->resolveRelation($post, 'profile'))) {
			$this->adjustCounter($profile, 'posts_count', $delta);
		}

		event(new EngagementMetricUpdated(
			channel: $channel,
			subject: $post,
			meta: [
				'social_profile_id' => $post->social_profile_id,
				'user_id' => $post->user_id,
				'delta' => $delta,
			],
		));
	}
}

