<?php

namespace Database\Factories;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Candidate>
 */
final class CandidateFactory extends Factory
{
    protected $model = Candidate::class;

    #[\Override]
    /**
     * @return (UserFactory|mixed|null|string)[]
     *
     * @psalm-return array{user_id: UserFactory, full_name: string, email: string, phone_one: string, phone_two: string, bio: string, country: null, state: null, city: null, address: string, status: mixed}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'full_name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'phone_one' => $this->faker->phoneNumber(),
            'phone_two' => $this->faker->optional()->phoneNumber(),
            'bio' => $this->faker->optional()->paragraph(),
            'country' => null,
            'state' => null,
            'city' => null,
            'address' => $this->faker->optional()->address(),
            // DB enum expects 'available' or 'not_available'
            'status' => $this->faker->randomElement(['available', 'not_available']),
        ];
    }
}
