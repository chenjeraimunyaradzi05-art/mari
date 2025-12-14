<?php

namespace Database\Factories;

use App\Models\ContactSyncSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\ContactSyncSession>
 */
final class ContactSyncSessionFactory extends Factory
{
    protected $model = ContactSyncSession::class;

    #[\Override]
    /**
     * @return (UserFactory|mixed|string|string[])[]
     *
     * @psalm-return array{user_id: UserFactory, provider: mixed, status: 'pending', state_token: string, auth_url: 'https://example.test/oauth', metadata: array{scope: 'contacts.readonly'}}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'provider' => $this->faker->randomElement(['google', 'outlook']),
            'status' => 'pending',
            'state_token' => Str::uuid()->toString(),
            'auth_url' => 'https://example.test/oauth',
            'metadata' => ['scope' => 'contacts.readonly'],
        ];
    }
}
