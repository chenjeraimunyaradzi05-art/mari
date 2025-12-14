<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property string $badge_type
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $awarded_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereAwardedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereBadgeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBadge whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ProfileBadge extends Model
{
    use HasFactory;

    public const BADGE_TYPES = ['verified', 'premium', 'impact_creator', 'certified_coach', 'trusted_host', 'mentor'];

    protected $fillable = [
        'profile_id',
        'badge_type',
        'status',
        'awarded_at',
        'expires_at',
        'metadata',
    ];

    protected $casts = [
        'awarded_at' => 'datetime',
        'expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }
}
