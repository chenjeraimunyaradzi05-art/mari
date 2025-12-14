<?php

namespace Database\Factories;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\Profile>
 */
final class ProfileFactory extends Factory
{
    protected $model = Profile::class;

    #[\Override]
    /**
     * @return (UserFactory|false|mixed|null|string|string[])[]
     *
     * @psalm-return array{user_id: UserFactory, social_profile_id: null, persona_type: mixed, display_name: string, handle: string, bio: string, avatar_path: null, cover_path: null, pronouns: mixed, location: string, gender: mixed, age_bracket: mixed, women_safety_mode: false, privacy_level: 'followers'|'private'|mixed, privacy_tier: 'invite_only'|'network'|'public', dm_policy: mixed, tag_policy: mixed, mention_policy: mixed, location_visibility: mixed, goals: array{career: 'level up'}, interests: array{wellness: 'yoga'}, skills: list{'communication', 'leadership'}, health_interests: list{'yoga', 'running'}, safety_overrides: null, is_primary: false, is_active: false, last_switched_at: null, switch_context: null}
     */
    public function definition(): array
    {
        $displayName = $this->faker->name();

        $privacyLevel = $this->faker->randomElement(Profile::PRIVACY_LEVELS);
        $privacyTier = match ($privacyLevel) {
            'followers' => 'network',
            'private' => 'invite_only',
            default => 'public',
        };

        return [
            'user_id' => User::factory(),
            'social_profile_id' => null,
            'persona_type' => $this->faker->randomElement(Profile::PERSONA_TYPES),
            'display_name' => $displayName,
            'handle' => Str::slug($displayName . '-' . $this->faker->unique()->numberBetween(1, 9999)),
            'bio' => $this->faker->sentence(12),
            'avatar_path' => null,
            'cover_path' => null,
            'pronouns' => $this->faker->randomElement(['she/her', 'he/him', 'they/them']),
            'location' => $this->faker->city(),
            'gender' => $this->faker->randomElement(['female', 'male', 'non-binary']),
            'age_bracket' => $this->faker->randomElement(Profile::AGE_BRACKETS),
            'women_safety_mode' => false,
            'privacy_level' => $privacyLevel,
            'privacy_tier' => $privacyTier,
            'dm_policy' => $this->faker->randomElement(Profile::POLICY_OPTIONS),
            'tag_policy' => $this->faker->randomElement(Profile::POLICY_OPTIONS),
            'mention_policy' => $this->faker->randomElement(Profile::POLICY_OPTIONS),
            'location_visibility' => $this->faker->randomElement(Profile::LOCATION_VISIBILITY),
            'goals' => ['career' => 'level up'],
            'interests' => ['wellness' => 'yoga'],
            'skills' => ['communication', 'leadership'],
            'health_interests' => ['yoga', 'running'],
            'safety_overrides' => null,
            'is_primary' => false,
            'is_active' => false,
            'last_switched_at' => null,
            'switch_context' => null,
        ];
    }
}
