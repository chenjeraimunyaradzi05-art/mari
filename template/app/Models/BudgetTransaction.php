<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $budget_profile_id
 * @property \Illuminate\Support\Carbon $transaction_date
 * @property string $description
 * @property string|null $reference
 * @property int $amount_cents
 * @property string $category_name
 * @property string $category_type
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read float $amount
 * @property-read \App\Models\BudgetProfile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereBudgetProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereCategoryName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereCategoryType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereReference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereTransactionDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BudgetTransaction whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BudgetTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_profile_id',
        'transaction_date',
        'description',
        'reference',
        'amount_cents',
        'category_name',
        'category_type',
        'metadata',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'metadata' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BudgetProfile::class, 'budget_profile_id');
    }

    public function getAmountAttribute(): float
    {
        return $this->amount_cents / 100;
    }
}
