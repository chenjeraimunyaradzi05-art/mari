<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $social_profile_id
 * @property string|null $headline
 * @property string|null $bio
 * @property int $experience_years
 * @property array<array-key, mixed>|null $transaction_focus
 * @property array<array-key, mixed>|null $service_regions
 * @property string $availability_status
 * @property string|null $calendly_url
 * @property string|null $video_pitch_url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenHousingListing> $listings
 * @property int|null listings_count
 * @property-read \App\Models\SocialProfile|null $socialProfile
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\AgentProfileFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereAvailabilityStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereBio($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereCalendlyUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereExperienceYears($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereHeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereServiceRegions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereTransactionFocus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AgentProfile whereVideoPitchUrl($value)
 *
 * @mixin \Eloquent
 */
final class AgentProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'social_profile_id',
        'headline',
        'bio',
        'experience_years',
        'transaction_focus',
        'service_regions',
        'availability_status',
        'calendly_url',
        'video_pitch_url',
    ];

    protected $casts = [
        'transaction_focus' => 'array',
        'service_regions' => 'array',
        'experience_years' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function socialProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class);
    }

    public function listings(): HasMany
    {
        return $this->hasMany(WomenHousingListing::class, 'agent_profile_id');
    }
}
