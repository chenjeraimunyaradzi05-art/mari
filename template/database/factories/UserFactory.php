<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

final class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition()
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'password' => bcrypt('password'),
            'role' => 'member',
            'primary_role' => 'member',
            'account_classification' => 'member',
            'email_verified_at' => now(),
            'first_login' => false,
            'onboarding_completed' => true,
            'profile_completion_percentage' => 100,
            'profile_completed' => true,
            'user_intentions' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified()
    {
        return $this->state(function (array $attributes) {
            return [
                'email_verified_at' => null,
            ];
        });
    }
}
