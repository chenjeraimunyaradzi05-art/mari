<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $owner_profile_id
 * @property int|null $owner_user_id
 * @property string $name
 * @property string $slug
 * @property string|null $tagline
 * @property string $category
 * @property string $visibility
 * @property string $access_model
 * @property array<array-key, mixed>|null $focus_areas
 * @property string|null $region_scope
 * @property bool $requires_verification
 * @property int|null $member_limit
 * @property int $followers_count
 * @property int $close_friends_count
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityChapter> $chapters
 * @property int|null chapters_count
 * @property-read \App\Models\CommunityList|null $closeFriendList
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipCohort> $cohorts
 * @property int|null cohorts_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityEvent> $events
 * @property int|null events_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityList> $lists
 * @property int|null lists_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityLiveRoom> $liveRooms
 * @property int|null live_rooms_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityMembership> $memberships
 * @property int|null memberships_count
 * @property-read User|null $owner
 * @property-read \App\Models\SocialProfile $ownerProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityResource> $resources
 * @property int|null resources_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityRole> $roles
 * @property int|null roles_count
 *
 * @method static \Database\Factories\CommunityGroupFactory factory($count = null, $state = [])
 * @method static Builder<static>|CommunityGroup newModelQuery()
 * @method static Builder<static>|CommunityGroup newQuery()
 * @method static Builder<static>|CommunityGroup onlyTrashed()
 * @method static Builder<static>|CommunityGroup query()
 * @method static Builder<static>|CommunityGroup visible(string $visibility = 'public')
 * @method static Builder<static>|CommunityGroup whereAccessModel($value)
 * @method static Builder<static>|CommunityGroup whereCategory($value)
 * @method static Builder<static>|CommunityGroup whereCloseFriendsCount($value)
 * @method static Builder<static>|CommunityGroup whereCreatedAt($value)
 * @method static Builder<static>|CommunityGroup whereDeletedAt($value)
 * @method static Builder<static>|CommunityGroup whereFocusAreas($value)
 * @method static Builder<static>|CommunityGroup whereFollowersCount($value)
 * @method static Builder<static>|CommunityGroup whereId($value)
 * @method static Builder<static>|CommunityGroup whereMemberLimit($value)
 * @method static Builder<static>|CommunityGroup whereMetadata($value)
 * @method static Builder<static>|CommunityGroup whereName($value)
 * @method static Builder<static>|CommunityGroup whereOwnerProfileId($value)
 * @method static Builder<static>|CommunityGroup whereOwnerUserId($value)
 * @method static Builder<static>|CommunityGroup whereRegionScope($value)
 * @method static Builder<static>|CommunityGroup whereRequiresVerification($value)
 * @method static Builder<static>|CommunityGroup whereSlug($value)
 * @method static Builder<static>final |CommunityGroup whereTagline($value)
 * @method static Builder<static>|CommunityGroup whereUpdatedAt($value)
 * @method static Builder<static>|CommunityGroup whereUuid($value)
 * @method static Builder<static>|CommunityGroup whereVisibility($value)
 * @method static Builder<static>|CommunityGroup withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|CommunityGroup withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class CommunityGroup extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'owner_profile_id',
        'owner_user_id',
        'name',
        'slug',
        'tagline',
        'category',
        'visibility',
        'access_model',
        'focus_areas',
        'region_scope',
        'requires_verification',
        'member_limit',
        'followers_count',
        'close_friends_count',
        'metadata',
    ];

    protected $casts = [
        'focus_areas' => 'array',
        'requires_verification' => 'boolean',
        'metadata' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $group): void {
            if (blank($group->uuid)) {
                $group->uuid = (string) Str::uuid();
            }

            static::ensureSlug($group);
        });

        self::saving(function (self $group): void {
            static::ensureSlug($group);
        });
    }

    protected static function ensureSlug(self $group): void
    {
        if (blank($group->slug) && filled($group->name)) {
            $group->slug = Str::slug($group->name);
        }

        if (blank($group->slug)) {
            return;
        }

        $group->slug = self::uniqueSlug($group->slug, $group->getKey());
    }

    protected static function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug($value) ?: 'community';
        $slug = $base;
        $counter = 1;

        while (self::where('slug', $slug)
            ->when($ignoreId, static fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }

    public function ownerProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'owner_profile_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(CommunityChapter::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(CommunityRole::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class);
    }

    public function lists(): HasMany
    {
        return $this->hasMany(CommunityList::class);
    }

    public function closeFriendList(): HasOne
    {
        return $this->hasOne(CommunityList::class)
            ->where('type', 'close_friends');
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommunityEvent::class);
    }

    public function liveRooms(): HasMany
    {
        return $this->hasMany(CommunityLiveRoom::class);
    }

    public function resources(): HasMany
    {
        return $this->hasMany(CommunityResource::class);
    }

    public function cohorts(): HasMany
    {
        return $this->hasMany(MentorshipCohort::class);
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeVisible(Builder $query, string $visibility = 'public'): Builder
    {
        return $query->where('visibility', $visibility);
    }

    public function canBeManagedBy(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ((int) $this->owner_user_id === (int) $user->getKey()) {
            return true;
        }

        return $this->memberships()
            ->where('social_profile_id', optional($user->socialProfile)->getKey())
            ->whereHas('role', fn ($query) => $query->where('hierarchy_level', '<=', 10))
            ->exists();
    }
}
