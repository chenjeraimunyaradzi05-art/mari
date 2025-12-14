<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int $profile_id
 * @property string $role
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $last_read_at
 * @property \Illuminate\Support\Carbon|null $joined_at
 * @property \Illuminate\Support\Carbon|null $left_at
 * @property bool $muted
 * @property array<array-key, mixed>|null $settings
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Conversation $conversation
 * @property-read \App\Models\Profile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereConversationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereJoinedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereLastReadAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereLeftAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereMuted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereSettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationParticipant whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ConversationParticipant extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'profile_id',
        'role',
        'status',
        'last_read_at',
        'joined_at',
        'left_at',
        'muted',
        'settings',
    ];

    protected $casts = [
        'last_read_at' => 'datetime',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'muted' => 'boolean',
        'settings' => 'array',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    public function markRead(): void
    {
        $this->forceFill(['last_read_at' => now()])->save();
    }
}
