<?php

namespace App\Observers;

use App\Events\Social\EngagementMetricUpdated;
use App\Models\SocialComment;
use App\Observers\Concerns\InteractsWithCounters;

final class SocialPostCommentObserver
{
	use InteractsWithCounters;

	protected function syncCommentCounters(SocialComment $comment, int $delta, string $channel): void
	{
		if ($delta === 0) {
			return;
		}

		if ($post = $this->resolveRelation($comment, 'post')) {
			$this->adjustCounter($post, 'comments_count', $delta);
		}

		if ($comment->parent_id && ($parent = $this->resolveRelation($comment, 'parent'))) {
			$this->adjustCounter($parent, 'replies_count', $delta);
		}

		event(new EngagementMetricUpdated(
			channel: $channel,
			subject: $comment,
			meta: [
				'social_post_id' => $comment->social_post_id,
				'parent_id' => $comment->parent_id,
				'delta' => $delta,
			],
		));
	}
}

