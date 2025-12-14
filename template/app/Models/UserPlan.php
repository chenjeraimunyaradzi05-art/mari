<?php
/**
 * UserPlan Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $company_id
 * @property int $plan_id
 * @property int $job_limit
 * @property int $featured_job_limit
 * @property int $highlight_job_limit
 * @property int $profile_verified
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Plan|null $plan
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereFeaturedJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereHighlightJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|use rPlan wherePlanId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereProfileVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserPlan whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class UserPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'id',
        'company_id',
        'plan_id',
        'job_limit',
        'featured_job_limit',
        'highlight_job_limit',
        'profile_verified'
    ];


    function plan() : BelongsTo {
        return $this->belongsTo(Plan::class);
    }
}

