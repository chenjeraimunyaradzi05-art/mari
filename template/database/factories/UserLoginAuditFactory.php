<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserLoginAudit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserLoginAudit>
 */
final class UserLoginAuditFactory extends Factory
{
    protected $model = UserLoginAudit::class;

    #[\Override]
    /**
     * @return (UserFactory|\Illuminate\Support\Carbon|int|null|string)[]
     *
     * @psalm-return array{user_id: UserFactory, source: 'web', timezone: string, offset_minutes: int, ip_address: string, user_agent: string, logged_in_at: \Illuminate\Support\Carbon, meta: null}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'source' => 'web',
            'timezone' => fake()->timezone(),
            'offset_minutes' => fake()->numberBetween(-720, 840),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'logged_in_at' => now(),
            'meta' => null,
        ];
    }
}

