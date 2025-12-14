<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\RealEstateLearningPath;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

final class RealEstateLearningPathFactory extends Factory
{
    protected $model = RealEstateLearningPath::class;

    #[\Override]
    /**
     * @return ((array|string)[]|bool|int|mixed|string)[]
     *
     * @psalm-return array{title: string, slug: string, path_type: mixed, difficulty_level: mixed, duration_weeks: int, modules: list{array{title: string, summary: string}, array{title: string, summary: string}}, associated_courses: list{array{title: 'Partner lender clinics', url: string}}, ai_guided: bool, outcomes: array{confidence: string, skills: array|string}, summary: string}
     */
    public function definition(): array
    {
        $title = 'WomenRise ' . Str::title($this->faker->unique()->words(3, true));

        return [
            'title' => $title,
            'slug' => Str::slug($title) . '-' . $this->faker->unique()->lexify('???'),
            'path_type' => $this->faker->randomElement(['buy_first_home', 'buy_investment', 'become_agent', 'property_development']),
            'difficulty_level' => $this->faker->randomElement(['starter', 'intermediate', 'advanced']),
            'duration_weeks' => $this->faker->numberBetween(4, 16),
            'modules' => [
                [
                    'title' => $this->faker->sentence(3),
                    'summary' => $this->faker->sentence(12),
                ],
                [
                    'title' => $this->faker->sentence(3),
                    'summary' => $this->faker->sentence(10),
                ],
            ],
            'associated_courses' => [
                [
                    'title' => 'Partner lender clinics',
                    'url' => $this->faker->url(),
                ],
            ],
            'ai_guided' => $this->faker->boolean(80),
            'outcomes' => [
                'confidence' => $this->faker->sentence(6),
                'skills' => $this->faker->words(3),
            ],
            'summary' => $this->faker->paragraph(3),
        ];
    }
}

