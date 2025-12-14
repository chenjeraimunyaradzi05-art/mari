<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $institution
 * @property string $account_name
 * @property string|null $account_number_mask
 * @property string $account_type
 * @property string $currency
 * @property \Illuminate\Support\Carbon|null $last_synced_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\BankTransaction> $transactions
 * @property int|null transactions_count
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\BankAccountFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereAccountName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereAccountNumberMask($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereAccountType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereInstitution($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereLastSyncedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankAccount whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BankAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'institution',
        'account_name',
        'account_number_mask',
        'account_type',
        'currency',
        'last_synced_at',
        'metadata',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class);
    }
}
