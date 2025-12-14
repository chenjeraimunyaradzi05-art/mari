<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $pathway_type
 * @property string|null $title
 * @property array<array-key, mixed>|null $target_roles
 * @property array<array-key, mixed>|null $target_sectors
 * @property string|null $field
 * @property string|null $industry
 * @property string|null $level
 * @property string|null $preferred_location
 * @property array<array-key, mixed>|null $preferred_locations_multi
 * @property array<array-key, mixed>|null $preferred_study_modes
 * @property bool $open_to_remote
 * @property int|null $min_pay_annual
 * @property int|null $max_pay_annual
 * @property string|null $timeline
 * @property string|null $intake_window
 * @property string|null $skills
 * @property string|null $notes
 * @property string|null $support_needs
 * @property bool $notify_in_app
 * @property bool $notify_email
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $last_matched_at
 * @property int $match_count
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\CareerInterestFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereField($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereIndustry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereIntakeWindow($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereLastMatchedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereMatchCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereMaxPayAnnual($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereMinPayAnnual($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereNotifyEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereNotifyInApp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereOpenToRemote($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest wherePathwayType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest wherePreferredLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest wherePreferredLocationsMulti($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest wherePreferredStudyModes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereSupportNeeds($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereTargetRoles($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereTargetSectors($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereTimeline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CareerInterest whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class CareerInterest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pathway_type',
        'title',
        'target_roles',
        'target_sectors',
        'field',
        'industry',
        'level',
        'preferred_location',
        'preferred_locations_multi',
        'preferred_study_modes',
        'open_to_remote',
        'min_pay_annual',
        'max_pay_annual',
        'timeline',
        'intake_window',
        'skills',
        'notes',
        'support_needs',
        'status',
        'notify_in_app',
        'notify_email',
        'is_active',
        'last_matched_at',
        'match_count',
    ];

    protected $casts = [
        'open_to_remote' => 'boolean',
        'target_roles' => 'array',
        'target_sectors' => 'array',
        'preferred_locations_multi' => 'array',
        'preferred_study_modes' => 'array',
        'notify_in_app' => 'boolean',
        'notify_email' => 'boolean',
        'is_active' => 'boolean',
        'last_matched_at' => 'datetime',
        'match_count' => 'integer',
        'min_pay_annual' => 'integer',
        'max_pay_annual' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
