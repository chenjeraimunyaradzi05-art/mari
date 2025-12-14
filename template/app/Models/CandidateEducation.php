<?php

/**
 * CandidateEducation Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $candidate_id
 * @property string $level
 * @property string $degree
 * @property string $year
 * @property string|null $note
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereDegree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereNote($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereYear($value)
 *
 * @property string|null $institution
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateEducation whereInstitution($value)
 *
 * @mixin \Eloquent
 */
final class CandidateEducation extends Model
{
    use HasFactory;

    protected $fillable = [
        'candidate_id',
        'institution',
        'level',
        'degree',
        'year',
        'note',
    ];
}
