<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int $sender_profile_id
 * @property string $message_type
 * @property string|null $body
 * @property array<array-key, mixed>|null $attachments
 * @property string|null $shareable_type
 * @property int|null $shareable_id
 * @property bool $is_system
 * @property \Illuminate\Support\Carbon $sent_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Conversation $conversation
 * @property-read \App\Models\Profile $sender
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereAttachments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereConversationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereIsSystem($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereMessageType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereSenderProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereSentAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereShareableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereShareableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConversationMessage whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ConversationMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'sender_profile_id',
        'message_type',
        'body',
        'attachments',
        'shareable_type',
        'shareable_id',
        'is_system',
        'sent_at',
    ];

    protected $casts = [
        'attachments' => 'array',
        'is_system' => 'boolean',
        'sent_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'sender_profile_id');
    }
}
