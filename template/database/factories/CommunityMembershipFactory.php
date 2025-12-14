<?php

namespace Database\Factories;

use App\Models\CommunityGroup;
use App\Models\CommunityMembership;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\CommunityMembership>
 */
final class CommunityMembershipFactory extends Factory
{
    protected $model = CommunityMembership::class;

    #[\Override]
    /**
     * @return (CommunityGroupFactory|SocialProfileFactory|null|string)[]
     *
     * @psalm-return array{community_group_id: CommunityGroupFactory, community_chapter_id: null, community_role_id: null, social_profile_id: SocialProfileFactory, status: 'pending', joined_via: 'organic', approved_at: null, last_engaged_at: null}
     */
    public function definition(): array
    {
        return [
            'community_group_id' => CommunityGroup::factory(),
            'community_chapter_id' => null,
            'community_role_id' => null,
            'social_profile_id' => SocialProfile::factory(),
            'status' => 'pending',
            'joined_via' => 'organic',
            'approved_at' => null,
            'last_engaged_at' => null,
        ];
    }
}

