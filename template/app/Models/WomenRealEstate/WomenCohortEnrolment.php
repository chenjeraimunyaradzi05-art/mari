<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortRole;
use App\Enums\WomenRealEstate\CohortStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property string $cohort_slug
 * @property CohortRole $role
 * @property CohortStatus $status
 * @property \Illuminate\Support\Carbon|null $joined_at
 * @property \Illuminate\Support\Carbon|null $left_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenCohortProfile $profile
 * @method static Builder<static>|WomenCohortEnrolment active()
 * @method static \Database\Factories\WomenRealEstate\WomenCohortEnrolmentFactory factory($count = null, $state = [])
 * @method static Builder<static>|WomenCohortEnrolment newModelQuery()
 * @method static Builder<static>|WomenCohortEnrolment newQuery()
 * @method static Builder<static>|WomenCohortEnrolment query()
 * @method static Builder<static>|WomenCohortEnrolment whereCohortSlug($value)
 * @method static Builder<static>|WomenCohortEnrolment whereCreatedAt($value)
 * @method static Builder<static>|WomenCohortEnrolment whereId($value)
 * @method static Builder<static>|WomenCohortEnrolment whereJoinedAt($value)
 * @method static Builder<static>|WomenCohortEnrolment whereLeftAt($value)
 * @method static Builder<static>|WomenCohortEnrolment whereProfileId($value)
 * @method static Builder<static>|WomenCohortEnrolment whereRole($value)
 * @method static Builder<static>|WomenCohortEnrolment whereStatus($value)
 * @method static Builder<static>|WomenCohortEnrolment whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenCohortEnrolment extends Model
{
    use HasFactory;

    protected $table = 'women_cohort_enrolments';

    protected $fillable = [
        'profile_id',
        'cohort_slug',
        'role',
        'status',
        'joined_at',
        'left_at',
    ];

    protected $casts = [
        'role' => CohortRole::class,
        'status' => CohortStatus::class,
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(WomenCohortProfile::class, 'profile_id');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', CohortStatus::ACTIVE->value);
    }
}

