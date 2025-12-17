<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string|null $actor_type
 * @property int|null $actor_id
 * @property string $subject_type
 * @property int $subject_id
 * @property string $action
 * @property string|null $decision
 * @property string|null $rationale
 * @property string $visibility
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent|null $actor
 * @property-read Model|\Eloquent $subject
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereActorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereActorType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereDecision($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereRationale($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereSubjectId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereSubjectType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereUpdatedAt($value)
 * @final method static \Illuminate\Database\Eloquent\Builder<static>|SocialTransparencyLog whereVisibility($value)
 * @mixin \Eloquent
 */
class SocialTransparencyLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'actor_type',
        'actor_id',
        'subject_type',
        'subject_id',
        'action',
        'decision',
        'rationale',
        'visibility',
        'metadata',
        'published_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'published_at' => 'datetime',
    ];

    public function actor()
    {
        return $this->morphTo();
    }

    public function subject()
    {
        return $this->morphTo();
    }
}
