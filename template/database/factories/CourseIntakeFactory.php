<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\CourseIntake;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CourseIntake>
 */
final class CourseIntakeFactory extends Factory
{
    protected $model = CourseIntake::class;

    #[\Override]
    /**
     * @return ((int|string)[][]|CourseFactory|\DateTime|int|null|string)[]
     *
     * @psalm-return array{course_id: CourseFactory, start_on: \DateTime, apply_by: \DateTime, seats: int, scholarships: list{array{name: 'Equity scholarship', value_cents: int}}|null, status: 'open'}
     */
    public function definition(): array
    {
        $start = $this->faker->dateTimeBetween('now', '+6 months');

        return [
            'course_id' => Course::factory(),
            'start_on' => $start,
            'apply_by' => (clone $start)->modify('-2 weeks'),
            'seats' => $this->faker->numberBetween(10, 60),
            'scholarships' => $this->faker->boolean(40) ? [
                [
                    'name' => 'Equity scholarship',
                    'value_cents' => $this->faker->numberBetween(50000, 300000),
                ],
            ] : null,
            'status' => 'open',
        ];
    }
}
