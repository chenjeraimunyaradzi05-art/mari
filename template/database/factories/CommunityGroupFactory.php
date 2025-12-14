<?php

namespace Database\Factories;

use App\Models\CommunityGroup;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\CommunityGroup>
 */
final class CommunityGroupFactory extends Factory
{
    protected $model = CommunityGroup::class;

    #[\Override]
    /**
     * @return (SocialProfileFactory|array|false|int|mixed|null|string)[]
     *
     * @psalm-return array{uuid: string, owner_profile_id: SocialProfileFactory, owner_user_id: null, name: array|string, slug: string, tagline: string, category: mixed, visibility: 'public', access_model: 'open', focus_areas: list{string}, region_scope: mixed, requires_verification: false, member_limit: null, followers_count: 0, close_friends_count: 0, metadata: array<never, never>}
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->words(3, true);

        return [
            'uuid' => (string) Str::uuid(),
            'owner_profile_id' => SocialProfile::factory(),
            'owner_user_id' => null,
            'name' => $name,
            'slug' => Str::slug($name).'-'.$this->faker->unique()->randomDigit(),
            'tagline' => $this->faker->sentence(6),
            'category' => $this->faker->randomElement(['industry', 'geographic', 'program']),
            'visibility' => 'public',
            'access_model' => 'open',
            'focus_areas' => [$this->faker->word()],
            'region_scope' => $this->faker->randomElement(['NSW', 'VIC', 'QLD', null]),
            'requires_verification' => false,
            'member_limit' => null,
            'followers_count' => 0,
            'close_friends_count' => 0,
            'metadata' => [],
        ];
    }

    #[\Override]
    public function configure(): static
    {
        return $this->afterMaking(function (CommunityGroup $group): void {
            if (! $group->owner_user_id) {
                $group->owner_user_id = $group->ownerProfile?->resolveOwnerUser()?->getKey();
            }
        })->afterCreating(function (CommunityGroup $group): void {
            if (! $group->owner_user_id) {
                $group->forceFill([
                    'owner_user_id' => $group->ownerProfile?->resolveOwnerUser()?->getKey(),
                ])->save();
            }
        });
    }
}

