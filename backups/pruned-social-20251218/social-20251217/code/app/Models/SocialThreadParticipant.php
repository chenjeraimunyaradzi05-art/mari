<?php

namespace App\Models;

use App\Enums\SocialThreadParticipantRole;
use App\Enums\SocialThreadParticipantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $social_thread_id
 * @property int $social_profile_id
 * @property SocialThreadParticipantRole $role
 * @property SocialThreadParticipantStatus $status
 * @property \Illuminate\Support\Carbon|null $joined_at
 * @property \Illuminate\Support\Carbon|null $left_at
 * @property \Illuminate\Support\Carbon|null $last_read_at
 * @property int|null $last_read_message_id
 * @property \Illuminate\Support\Carbon|null $muted_at
 * @property bool $notifications_enabled
 * @property array<array-key, mixed>|null $settings
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\SocialProfile $profile
 * @property-read \App\Models\SocialThread $thread
 * @method static \Database\Factories\SocialThreadParticipantFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereJoinedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereLastReadAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereLastReadMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereLeftAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereMutedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereNotificationsEnabled($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereSettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereSocialThreadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialThreadParticipant withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialThreadParticipant extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_thread_id',
        'social_profile_id',
        'role',
        'status',
        'joined_at',
        'left_at',
        'last_read_at',
        'last_read_message_id',
        'muted_at',
        'notifications_enabled',
        'settings',
    ];

    protected $casts = [
        'role' => SocialThreadParticipantRole::class,
        'status' => SocialThreadParticipantStatus::class,
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'last_read_at' => 'datetime',
        'muted_at' => 'datetime',
        'notifications_enabled' => 'boolean',
        'settings' => 'array',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(SocialThread::class, 'social_thread_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}

