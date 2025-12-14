<?php

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\GoalType;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenGoalTracker;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenGoalTracker>
 */
final class WomenGoalTrackerFactory extends Factory
{
	protected $model = WomenGoalTracker::class;

	#[\Override]
	public function definition(): array
	{
		$target = $this->faker->randomFloat(2, 1000, 50000);
		$current = $this->faker->randomFloat(2, 0, $target);

		return [
			'profile_id' => WomenCohortProfile::factory(),
			'goal_type' => $this->faker->randomElement(GoalType::cases())->value,
			'target_amount' => $target,
			'current_amount' => $current,
			'progress_percent' => $target > 0 ? round(($current / $target) * 100, 2) : 0,
			'due_at' => $this->faker->optional()->dateTimeBetween('+7 days', '+1 year'),
			'ai_nudges' => [
				'Keep tracking progress regularly.',
				'Review budget and re-prioritise contributions as needed.',
			],
		];
	}
}

