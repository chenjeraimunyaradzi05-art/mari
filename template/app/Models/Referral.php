<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $referrer_id
 * @property int|null $referred_id
 * @property string $referral_code
 * @property string|null $referred_email
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $referred_at
 * @property \Illuminate\Support\Carbon|null $rewarded_at
 * @property numeric|null $reward_amount
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $referred
 * @property-read \App\Models\User $referrer
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereReferralCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereReferredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereReferredEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereReferredId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereReferrerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereRewardAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereRewardedAt($value)
 * @method static \Illuminate\\Database\Eloquent\Builder<static>|Referral whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Referral whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Referral extends Model
{
    use HasFactory;

    protected $fillable = [
        'referrer_id',
        'referred_id',
        'referral_code',
        'referred_email',
        'status',
        'referred_at',
        'rewarded_at',
        'reward_amount',
    ];

    protected $casts = [
        'referred_at' => 'datetime',
        'rewarded_at' => 'datetime',
        'reward_amount' => 'decimal:2',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    public function referred(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_id');
    }
}
