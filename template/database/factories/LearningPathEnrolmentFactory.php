<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\LearningPathEnrolment;
use App\Models\RealEstateLearningPath;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class LearningPathEnrolmentFactory extends Factory
{
    protected $model = LearningPathEnrolment::class;

    #[\Override]
    /**
     * @return (RealEstateLearningPathFactory|UserFactory|\DateTime|int|mixed|string)[]
     *
     * @psalm-return array{real_estate_learning_path_id: RealEstateLearningPathFactory, user_id: UserFactory, enrolment_status: mixed, progress_percent: int, notes: string, last_ai_check_in_at: \DateTime}
     */
    public function definition(): array
    {
        return [
            'real_estate_learning_path_id' => RealEstateLearningPath::factory(),
            'user_id' => User::factory(),
            'enrolment_status' => $this->faker->randomElement(['active', 'completed', 'dropped']),
            'progress_percent' => $this->faker->numberBetween(0, 100),
            'notes' => $this->faker->optional()->sentence(10),
            'last_ai_check_in_at' => $this->faker->optional()->dateTimeBetween('-2 weeks', 'now'),
        ];
    }
}

