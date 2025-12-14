<?php

namespace App\Models\Growth;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property string $status
 * @property array<array-key, mixed> $variants
 * @property array<array-key, mixed>|null $weights
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $ended_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Growth\ExperimentAssignment> $assignments
 * @property int|null assignments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Growth\ExperimentConversion> $conversions
 * @property int|null conversions_count
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereEndedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereVariants($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Experiment whereWeights($value)
 * @mixin \Eloquent
 */
final class Experiment extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'status',
        'variants',
        'weights',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'variants' => 'array',
        'weights' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function assignments()
    {
        return $this->hasMany(ExperimentAssignment::class);
    }

    public function conversions()
    {
        return $this->hasMany(ExperimentConversion::class);
    }
}

