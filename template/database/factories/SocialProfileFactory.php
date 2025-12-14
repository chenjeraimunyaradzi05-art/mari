<?php

namespace Database\Factories;

use App\Models\Candidate;
use App\Models\Company;
use App\Models\OrganizationPage;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Arr;

/**
 * @extends Factory<\App\Models\SocialProfile>
 */
final class SocialProfileFactory extends Factory
{
    protected $model = SocialProfile::class;

    #[\Override]
    /**
     * @return (CandidateFactory|array|bool|int|null|string)[]
     *
     * @psalm-return array{profileable_type: Candidate::class, profileable_id: CandidateFactory, user_id: null, username: string, display_name: string, bio: array|string, avatar: string, cover_photo: string, website: string, social_links: array{website: string, linkedin: string, toggles: array{mentor_mode: false, mentee_mode: false, office_hours_open: false}}, profile_type: 'candidate', is_verified: bool, is_private: bool, followers_count: 0, following_count: 0, posts_count: 0}
     */
    public function definition(): array
    {
        return [
            'profileable_type' => Candidate::class,
            'profileable_id' => Candidate::factory(),
            'user_id' => null,
            'username' => $this->faker->unique()->userName(),
            'display_name' => $this->faker->name(),
            'bio' => $this->faker->sentences(2, true),
            'avatar' => $this->faker->imageUrl(200, 200, 'people'),
            'cover_photo' => $this->faker->imageUrl(800, 200, 'business'),
            'website' => $this->faker->optional()->url(),
            'social_links' => [
                'website' => $this->faker->optional()->url(),
                'linkedin' => 'https://www.linkedin.com/in/'.$this->faker->unique()->userName(),
                'toggles' => [
                    'mentor_mode' => false,
                    'mentee_mode' => false,
                    'office_hours_open' => false,
                ],
            ],
            'profile_type' => 'candidate',
            'is_verified' => $this->faker->boolean(15),
            'is_private' => $this->faker->boolean(10),
            'followers_count' => 0,
            'following_count' => 0,
            'posts_count' => 0,
        ];
    }

    public function candidateProfile(): static
    {
        return $this->state(function () {
            return [
                'profile_type' => 'candidate',
                'profileable_type' => Candidate::class,
                'profileable_id' => Candidate::factory(),
            ];
        });
    }

    public function companyProfile(): static
    {
        return $this->state(function () {
            return [
                'profile_type' => 'company',
                'profileable_type' => Company::class,
                'profileable_id' => Company::factory(),
            ];
        });
    }

    // removed unused helper: applyMentorToggles
}
