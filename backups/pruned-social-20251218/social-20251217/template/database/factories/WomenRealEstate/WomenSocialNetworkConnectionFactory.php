<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenSocialNetworkConnection;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenSocialNetworkConnection>
 */
final class WomenSocialNetworkConnectionFactory extends Factory
{
    protected $model = WomenSocialNetworkConnection::class;

    #[\Override]
    /**
     * @return (\Database\Factories\UserFactory|mixed|null|string)[]
     *
     * @psalm-return array{user_id_1: \Database\Factories\UserFactory, user_id_2: \Database\Factories\UserFactory, connection_type: mixed, status: 'pending', message: string, connected_at: null}
     */
    public function definition(): array
    {
        return [
            'user_id_1' => User::factory(),
            'user_id_2' => User::factory(),
            'connection_type' => $this->faker->randomElement([
                'landlord_tenant',
                'renter_renter',
                'buyer_agent',
                'connected',
            ]),
            'status' => 'pending',
            'message' => $this->faker->sentence(),
            'connected_at' => null,
        ];
    }

    public function connected(): self
    {
        return $this->state(fn (array $attrs) => [
            'status' => 'connected',
            'connected_at' => now(),
            'connection_type' => 'connected',
        ]);
    }
}

