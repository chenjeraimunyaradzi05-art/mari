<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string|null $profile_name
 * @property string $submission_source
 * @property array<array-key, mixed> $debts
 * @property array<array-key, mixed>|null $scenarios
 * @property int $total_balance_cents
 * @property int $current_payment_cents
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read float $current_payment
 * @property-read float $total_balance
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereCurrentPaymentCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereDebts($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereProfileName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereScenarios($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereSubmissionSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereTotalBalanceCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DebtSubmission whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class DebtSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'profile_name',
        'submission_source',
        'debts',
        'scenarios',
        'total_balance_cents',
        'current_payment_cents',
    ];

    protected $casts = [
        'debts' => 'array',
        'scenarios' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getTotalBalanceAttribute(): float
    {
        return $this->total_balance_cents / 100;
    }

    public function getCurrentPaymentAttribute(): float
    {
        return $this->current_payment_cents / 100;
    }
}
