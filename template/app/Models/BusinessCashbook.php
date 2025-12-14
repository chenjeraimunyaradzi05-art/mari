<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $entity_type
 * @property string $currency
 * @property bool $is_default
 * @property \Illuminate\Support\Carbon|null $start_date
 * @property string|null $notes
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BusinessBudget> $budgets
 * @property int|null budgets_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BusinessCashbookEntry> $entries
 * @property int|null entries_count
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\BusinessCashbookFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereEntityType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereIsDefault($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereStartDate($final value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbook whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BusinessCashbook extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'entity_type',
        'currency',
        'is_default',
        'start_date',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'start_date' => 'date',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(BusinessCashbookEntry::class);
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(BusinessBudget::class);
    }
}
