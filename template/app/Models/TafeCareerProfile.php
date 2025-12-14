<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $motivations
 * @property array<array-key, mixed>|null $focus_areas
 * @property array<array-key, mixed>|null $preferred_sectors
 * @property string|null $salary_aspiration
 * @property string|null $impact_goals
 * @property string|null $work_style
 * @property array<array-key, mixed>|null $top_skills
 * @property string|null $ai_summary
 * @property \Illuminate\Support\Carbon|null $ai_refreshed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereAiRefreshedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereAiSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereFocusAreas($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereImpactGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereMotivations($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile wherePreferredSectors($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereSalaryAspiration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereTopSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\\Builder<static>|TafeCareerProfile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeCareerProfile whereWorkStyle($value)
 * @mixin \Eloquent
 */
final class TafeCareerProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'motivations',
        'focus_areas',
        'preferred_sectors',
        'salary_aspiration',
        'impact_goals',
        'work_style',
        'top_skills',
        'ai_summary',
        'ai_refreshed_at',
    ];

    protected $casts = [
        'focus_areas' => 'array',
        'preferred_sectors' => 'array',
        'top_skills' => 'array',
        'ai_refreshed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

