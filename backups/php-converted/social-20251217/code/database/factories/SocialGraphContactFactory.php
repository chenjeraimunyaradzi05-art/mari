<?php

namespace Database\Factories;

use App\Models\SocialGraphContact;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SocialGraphContact>
 */
final class SocialGraphContactFactory extends Factory
{
    protected $model = SocialGraphContact::class;

    #[\Override]
    /**
     * @return (UserFactory|\DateTime|int|string)[]
     *
     * @psalm-return array{user_id: UserFactory, contact_hash: string, full_name: string, email: string, normalized_email: string, source: 'address_book', relationship_strength: int, last_interacted_at: \DateTime, consent_granted_at: \DateTime, consent_method: 'import'}
     */
    public function definition(): array
    {
        $fullName = $this->faker->name();
        $email = $this->faker->unique()->safeEmail();

        return [
            'user_id' => User::factory(),
            'contact_hash' => hash('sha256', Str::uuid()->toString()),
            'full_name' => $fullName,
            'email' => $email,
            'normalized_email' => strtolower($email),
            'source' => 'address_book',
            'relationship_strength' => $this->faker->numberBetween(10, 90),
            'last_interacted_at' => $this->faker->dateTimeBetween('-30 days', 'now'),
            'consent_granted_at' => $this->faker->optional()->dateTimeBetween('-2 months', 'now'),
            'consent_method' => 'import',
        ];
    }
}
