<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $surface
 * @property string $action
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property array<array-key, mixed>|null $payload
 * @property string|null $actor_name
 * @property string|null $actor_email
 * @property string|null $actor_ip
 * @property string|null $actor_user_agent
 * @property \Illuminate\Support\Carbon $logged_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent|null $subject
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereActorEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereActorIp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereActorName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereActorUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereLoggedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereSubjectId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereSubjectType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereSurface($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConsentLog whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ConsentLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'surface',
        'action',
        'subject_type',
        'subject_id',
        'payload',
        'actor_name',
        'actor_email',
        'actor_ip',
        'actor_user_agent',
        'logged_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'logged_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
