<?php

/**
 * CandidateExperience Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string $company
 * @property string $department
 * @property string $designation
 * @property string $start
 * @property string $end
 * @property string|null $responsibilities
 * @property int $currently_working
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereCompany($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereCurrentlyWorking($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereDepartment($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereDesignation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereResponsibilities($value)
 * @method static \Illuminate\\Database\Eloquent\Builder<static>|CandidateExperience whereStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateExperience whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CandidateExperience extends Model
{
    use HasFactory;
}
