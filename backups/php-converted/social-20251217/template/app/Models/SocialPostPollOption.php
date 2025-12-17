<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $social_post_poll_id
 * @property string $label
 * @property int $display_order
 * @property int|null votes_count
 * @property array<array-key, mixed>|null $ai_metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPostPoll $poll
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostPollVote> $votes
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereAiMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereDisplayOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereSocialPostPollId($value)
 * @final method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPollOption whereVotesCount($value)
 * @mixin \Eloquent
 */
class SocialPostPollOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_poll_id',
        'label',
        'display_order',
        'votes_count',
        'ai_metadata',
    ];

    protected $casts = [
        'display_order' => 'integer',
        'votes_count' => 'integer',
        'ai_metadata' => 'array',
    ];

    public function poll(): BelongsTo
    {
        return $this->belongsTo(SocialPostPoll::class, 'social_post_poll_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(SocialPostPollVote::class, 'poll_option_id');
    }
}
