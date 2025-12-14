<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $bank_account_id
 * @property int $user_id
 * @property \Illuminate\Support\Carbon $posted_at
 * @property string $description
 * @property string|null $reference
 * @property int $amount_cents
 * @property string $direction
 * @property string $status
 * @property string|null $category_key
 * @property array<array-key, mixed>|null $ai_suggestions
 * @property int $is_flagged
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\BankAccount|null $account
 * @property float $amount
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\BankTransactionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction forUser(\App\Models\User $user)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereAiSuggestions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereBankAccountId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereCategoryKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereDirection($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereIsFlagged($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction wherePostedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereReference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransaction whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BankTransaction extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_MATCHED = 'matched';

    public const STATUS_EXCLUDED = 'excluded';

    protected $fillable = [
        'bank_account_id',
        'user_id',
        'posted_at',
        'description',
        'reference',
        'amount_cents',
        'direction',
        'status',
        'category_key',
        'ai_suggestions',
        'is_flagged',
        'reviewed_at',
        'metadata',
    ];

    protected $casts = [
        'posted_at' => 'date',
        'reviewed_at' => 'datetime',
        'ai_suggestions' => 'array',
        'metadata' => 'array',
    ];

    protected $appends = ['amount'];

    public function account(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser($query, User $user)
    {
        return $query->where('user_id', $user->id);
    }

    public function getAmountAttribute(): float
    {
        return $this->amount_cents / 100;
    }

    public function setAmountAttribute($value): void
    {
        $this->attributes['amount_cents'] = (int) round($value * 100);
    }

    public function applyCategory(?string $categoryKey): void
    {
        $this->category_key = $categoryKey;
    }
}
