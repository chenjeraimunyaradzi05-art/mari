<?php

namespace App\Models;

use App\Casts\ShareMetadataCast;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string $shareable_type
 * @property int $shareable_id
 * @property int $source_social_profile_id
 * @property int $target_social_thread_id
 * @property string $status
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent $shareable
 * @property-read \App\Models\SocialProfile $sourceProfile
 * @property-read \App\Models\SocialThread $targetThread
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereShareableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereShareableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereSourceSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereTargetSocialThreadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageShare whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialMessageShare extends Model
{
    use HasFactory;

    protected $fillable = [
        'shareable_type',
        'shareable_id',
        'source_social_profile_id',
        'target_social_thread_id',
        'status',
        'metadata',
    ];

    protected $casts = [
        'metadata' => ShareMetadataCast::class,
    ];

    public function shareable(): MorphTo
    {
        return $this->morphTo();
    }

    public function sourceProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'source_social_profile_id');
    }

    public function targetThread(): BelongsTo
    {
        return $this->belongsTo(SocialThread::class, 'target_social_thread_id');
    }

}

