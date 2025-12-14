<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $action
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon $occurred_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereOccurredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OnboardingEvent whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class OnboardingEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'action',
        'payload',
        'occurred_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
