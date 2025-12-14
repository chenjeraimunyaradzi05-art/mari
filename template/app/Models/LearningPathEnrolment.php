<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $real_estate_learning_path_id
 * @property int $user_id
 * @property string $enrolment_status
 * @property int $progress_percent
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $last_ai_check_in_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\RealEstateLearningPath $path
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\LearningPathEnrolmentFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereEnrolmentStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereLastAiCheckInAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereProgressPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereRealEstateLearningPathId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningPathEnrolment whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class LearningPathEnrolment extends Model
{
    use HasFactory;

    protected $fillable = [
        'real_estate_learning_path_id',
        'user_id',
        'enrolment_status',
        'progress_percent',
        'notes',
        'last_ai_check_in_at',
    ];

    protected $casts = [
        'progress_percent' => 'integer',
        'last_ai_check_in_at' => 'datetime',
    ];

    public function path(): BelongsTo
    {
        return $this->belongsTo(RealEstateLearningPath::class, 'real_estate_learning_path_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
