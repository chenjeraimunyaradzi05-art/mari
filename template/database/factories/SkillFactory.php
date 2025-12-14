<?php

namespace Database\Factories;

use App\Models\Skill;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\Skill>
 */
final class SkillFactory extends Factory
{
    protected $model = Skill::class;

    #[\Override]
    public function definition(): array
    {
        $name = $this->faker->unique()->jobTitle();

        return [
            'name' => $name,
            'slug' => Str::slug($name),
        ];
    }
}
