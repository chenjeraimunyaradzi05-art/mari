<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $community_group_id
 * @property int|null $community_chapter_id
 * @property int|null $mentorship_cohort_id
 * @property int $created_by_profile_id
 * @property string $title
 * @property string $slug
 * @property string $event_type
 * @property string $format
 * @property \Illuminate\Support\Carbon $starts_at
 * @property \Illuminate\Support\Carbon|null $ends_at
 * @property string|null $timezone
 * @property int|null $capacity
 * @property string|null $location
 * @property string|null $stream_url
 * @property array<array-key, mixed>|null $metadata
 * @property string $visibility
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \App\Models\MentorshipCohort|null $cohort
 * @property-read \App\Models\SocialProfile $creator
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityLiveRoom> $liveRooms
 * @property int|null live_rooms_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereCapacity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereCreatedByProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereEndsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereMentorshipCohortId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereStartsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereStreamUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereTimezone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityEvent whereVisibility($value)
 * @method static \Database\Factories\CommunityEventFactory factory($count = null, $state = [])
 *
 * @mixin \Eloquent
 */
final class CommunityEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'mentorship_cohort_id',
        'created_by_profile_id',
        'title',
        'slug',
        'event_type',
        'format',
        'starts_at',
        'ends_at',
        'timezone',
        'capacity',
        'location',
        'stream_url',
        'metadata',
        'visibility',
        'status',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function cohort(): BelongsTo
    {
        return $this->belongsTo(MentorshipCohort::class, 'mentorship_cohort_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'created_by_profile_id');
    }

    public function liveRooms(): HasMany
    {
        return $this->hasMany(CommunityLiveRoom::class, 'community_event_id');
    }
}
