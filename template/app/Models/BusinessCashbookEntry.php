<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $business_cashbook_id
 * @property \Illuminate\Support\Carbon $date
 * @property string $entry_type
 * @property string|null $category
 * @property string|null $description
 * @property float $amount
 * @property bool $is_tax_deductible
 * @property string|null $ai_last_context_token
 * @property \Illuminate\Support\Carbon|null $ai_last_context_at
 * @property bool $reviewed_by_ai
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\BusinessCashbook $cashbook
 *
 * @method static \Database\Factories\BusinessCashbookEntryFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereAiLastContextAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereAiLastContextToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereBusinessCashbookId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereEntryType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereIsTaxDeductible($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereReviewedByAi($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessCashbookEntry whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class BusinessCashbookEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_cashbook_id',
        'date',
        'entry_type',
        'category',
        'description',
        'amount',
        'is_tax_deductible',
        'ai_last_context_token',
        'ai_last_context_at',
        'reviewed_by_ai',
        'metadata',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'float',
        'is_tax_deductible' => 'boolean',
        'ai_last_context_at' => 'datetime',
        'reviewed_by_ai' => 'boolean',
        'metadata' => 'array',
    ];

    public function cashbook(): BelongsTo
    {
        return $this->belongsTo(BusinessCashbook::class, 'business_cashbook_id');
    }
}
