<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $primary_purpose
 * @property array<array-key, mixed>|null $secondary_intents
 * @property array<array-key, mixed>|null $feature_flags
 * @property string $identity_alignment
 * @property string|null $purpose_story
 * @property string|null $male_signal_notes
 * @property int $completion_step
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose query()
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\UserPrimaryPurposeFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereCompletionStep($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereFeatureFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereIdentityAlignment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereMaleSignalNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose wherePrimaryPurpose($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose wherePurposeStory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereSecondaryIntents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPrimaryPurpose whereUserId($value)
 * @mixin \Eloquent
 */
final class UserPrimaryPurpose extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'primary_purpose',
        'secondary_intents',
        'feature_flags',
        'identity_alignment',
        'purpose_story',
        'male_signal_notes',
        'completion_step',
        'completed_at',
    ];

    protected $casts = [
        'secondary_intents' => 'array',
        'feature_flags' => 'array',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markCompleted(): void
    {
        if ($this->completed_at) {
            return;
        }

        $this->forceFill([
            'completed_at' => now(),
        ])->save();
    }

    public function isComplete(): bool
    {
        return (bool) $this->completed_at;
    }
}

