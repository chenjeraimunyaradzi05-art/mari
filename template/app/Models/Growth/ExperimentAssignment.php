<?php

namespace App\Models\Growth;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $experiment_id
 * @property string $visitor_id
 * @property int|null $user_id
 * @property string $variant
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Growth\Experiment $experiment
 * @property-read User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereExperimentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereVariant($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentAssignment whereVisitorId($value)
 * @mixin \Eloquent
 */
final class ExperimentAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'experiment_id',
        'visitor_id',
        'user_id',
        'variant',
    ];

    public function experiment()
    {
        return $this->belongsTo(Experiment::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

