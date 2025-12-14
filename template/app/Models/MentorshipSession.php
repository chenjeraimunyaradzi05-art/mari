<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $program_id
 * @property int|null $mentor_user_id
 * @property int|null $mentee_user_id
 * @property \Illuminate\Support\Carbon|null $scheduled_for
 * @property int $duration_minutes
 * @property string $status
 * @property string|null $meeting_link
 * @property array<array-key, mixed>|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $mentee
 * @property-read \App\Models\User|null $mentor
 * @property-read \App\Models\MentorshipProgram $program
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereDurationMinutes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereMeetingLink($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereMenteeUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereMentorUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereScheduledFor($value)
 * @method static \Illuminate\Database\Eloquent\\Builder<static>|MentorshipSession whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipSession whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MentorshipSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'mentor_user_id',
        'mentee_user_id',
        'scheduled_for',
        'duration_minutes',
        'status',
        'meeting_link',
        'notes',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'duration_minutes' => 'int',
        'notes' => 'array',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(MentorshipProgram::class, 'program_id');
    }

    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_user_id');
    }

    public function mentee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentee_user_id');
    }
}
