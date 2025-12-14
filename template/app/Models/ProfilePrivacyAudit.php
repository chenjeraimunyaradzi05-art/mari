<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property int|null $actor_user_id
 * @property string|null $from_tier
 * @property string $to_tier
 * @property string|null $reason
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $actor
 * @property-read \App\Models\Profile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereActorUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereFromTier($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereToTier($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfilePrivacyAudit whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ProfilePrivacyAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'actor_user_id',
        'from_tier',
        'to_tier',
        'reason',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
