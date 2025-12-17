<?php

namespace Database\Factories;

use App\Models\GrantFilterPreset;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class GrantFilterPresetFactory extends Factory
{
    protected $model = GrantFilterPreset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'persona_key' => 'member',
            'name' => $this->faker->sentence(3),
            'filters' => [
                'type' => null,
                'provider' => null,
                'industry' => null,
                'state' => null,
                'q' => null,
                'women_only' => false,
                'closing_soon' => false,
            ],
            'notify_in_app' => false,
            'notify_email' => false,
        ];
    }
}
