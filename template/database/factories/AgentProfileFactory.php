<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\AgentProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class AgentProfileFactory extends Factory
{
    protected $model = AgentProfile::class;

    #[\Override]
    /**
     * @return (UserFactory|array|int|mixed|null|string)[]
     *
     * @psalm-return array{user_id: UserFactory, social_profile_id: null, headline: string, bio: string, experience_years: int, transaction_focus: array, service_regions: array, availability_status: mixed, calendly_url: null, video_pitch_url: null}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'social_profile_id' => null,
            'headline' => $this->faker->sentence(6),
            'bio' => $this->faker->paragraph(),
            'experience_years' => $this->faker->numberBetween(0, 25),
            'transaction_focus' => $this->faker->randomElements([
                'rentals', 'first_home', 'investments', 'developments', 'mentor'
            ], $this->faker->numberBetween(1, 3)),
            'service_regions' => $this->faker->randomElements([
                'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'
            ], $this->faker->numberBetween(1, 3)),
            'availability_status' => $this->faker->randomElement(['available', 'waitlist', 'offline']),
            'calendly_url' => null,
            'video_pitch_url' => null,
        ];
    }
}

