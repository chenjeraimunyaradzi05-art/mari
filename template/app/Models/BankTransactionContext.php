<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $token
 * @property array<array-key, mixed>|null $filters
 * @property array<array-key, mixed>|null $selection_preview
 * @property int $selection_total
 * @property string|null $prompt
 * @property string $context_payload
 * @property string|null $surface
 * @property string $context_key
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\BankTransactionContextFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereContextKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereContextPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext wherePrompt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereSelectionPreview($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereSelectionTotal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereSurface($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BankTransactionContext whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BankTransactionContext extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'token',
        'filters',
        'selection_preview',
        'selection_total',
        'prompt',
        'context_payload',
        'surface',
        'context_key',
    ];

    protected $casts = [
        'filters' => 'array',
        'selection_preview' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
