<?php

namespace Database\Factories;

use App\Models\SocialIntegration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SocialIntegration>
 */
final class SocialIntegrationFactory extends Factory
{
    protected $model = SocialIntegration::class;

    #[\Override]
    /**
     * @return ((false|string)[]|UserFactory|\Illuminate\Support\Carbon|mixed|string)[]
     *
     * @psalm-return array{user_id: UserFactory, provider: mixed, status: 'connected', scopes: list{'basic'}, tokens: array{access_token: string}, settings: array{auto_share: false}, connected_at: \Illuminate\Support\Carbon, last_synced_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'provider' => $this->faker->randomElement(['facebook', 'instagram', 'x', 'threads']),
            'status' => 'connected',
            'scopes' => ['basic'],
            'tokens' => [
                'access_token' => Str::random(32),
            ],
            'settings' => ['auto_share' => false],
            'connected_at' => now(),
            'last_synced_at' => now(),
        ];
    }
}

