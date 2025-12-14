<?php

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPropertySeeker;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenPropertySeeker>
 */
final class WomenPropertySeekerFactory extends Factory
{
	protected $model = WomenPropertySeeker::class;

	#[\Override]
	public function definition(): array
	{
		$minBudget = $this->faker->optional()->numberBetween(50000, 250000);
		$maxBudget = $minBudget ? $minBudget + $this->faker->numberBetween(10000, 200000) : null;

		return [
			'user_id' => User::factory(),
			'seeker_type' => $this->faker->randomElement(['buyer', 'renter', 'investor']),
			'location_preferences' => ['suburb' => $this->faker->city()],
			'property_type_preferences' => ['house', 'apartment'],
			'min_budget' => $minBudget,
			'max_budget' => $maxBudget,
			'min_bedrooms' => $this->faker->optional()->numberBetween(1, 3),
			'max_bedrooms' => $this->faker->optional()->numberBetween(3, 6),
			'min_bathrooms' => $this->faker->optional()->numberBetween(1, 2),
			'max_bathrooms' => $this->faker->optional()->numberBetween(2, 4),
			'min_area' => null,
			'max_area' => null,
			'must_have_features' => null,
			'nice_to_have_features' => null,
			'furnishing_preference' => $this->faker->randomElement(['furnished', 'unfurnished', 'part_furnished']),
			'allows_pets' => $this->faker->boolean(50),
			'needs_parking' => $this->faker->boolean(60),
			'preferred_move_in_days' => $this->faker->optional()->numberBetween(0, 180),
			'financial_confidence' => $this->faker->optional()->numberBetween(1, 10),
			// must match DB enum: not_started, in_progress, preapproved, expired
			'mortgage_preapproval_status' => $this->faker->randomElement(['not_started', 'in_progress', 'preapproved', 'expired']),
			'property_goals' => null,
			'lifestyle_preferences' => null,
			'ai_profile' => null,
			'match_history' => null,
			'profile_completion_percentage' => $this->faker->numberBetween(30, 100),
			'total_views_received' => 0,
			'total_matches_found' => 0,
			'inquiries_sent' => 0,
			'is_active' => true,
		];
	}
}

