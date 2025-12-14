<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $social_post_id
 * @property string $question
 * @property string|null $summary
 * @property string $status
 * @property bool $allow_multiple
 * @property \Illuminate\Support\Carbon|null $closes_at
 * @property array<array-key, mixed>|null $ai_moderation_meta
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostPollOption> $options
 * @property int|null options_count
 * @property-read \App\Models\SocialPost $post
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostPollVote> $votes
 * @property int|null votes_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereAiModerationMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereAllowMultiple($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereClosesAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereQuestion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostPoll whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostPoll extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'question',
        'summary',
        'status',
        'allow_multiple',
        'closes_at',
        'ai_moderation_meta',
        'metadata',
    ];

    protected $casts = [
        'allow_multiple' => 'boolean',
        'closes_at' => 'datetime',
        'ai_moderation_meta' => 'array',
        'metadata' => 'array',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(SocialPostPollOption::class)->orderBy('display_order');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(SocialPostPollVote::class);
    }

    public function isClosed(): bool
    {
        if ($this->status === 'closed') {
            return true;
        }

        if ($this->closes_at === null) {
            return false;
        }

        return now()->greaterThan($this->closes_at);
    }
}

