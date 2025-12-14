<?php

namespace Database\Factories;

use App\Models\DreamJobAlert;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class DreamJobAlertFactory extends Factory
{
    protected $model = DreamJobAlert::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'job_title' => $this->faker->jobTitle(),
            'industry' => $this->faker->word(),
            'location' => $this->faker->city(),
            'min_salary' => $this->faker->randomFloat(2, 35000, 120000),
            'required_skills' => [$this->faker->word()],
            'employment_type' => $this->faker->randomElement(['full_time','part_time','contract']),
            'is_active' => true,
        ];
    }
}
