<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int|null $social_profile_id
 * @property int $user_id
 * @property string $reaction
 * @property \Illuminate\Support\Carbon $liked_at
 * @property string|null $created_at
 * @property string|null $updated_at
 * @property string|null $likeable_type
 * @property int|null $likeable_id
 * @property-read \Illuminate\Database\Eloquent\Model|\Eloquent|null $likeable
 * @property-read \App\Models\SocialPost|null $post
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\SocialPostReactionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereLikeableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereLikeableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereLikedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereReaction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReaction whereUpdatedAt($value)
 * @method static \Illuminate\Database\\Eloquent\Builder<static>|SocialPostReaction whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialPostReaction extends SocialLike
{
	#[\Override]
	public function post(): BelongsTo
	{
		return $this->belongsTo(SocialPost::class, 'likeable_id')
			->where('likeable_type', SocialPost::class);
	}
}

