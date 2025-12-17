<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_poll_id
 * @property int $poll_option_id
 * @property int $social_profile_id
 * @property float $vote_weight
 * @property float $trust_score
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon $voted_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPostPollOption $option
 * @property-read \App\Models\SocialPostPoll $poll
 * @property-read \App\Models\SocialProfile $voter
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote wherePollOptionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereSocialPostPollId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereTrustScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereVoteWeight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollVote whereVotedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostPollVote extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_poll_id',
        'poll_option_id',
        'social_profile_id',
        'vote_weight',
        'trust_score',
        'meta',
        'voted_at',
    ];

    protected $casts = [
        'vote_weight' => 'float',
        'trust_score' => 'float',
        'meta' => 'array',
        'voted_at' => 'datetime',
    ];

    public function poll(): BelongsTo
    {
        return $this->belongsTo(SocialPostPoll::class, 'social_post_poll_id');
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(SocialPostPollOption::class, 'poll_option_id');
    }

    public function voter(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}

