<?php

namespace App\Services;

use App\Models\CommunityEvent;
use App\Models\CommunityGroup;
use App\Models\CommunityInvite;
use App\Models\CommunityList;
use App\Models\CommunityMembership;
use App\Models\CommunityResource;
use App\Models\CommunityLiveRoom;
use App\Models\MentorshipCohortMember;
use App\Models\SocialFollow;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

final class SocialDataBackboneService
{
    protected array $cacheMeta = [];

    public function build(User $user, bool $forceRefresh = false): array
    {
        $cacheKey = $this->cacheKey($user);
        $ttl = $this->cacheTtl();

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        }

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['payload'])) {
            $storedAt = isset($cached['stored_at']) ? Carbon::parse($cached['stored_at']) : null;
            $this->cacheMeta = $this->buildCacheMeta(true, $ttl, $storedAt);

            return $cached['payload'];
        }

        $payload = $this->buildPayload($user);
        $storedAt = Carbon::now();

        Cache::put($cacheKey, [
            'payload' => $payload,
            'stored_at' => $storedAt->toIso8601String(),
        ], $ttl);

        $this->cacheMeta = $this->buildCacheMeta(false, $ttl, $storedAt);

        return $payload;
    }

    public function getCacheMeta(): array
    {
        if (! empty($this->cacheMeta)) {
            return $this->cacheMeta;
        }

        $ttl = $this->cacheTtl();

        return $this->buildCacheMeta(false, $ttl, null);
    }

    /**
     * @return (((array|int|mixed|null|string)[]|int)[]|bool|int|mixed|null|string)[][]
     *
     * @psalm-return array{profile: array{id: mixed, username: string, display_name: string, profile_type: null|string, is_verified: bool, followers_count: int, following_count: int, posts_count: int}, graph: array{followers: array{stored: int}, following: array{stored: int}, close_friends: array{count: int, recent_auto_memberships: array<int, array<string, mixed>>}}, lists: array{owned: array<int, array{id: mixed, community_group_id: int, name: string, type: string, visibility: string, entries_count: int}>}, communities: array{owned: array<int, array{id: mixed, uuid: string, name: string, slug: string, category: string, visibility: string, stats: array{members: int, lists: int, resources: int, events: int, live_rooms: int, close_friend_entries: int}}>, memberships: array<int, array{id: mixed, status: string, joined_via: string, approved_at: null|string, group: array{id: mixed, name: string, slug: string, visibility: string, category: string}, role: array{id: mixed, name: string, slug: string, hierarchy_level: int}|null}>, managed: array<int, array{community_membership_id: mixed, group: array{id: mixed, name: string, slug: string}, role: array{name: string, slug: string}|null}>}, mentorship: array{cohorts: array<int, array{membership_id: mixed, role: string, status: string, joined_at: null|string, cohort: array{id: mixed, name: string, slug: string, status: string, focus_area: null|string, starts_at: null|string, ends_at: null|string, group: array{id: mixed, name: string, slug: string}, program: array{id: mixed, name: mixed}|null}}>}, resources: array{uploaded_count: int, recent: array<int, array{id: mixed, title: string, resource_type: string, visibility: string, group: array{id: mixed, name: string, slug: string}, uploaded_at: null|string}>}, events: array{hosted_count: int, upcoming: array<int, array{id: mixed, title: string, event_type: string, starts_at: null|string, status: string, group: array{id: mixed, name: string, slug: string}}>}, live_rooms: array{hosted_count: int, scheduled: array<int, array{id: mixed, topic: string, room_type: string, state: string, starts_at: null|string, group: array{id: mixed, name: string, slug: string}, event: array{id: mixed, title: string, slug: string}|null}>}, invites: array{pending_count: int, items: array<int, array{id: mixed, token: string, source: string, recipient_email: null|string, recipient_phone: null|string, expires_at: null|string, group: array{id: mixed, name: string, slug: string}}>}}
     */
    protected function buildPayload(User $user): array
    {
        $profile = $user->socialProfile;

        if (! $profile) {
            throw new RuntimeException('User must own a social profile before accessing backbone data.');
        }

        $profile->loadMissing('profileable');

        $ownedGroups = CommunityGroup::query()
            ->where('owner_profile_id', $profile->getKey())
            ->withCount([
                'memberships as active_members_count' => fn ($query) => $query->where('status', 'active'),
                'lists as lists_count',
                'resources as resources_count',
                'events as events_count',
                'liveRooms as live_rooms_count',
            ])
            ->with(['closeFriendList' => fn ($query) => $query->withCount('entries')])
            ->orderBy('name')
            ->get();

        $memberships = CommunityMembership::query()
            ->with([
                'group:id,name,slug,visibility,category',
                'role:id,name,slug,hierarchy_level',
            ])
            ->where('social_profile_id', $profile->getKey())
            ->orderByDesc('id')
            ->get();

        $closeFriendLists = CommunityList::query()
            ->withCount('entries')
            ->where('owner_profile_id', $profile->getKey())
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        $autoFollowMemberships = CommunityMembership::query()
            ->with(['group:id,name,slug'])
            ->where('social_profile_id', $profile->getKey())
            ->where('joined_via', 'auto_follow')
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        $cohortMemberships = MentorshipCohortMember::query()
            ->with([
                'cohort:id,name,slug,status,community_group_id,mentorship_program_id,focus_area,starts_at,ends_at',
                'cohort.group:id,name,slug',
                'cohort.program:id,name',
            ])
            ->where('social_profile_id', $profile->getKey())
            ->orderByDesc('id')
            ->get();

        $resourceQuery = CommunityResource::query()
            ->where('uploaded_by_profile_id', $profile->getKey());
        $resourceCount = (clone $resourceQuery)->count();
        $recentResources = (clone $resourceQuery)
            ->with(['group:id,name,slug'])
            ->latest('id')
            ->limit(5)
            ->get();

        $eventQuery = CommunityEvent::query()
            ->where('created_by_profile_id', $profile->getKey());
        $eventCount = (clone $eventQuery)->count();
        $upcomingEvents = (clone $eventQuery)
            ->with(['group:id,name,slug'])
            ->orderBy('starts_at')
            ->limit(5)
            ->get();

        $liveRoomQuery = CommunityLiveRoom::query()
            ->where('host_profile_id', $profile->getKey());
        $liveRoomCount = (clone $liveRoomQuery)->count();
        $scheduledLiveRooms = (clone $liveRoomQuery)
            ->with([
                'group:id,name,slug',
                'event:id,title,slug',
            ])
            ->orderByDesc('starts_at')
            ->limit(5)
            ->get();

        $pendingInvites = CommunityInvite::query()
            ->with(['group:id,name,slug'])
            ->where(function ($query) use ($profile, $user) {
                $query->where('recipient_profile_id', $profile->getKey())
                    ->orWhere('sender_profile_id', $profile->getKey());

                if (! empty($user->email)) {
                    $query->orWhere('recipient_email', $user->email);
                }
            })
            ->where('status', 'pending')
            ->orderByDesc('id')
            ->limit(10)
            ->get();

        $closeFriendCount = SocialFollow::query()
            ->where('follower_id', $profile->getKey())
            ->where('is_close_friend', true)
            ->count();

        return [
            'profile' => [
                'id' => $profile->getKey(),
                'username' => $profile->username,
                'display_name' => $profile->display_name,
                'profile_type' => $profile->profile_type,
                'is_verified' => (bool) $profile->is_verified,
                'followers_count' => (int) $profile->followers_count,
                'following_count' => (int) $profile->following_count,
                'posts_count' => (int) $profile->posts_count,
            ],
            'graph' => [
                'followers' => [
                    'stored' => (int) $profile->followers_count,
                ],
                'following' => [
                    'stored' => (int) $profile->following_count,
                ],
                'close_friends' => [
                    'count' => $closeFriendCount,
                    'recent_auto_memberships' => $this->mapAutoFollowMemberships($autoFollowMemberships),
                ],
            ],
            'lists' => [
                'owned' => $closeFriendLists->map(function (CommunityList $list) {
                    return [
                        'id' => $list->getKey(),
                        'community_group_id' => $list->community_group_id,
                        'name' => $list->name,
                        'type' => $list->type,
                        'visibility' => $list->visibility,
                        'entries_count' => (int) $list->entries_count,
                    ];
                })->values()->all(),
            ],
            'communities' => [
                'owned' => $ownedGroups->map(function (CommunityGroup $group) {
                    return [
                        'id' => $group->getKey(),
                        'uuid' => $group->uuid,
                        'name' => $group->name,
                        'slug' => $group->slug,
                        'category' => $group->category,
                        'visibility' => $group->visibility,
                        'stats' => [
                            'members' => (int) $group->active_members_count,
                            'lists' => (int) $group->lists_count,
                            'resources' => (int) $group->resources_count,
                            'events' => (int) $group->events_count,
                            'live_rooms' => (int) $group->live_rooms_count,
                            'close_friend_entries' => (int) ($group->closeFriendList?->entries_count ?? 0),
                        ],
                    ];
                })->values()->all(),
                'memberships' => $memberships->map(function (CommunityMembership $membership) {
                    return [
                        'id' => $membership->getKey(),
                        'status' => $membership->status,
                        'joined_via' => $membership->joined_via,
                        'approved_at' => optional($membership->approved_at)?->toIso8601String(),
                        'group' => $membership->group ? [
                            'id' => $membership->group->getKey(),
                            'name' => $membership->group->name,
                            'slug' => $membership->group->slug,
                            'visibility' => $membership->group->visibility,
                            'category' => $membership->group->category,
                        ] : null,
                        'role' => $membership->role ? [
                            'id' => $membership->role->getKey(),
                            'name' => $membership->role->name,
                            'slug' => $membership->role->slug,
                            'hierarchy_level' => (int) $membership->role->hierarchy_level,
                        ] : null,
                    ];
                })->values()->all(),
                'managed' => $memberships->filter(function (CommunityMembership $membership) {
                    return (int) optional($membership->role)->hierarchy_level <= 10;
                })->map(function (CommunityMembership $membership) {
                    return [
                        'community_membership_id' => $membership->getKey(),
                        'group' => $membership->group ? [
                            'id' => $membership->group->getKey(),
                            'name' => $membership->group->name,
                            'slug' => $membership->group->slug,
                        ] : null,
                        'role' => $membership->role ? [
                            'name' => $membership->role->name,
                            'slug' => $membership->role->slug,
                        ] : null,
                    ];
                })->values()->all(),
            ],
            'mentorship' => [
                'cohorts' => $cohortMemberships->map(function (MentorshipCohortMember $member) {
                    $cohort = $member->cohort;

                    return [
                        'membership_id' => $member->getKey(),
                        'role' => $member->role,
                        'status' => $member->status,
                        'joined_at' => optional($member->joined_at)?->toIso8601String(),
                        'cohort' => $cohort ? [
                            'id' => $cohort->getKey(),
                            'name' => $cohort->name,
                            'slug' => $cohort->slug,
                            'status' => $cohort->status,
                            'focus_area' => $cohort->focus_area,
                            'starts_at' => optional($cohort->starts_at)?->toIso8601String(),
                            'ends_at' => optional($cohort->ends_at)?->toIso8601String(),
                            'group' => $cohort->group ? [
                                'id' => $cohort->group->getKey(),
                                'name' => $cohort->group->name,
                                'slug' => $cohort->group->slug,
                            ] : null,
                            'program' => $cohort->program ? [
                                'id' => $cohort->program->getKey(),
                                'name' => $cohort->program->name,
                            ] : null,
                        ] : null,
                    ];
                })->values()->all(),
            ],
            'resources' => [
                'uploaded_count' => $resourceCount,
                'recent' => $recentResources->map(function (CommunityResource $resource) {
                    return [
                        'id' => $resource->getKey(),
                        'title' => $resource->title,
                        'resource_type' => $resource->resource_type,
                        'visibility' => $resource->visibility,
                        'group' => $resource->group ? [
                            'id' => $resource->group->getKey(),
                            'name' => $resource->group->name,
                            'slug' => $resource->group->slug,
                        ] : null,
                        'uploaded_at' => optional($resource->created_at)?->toIso8601String(),
                    ];
                })->values()->all(),
            ],
            'events' => [
                'hosted_count' => $eventCount,
                'upcoming' => $upcomingEvents->map(function (CommunityEvent $event) {
                    return [
                        'id' => $event->getKey(),
                        'title' => $event->title,
                        'event_type' => $event->event_type,
                        'starts_at' => optional($event->starts_at)?->toIso8601String(),
                        'status' => $event->status,
                        'group' => $event->group ? [
                            'id' => $event->group->getKey(),
                            'name' => $event->group->name,
                            'slug' => $event->group->slug,
                        ] : null,
                    ];
                })->values()->all(),
            ],
            'live_rooms' => [
                'hosted_count' => $liveRoomCount,
                'scheduled' => $scheduledLiveRooms->map(function (CommunityLiveRoom $room) {
                    return [
                        'id' => $room->getKey(),
                        'topic' => $room->topic,
                        'room_type' => $room->room_type,
                        'state' => $room->state,
                        'starts_at' => optional($room->starts_at)?->toIso8601String(),
                        'group' => $room->group ? [
                            'id' => $room->group->getKey(),
                            'name' => $room->group->name,
                            'slug' => $room->group->slug,
                        ] : null,
                        'event' => $room->event ? [
                            'id' => $room->event->getKey(),
                            'title' => $room->event->title,
                            'slug' => $room->event->slug,
                        ] : null,
                    ];
                })->values()->all(),
            ],
            'invites' => [
                'pending_count' => $pendingInvites->count(),
                'items' => $pendingInvites->map(function (CommunityInvite $invite) {
                    return [
                        'id' => $invite->getKey(),
                        'token' => $invite->token,
                        'source' => $invite->source,
                        'recipient_email' => $invite->recipient_email,
                        'recipient_phone' => $invite->recipient_phone,
                        'expires_at' => optional($invite->expires_at)?->toIso8601String(),
                        'group' => $invite->group ? [
                            'id' => $invite->group->getKey(),
                            'name' => $invite->group->name,
                            'slug' => $invite->group->slug,
                        ] : null,
                    ];
                })->values()->all(),
            ],
        ];
    }

    protected function cacheKey(User $user): string
    {
        $prefix = config('social.backbone.cache_key_prefix', 'social_backbone:');

        return $prefix.$user->getKey();
    }

    /**
     * @psalm-return int<30, max>
     */
    protected function cacheTtl(): int
    {
        $ttl = (int) config('social.backbone.cache_ttl', 180);

        return max($ttl, 30);
    }

    /**
     * @return (bool|int|null|string)[]
     *
     * @psalm-return array{hit: bool, ttl: int, stored_at: null|string, expires_at: null|string}
     */
    protected function buildCacheMeta(bool $hit, int $ttl, ?Carbon $storedAt): array
    {
        $stored = $storedAt ? $storedAt->copy() : null;
        $expiresAt = $stored ? $stored->copy()->addSeconds($ttl) : null;

        return [
            'hit' => $hit,
            'ttl' => $ttl,
            'stored_at' => $stored?->toIso8601String(),
            'expires_at' => $expiresAt?->toIso8601String(),
        ];
    }

    /**
     * @param Collection<int, CommunityMembership>  $memberships
     *
     * @return ((mixed|string)[]|mixed|null|string)[][]
     *
     * @psalm-return array<int, array{membership_id: mixed, group: array{id: mixed, name: string, slug: string}, approved_at: null|string}>
     */
    protected function mapAutoFollowMemberships(Collection $memberships): array
    {
        return $memberships->map(function (CommunityMembership $membership) {
            return [
                'membership_id' => $membership->getKey(),
                'group' => $membership->group ? [
                    'id' => $membership->group->getKey(),
                    'name' => $membership->group->name,
                    'slug' => $membership->group->slug,
                ] : null,
                'approved_at' => optional($membership->approved_at)?->toIso8601String(),
            ];
        })->values()->all();
    }
}

