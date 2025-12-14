<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortTimelineEvent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property CohortPersona $persona
 * @property array<array-key, mixed>|null $financial_profile
 * @property array<array-key, mixed>|null $education_profile
 * @property array<array-key, mixed>|null $ai_insights
 * @property array<array-key, mixed>|null $preferences
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenCohortEnrolment> $enrolments
 * @property int|null enrolments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenGoalTracker> $goalTrackers
 * @property int|null goal_trackers_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenPartnerMatch> $partnerMatches
 * @property int|null partner_matches_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenCohortTimelineEvent> $timelineEvents
 * @property int|null timeline_events_count
 * @property-read User $user
 * @method static \Database\Factories\WomenRealEstate\WomenCohortProfileFactory factory($count = null, $state = [])
 * @method static Builder<static>|WomenCohortProfile forPersona(\App\Enums\WomenRealEstate\CohortPersona $persona)
 * @method static Builder<static>|WomenCohortProfile newModelQuery()
 * @method static Builder<static>|WomenCohortProfile newQuery()
 * @method static Builder<static>|WomenCohortProfile query()
 * @method static Builder<static>|WomenCohortProfile whereAiInsights($value)
 * @method static Builder<static>|WomenCohortProfile whereCreatedAt($value)
 * @method static Builder<static>|WomenCohortProfile whereEducationProfile($value)
 * @method static Builder<static>|WomenCohortProfile whereFinancialProfile($value)
 * @method static Builder<static>|WomenCohortProfile whereId($value)
 * @method static Builder<static>|WomenCohortProfile wherePersona($value)
 * @method static Builder<static>|WomenCohortProfile wherePreferences($value)
 * @method static Builder<static>|WomenCohortProfile whereUpdatedAt($value)
 * @method static Builder<static>|WomenCohortProfile whereUserId($value)
 * @mixin \Eloquent
 */
final class WomenCohortProfile extends Model
{
    use HasFactory;

    protected $table = 'women_cohort_profiles';

    protected $fillable = [
        'user_id',
        'persona',
        'financial_profile',
        'education_profile',
        'ai_insights',
        'preferences',
    ];

    protected $casts = [
        'persona' => CohortPersona::class,
        'financial_profile' => 'array',
        'education_profile' => 'array',
        'ai_insights' => 'array',
        'preferences' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function enrolments(): HasMany
    {
        return $this->hasMany(WomenCohortEnrolment::class, 'profile_id');
    }

    public function partnerMatches(): HasMany
    {
        return $this->hasMany(WomenPartnerMatch::class, 'profile_id');
    }

    public function goalTrackers(): HasMany
    {
        return $this->hasMany(WomenGoalTracker::class, 'profile_id');
    }

    public function timelineEvents(): HasMany
    {
        return $this->hasMany(WomenCohortTimelineEvent::class, 'profile_id')->latest('occurred_at');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForPersona(Builder $query, CohortPersona $persona): Builder
    {
        return $query->where('persona', $persona->value);
    }
}

