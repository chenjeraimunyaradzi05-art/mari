<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PostFactory extends Factory
{
    public function definition(): array
    {
        return [
            'body' => $this->faker->sentence(),
            'media_type' => 'none',
            'visibility' => 'public',
        ];
    }
}
