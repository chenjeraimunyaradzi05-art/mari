<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property string $event_type
 * @property string $actor_type
 * @property int|null $actor_id
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon $occurred_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPost $post
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereActorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereActorType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereOccurredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialModerationEvent whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialModerationEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'event_type',
        'actor_type',
        'actor_id',
        'payload',
        'occurred_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }
}

