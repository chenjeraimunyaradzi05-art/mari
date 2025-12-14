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
 * @property string $conversion_event
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Growth\Experiment $experiment
 * @property-read User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereConversionEvent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereExperimentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ExperimentConversion whereVisitorId($value)
 * @mixin \Eloquent
 */
final class ExperimentConversion extends Model
{
    use HasFactory;

    protected $fillable = [
        'experiment_id',
        'visitor_id',
        'user_id',
        'conversion_event',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
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

