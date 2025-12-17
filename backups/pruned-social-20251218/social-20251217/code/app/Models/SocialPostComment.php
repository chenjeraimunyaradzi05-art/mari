<?php

namespace App\Models;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int $user_id
 * @property int|null $social_profile_id
 * @property int|null $parent_id
 * @property string $content
 * @property array<array-key, mixed>|null $mentions
 * @property int|null likes_count
 * @property int|null replies_count
 * @property bool $is_pinned
 * @property array<array-key, mixed>|null $ai_sentiment
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property mixed $comment
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $likes
 * @property-read \App\Models\SocialComment|null $parent
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\SocialProfile|null $profile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialComment> $replies
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\SocialPostCommentFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereAiSentiment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereIsPinned($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereLikesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereMentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereParentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereRepliesCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostComment withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialPostComment extends SocialComment
{
}

