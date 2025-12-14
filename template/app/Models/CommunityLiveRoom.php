<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $community_group_id
 * @property int|null $community_event_id
 * @property int $host_profile_id
 * @property string $topic
 * @property string $room_type
 * @property string $state
 * @property int $max_speakers
 * @property int $max_listeners
 * @property \Illuminate\Support\Carbon|null $starts_at
 * @property \Illuminate\Support\Carbon|null $ended_at
 * @property string|null $recording_path
 * @property array<array-key, mixed>|null $stage_layout
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityEvent|null $event
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile $host
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereCommunityEventId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereEndedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereHostProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereMaxListeners($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereMaxSpeakers($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereRecordingPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereRoomType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereStageLayout($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereStartsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereState($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereTopic($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityLiveRoom whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommunityLiveRoom extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_event_id',
        'host_profile_id',
        'topic',
        'room_type',
        'state',
        'max_speakers',
        'max_listeners',
        'starts_at',
        'ended_at',
        'recording_path',
        'stage_layout',
    ];

    protected $casts = [
        'max_speakers' => 'integer',
        'max_listeners' => 'integer',
        'starts_at' => 'datetime',
        'ended_at' => 'datetime',
        'stage_layout' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(CommunityEvent::class, 'community_event_id');
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'host_profile_id');
    }
}
