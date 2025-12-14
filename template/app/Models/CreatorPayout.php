<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property \Illuminate\Support\Carbon $period_start
 * @property \Illuminate\Support\Carbon $period_end
 * @property int $impressions
 * @property float $payout_amount
 * @property float|null $cpm
 * @property string $currency
 * @property string $status
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static Builder<static>|CreatorPayout forUser(int $userId)
 * @method static Builder<static>|CreatorPayout newModelQuery()
 * @method static Builder<static>|CreatorPayout newQuery()
 * @method static Builder<static>|CreatorPayout query()
 * @method static Builder<static>|CreatorPayout recentFirst()
 * @method static Builder<static>|CreatorPayout whereCpm($value)
 * @method static Builder<static>|CreatorPayout whereCreatedAt($value)
 * @method static Builder<static>|CreatorPayout whereCurrency($value)
 * @method static Builder<static>|CreatorPayout whereId($value)
 * @method static Builder<static>|CreatorPayout whereImpressions($value)
 * @method static Builder<static>|CreatorPayout whereMeta($value)
 * @method static Builder<static>|CreatorPayout wherePayoutAmount($value)
 * @method static Builder<static>|CreatorPayout wherePeriodEnd($value)
 * @method static Builder<static>|CreatorPayout wherePeriodStart($value)
 * @method static Builder<static>|CreatorPayout whereStatus($value)
 * @method static Builder<static>|CreatorPayout whereUpdatedAt($value)
 * @method static Builder<static>|CreatorPayout whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class CreatorPayout extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'period_start',
        'period_end',
        'impressions',
        'payout_amount',
        'cpm',
        'currency',
        'status',
        'meta',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'impressions' => 'integer',
        'payout_amount' => 'float',
        'cpm' => 'float',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeRecentFirst(Builder $query): Builder
    {
        return $query->orderByDesc('period_end')->orderByDesc('id');
    }
}
