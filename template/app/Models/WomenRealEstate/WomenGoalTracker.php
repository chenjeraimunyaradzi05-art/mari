<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property \App\Enums\WomenRealEstate\GoalType $goal_type
 * @property numeric|null $target_amount
 * @property numeric $current_amount
 * @property numeric $progress_percent
 * @property \Illuminate\Support\Carbon|null $due_at
 * @property array<array-key, mixed>|null $ai_nudges
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenCohortProfile $profile
 * @method static \Database\Factories\WomenRealEstate\WomenGoalTrackerFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereAiNudges($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereCurrentAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereDueAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereGoalType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereProgressPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereTargetAmount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenGoalTracker whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenGoalTracker extends Model
{
    use HasFactory;

    protected $table = 'women_goal_trackers';

    protected $fillable = [
        'profile_id',
        'goal_type',
        'target_amount',
        'current_amount',
        'progress_percent',
        'due_at',
        'ai_nudges',
    ];

    protected $casts = [
        'goal_type' => \App\Enums\WomenRealEstate\GoalType::class,
        'target_amount' => 'decimal:2',
        'current_amount' => 'decimal:2',
        'progress_percent' => 'decimal:2',
        'due_at' => 'datetime',
        'ai_nudges' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(WomenCohortProfile::class, 'profile_id');
    }

    public function updateProgress(float $currentAmount): void
    {
        $this->setAttribute('current_amount', $currentAmount);

        if ($this->target_amount !== null && $this->target_amount > 0) {
            $progress = min(100, round(($currentAmount / (float) $this->target_amount) * 100, 2));
            $this->setAttribute('progress_percent', $progress);
        }

        $this->save();
    }
}

