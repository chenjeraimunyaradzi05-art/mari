<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $blocker_profile_id
 * @property int $blocked_profile_id
 * @property string $source
 * @property string|null $reason
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property int|null $enforcement_action_id
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile $blocked
 * @property-read \App\Models\SocialProfile $blocker
 * @property-read \App\Models\SocialEnforcementAction|null $enforcementAction
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereBlockedProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereBlockerProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereEnforcementActionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialBlock whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialBlock extends Model
{
    use HasFactory;

    protected $fillable = [
        'blocker_profile_id',
        'blocked_profile_id',
        'source',
        'reason',
        'status',
        'expires_at',
        'enforcement_action_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'expires_at' => 'datetime',
    ];

    public function blocker()
    {
        return $this->belongsTo(SocialProfile::class, 'blocker_profile_id');
    }

    public function blocked()
    {
        return $this->belongsTo(SocialProfile::class, 'blocked_profile_id');
    }

    public function enforcementAction()
    {
        return $this->belongsTo(SocialEnforcementAction::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function markExpired(): void
    {
        $this->update(['status' => 'expired']);
    }
}

