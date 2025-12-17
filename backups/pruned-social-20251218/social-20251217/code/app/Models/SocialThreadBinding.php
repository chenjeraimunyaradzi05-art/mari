<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $social_thread_id
 * @property string $bindable_type
 * @property int $bindable_id
 * @property string|null $context
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent $bindable
 * @property-read \App\Models\SocialThread $thread
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereBindableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereBindableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereSocialThreadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadBinding whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialThreadBinding extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_thread_id',
        'bindable_type',
        'bindable_id',
        'context',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(SocialThread::class, 'social_thread_id');
    }

    public function bindable(): MorphTo
    {
        return $this->morphTo();
    }
}

