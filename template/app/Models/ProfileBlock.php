<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $blocker_profile_id
 * @property int $blocked_profile_id
 * @property string|null $reason
 * @property \Illuminate\Support\Carbon $blocked_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile $blocked
 * @property-read \App\Models\Profile $blocker
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereBlockedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereBlockedProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereBlockerProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileBlock whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ProfileBlock extends Model
{
    use HasFactory;

    protected $fillable = [
        'blocker_profile_id',
        'blocked_profile_id',
        'reason',
        'blocked_at',
    ];

    protected $casts = [
        'blocked_at' => 'datetime',
    ];

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'blocker_profile_id');
    }

    public function blocked(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'blocked_profile_id');
    }
}
