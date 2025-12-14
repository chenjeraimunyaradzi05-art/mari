<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $tafe_program_id
 * @property string $status
 * @property float $ai_success_probability
 * @property array<array-key, mixed>|null $ai_recommended_actions
 * @property string|null $next_action
 * @property \Illuminate\Support\Carbon|null $next_action_due_at
 * @property string|null $motivation_note
 * @property int|null $last_synced_post_id
 * @property \Illuminate\Support\Carbon|null $applied_at
 * @property \Illuminate\Support\Carbon|null $accepted_at
 * @property \Illuminate\Support\Carbon|null $enrolled_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TafeProgram $program
 * @property-read \App\Models\User $user
 * @method static Builder<static>|TafeStudentJourney active()
 * @method static Builder<static>|TafeStudentJourney newModelQuery()
 * @method static Builder<static>|TafeStudentJourney newQuery()
 * @method static Builder<static>|TafeStudentJourney query()
 * @method static Builder<static>|TafeStudentJourney whereAcceptedAt($value)
 * @method static Builder<static>|TafeStudentJourney whereAiRecommendedActions($value)
 * @method static Builder<static>|TafeStudentJourney whereAiSuccessProbability($value)
 * @method static Builder<static>|TafeStudentJourney whereAppliedAt($value)
 * @method static Builder<static>|TafeStudentJourney whereCreatedAt($value)
 * @method static Builder<static>|TafeStudentJourney whereEnrolledAt($value)
 * @method static Builder<static>|TafeStudentJourney whereId($value)
 * @method static Builder<static>|TafeStudentJourney whereLastSyncedPostId($value)
 * @method static Builder<static>|TafeStudentJourney whereMotivationNote($value)
 * @method static Builder<static>|TafeStudentJourney whereNextAction($value)
 * @method static Builder<static>|TafeStudentJourney whereNextActionDueAt($value)
 * @method static Builder<static>|TafeStudentJourney whereStatus($value)
 * @method static Builder<static>|TafeStudentJourney whereTafeProgramId($value)
 * @method static Builder<static>|TafeStudentJourney whereUpdatedAt($value)
 * @method static Builder<static>|TafeStudentJourney whereUserId($value)
 * @mixin \Eloquent
 */
final class TafeStudentJourney extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'tafe_program_id',
        'status',
        'ai_success_probability',
        'ai_recommended_actions',
        'next_action',
        'next_action_due_at',
        'motivation_note',
        'last_synced_post_id',
        'applied_at',
        'accepted_at',
        'enrolled_at',
    ];

    protected $casts = [
        'ai_success_probability' => 'float',
        'ai_recommended_actions' => 'array',
        'next_action_due_at' => 'datetime',
        'applied_at' => 'datetime',
        'accepted_at' => 'datetime',
        'enrolled_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(TafeProgram::class, 'tafe_program_id');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeActive(Builder $builder): Builder
    {
        return $builder->whereNotIn('status', ['graduated', 'on_hold']);
    }
}

