<?php

/**
 * JobSkills Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $job_id
 * @property int $skill_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Skill|null $skill
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills whereSkillId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobSkills whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobSkills extends Model
{
    use HasFactory;

    protected $fillable = [
        'job_id',
        'skill_id',
    ];

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class, 'skill_id', 'id');
    }
}
