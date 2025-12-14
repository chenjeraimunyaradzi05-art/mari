<?php

namespace App\Services;

use App\Models\CommunityGroup;
use App\Models\CommunityList;
use App\Models\CommunityMembership;
use App\Models\CommunityRole;
use App\Models\SocialFollow;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class CommunityMembershipService
{
    public function bootstrap(CommunityGroup $group, SocialProfile $ownerProfile): void
    {
        DB::transaction(function () use ($group, $ownerProfile): void {
            $roles = $this->ensureDefaultRoles($group);

            $ownerRole = $roles->firstWhere('slug', 'owner');
            if (! $ownerRole) {
                throw new RuntimeException('Owner role missing.');
            }

            CommunityMembership::updateOrCreate(
                ['community_group_id' => $group->getKey(), 'social_profile_id' => $ownerProfile->getKey()],
                [
                    'community_role_id' => $ownerRole->getKey(),
                    'status' => 'active',
                    'joined_via' => 'organic',
                    'approved_at' => now(),
                ]
            );

            $closeFriendsList = $group->closeFriendList()->firstOrCreate([
                'community_group_id' => $group->getKey(),
                'slug' => 'close-friends-'.$group->getKey(),
            ], [
                'owner_profile_id' => $ownerProfile->getKey(),
                'name' => 'Close Friends',
                'type' => 'close_friends',
                'visibility' => 'private',
            ]);

            $this->syncCloseFriendList($group, $ownerProfile, $closeFriendsList);
        });
    }

    /**
     * @psalm-return EloquentCollection<int<0, 3>, mixed>
     */
    public function ensureDefaultRoles(CommunityGroup $group): EloquentCollection
    {
        $defaults = collect([
            [
                'name' => 'Owner',
                'slug' => 'owner',
                'hierarchy_level' => 1,
                'permissions' => ['*'],
            ],
            [
                'name' => 'Chapter Lead',
                'slug' => 'chapter-lead',
                'hierarchy_level' => 10,
                'permissions' => ['manage_chapters', 'manage_events', 'manage_resources'],
            ],
            [
                'name' => 'Moderator',
                'slug' => 'moderator',
                'hierarchy_level' => 20,
                'permissions' => ['manage_members', 'moderate_discussions'],
            ],
            [
                'name' => 'Member',
                'slug' => 'member',
                'hierarchy_level' => 50,
                'permissions' => [],
                'is_default' => true,
            ],
        ]);

        $roles = $defaults->map(function (array $definition) use ($group) {
            return CommunityRole::updateOrCreate(
                [
                    'community_group_id' => $group->getKey(),
                    'slug' => $definition['slug'],
                ],
                [
                    'name' => $definition['name'],
                    'scope' => Arr::get($definition, 'scope', 'group'),
                    'hierarchy_level' => $definition['hierarchy_level'],
                    'permissions' => $definition['permissions'],
                    'is_default' => Arr::get($definition, 'is_default', false),
                ]
            );
        });

        return new EloquentCollection($roles);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function addMember(CommunityGroup $group, SocialProfile $profile, array $attributes = []): CommunityMembership
    {
        $defaultRoleId = $group->roles()->where('slug', 'member')->value('id');

        return DB::transaction(function () use ($group, $profile, $attributes, $defaultRoleId) {
            $membership = CommunityMembership::updateOrCreate(
                [
                    'community_group_id' => $group->getKey(),
                    'social_profile_id' => $profile->getKey(),
                ],
                array_merge([
                    'community_role_id' => $attributes['community_role_id'] ?? $defaultRoleId,
                    'status' => $attributes['status'] ?? 'pending',
                    'joined_via' => $attributes['joined_via'] ?? 'organic',
                    'approved_at' => $attributes['approved_at'] ?? null,
                    'source_follow_id' => $attributes['source_follow_id'] ?? null,
                ], Arr::only($attributes, ['invited_by_profile_id', 'community_chapter_id']))
            );

            if ($membership->status === 'active' && ! $membership->approved_at) {
                $membership->forceFill(['approved_at' => now()])->save();
            }

            return $membership;
        });
    }

    public function syncCloseFriendList(CommunityGroup $group, ?SocialProfile $sourceProfile = null, ?CommunityList $list = null): CommunityList
    {
        $ownerProfile = $sourceProfile ?? $group->ownerProfile;
        if (! $ownerProfile) {
            throw new RuntimeException('Owner profile is required to sync close friends.');
        }

        $list ??= $group->closeFriendList()->firstOrCreate([
            'community_group_id' => $group->getKey(),
            'type' => 'close_friends',
        ], [
            'owner_profile_id' => $ownerProfile->getKey(),
            'name' => 'Close Friends',
            'slug' => 'close-friends-'.Str::slug($group->slug ?: $group->uuid),
            'visibility' => 'private',
        ]);

        $closeFriendFollows = SocialFollow::query()
            ->with('following')
            ->where('follower_id', $ownerProfile->getKey())
            ->where('is_close_friend', true)
            ->get();

        $followProfileIds = $closeFriendFollows->pluck('following_id')->all();

        $list->entries()
            ->whereNotIn('social_profile_id', $followProfileIds)
            ->delete();

        foreach ($closeFriendFollows as $follow) {
            $friendProfile = $follow->following;
            if (! $friendProfile) {
                continue;
            }

            $list->entries()->updateOrCreate(
                [
                    'community_list_id' => $list->getKey(),
                    'social_profile_id' => $friendProfile->getKey(),
                ],
                [
                    'source' => 'follow_graph',
                    'added_by_profile_id' => $ownerProfile->getKey(),
                ]
            );

            $this->addMember($group, $friendProfile, [
                'joined_via' => 'auto_follow',
                'status' => 'active',
                'approved_at' => now(),
                'source_follow_id' => $follow->getKey(),
            ]);
        }

        $group->update(['close_friends_count' => count($followProfileIds)]);

        return $list->refresh();
    }
}

