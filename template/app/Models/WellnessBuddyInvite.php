<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $requester_profile_id
 * @property int $target_profile_id
 * @property string|null $activity_type
 * @property string|null $location_preference
 * @property array<array-key, mixed>|null $preferred_schedule
 * @property array<array-key, mixed>|null $comfort_preferences
 * @property string $status
 * @property string|null $intro_message
 * @property \Illuminate\Support\Carbon|null $responded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile $requester
 * @property-read \App\Models\Profile $target
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereActivityType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereComfortPreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereIntroMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereLocationPreference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite wherePreferredSchedule($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereRequesterProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereRespondedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereTargetProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellnessBuddyInvite whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WellnessBuddyInvite extends Model
{
    use HasFactory;

    protected $fillable = [
        'requester_profile_id',
        'target_profile_id',
        'activity_type',
        'location_preference',
        'preferred_schedule',
        'comfort_preferences',
        'status',
        'intro_message',
        'responded_at',
    ];

    protected $casts = [
        'preferred_schedule' => 'array',
        'comfort_preferences' => 'array',
        'responded_at' => 'datetime',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'requester_profile_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'target_profile_id');
    }
}

