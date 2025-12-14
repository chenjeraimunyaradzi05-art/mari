<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenCohortProfile>
 */
final class WomenCohortProfileFactory extends Factory
{
	protected $model = WomenCohortProfile::class;

	#[\Override]
	public function definition(): array
	{
		return [
			'user_id' => User::factory(),
			'persona' => $this->faker->randomElement(CohortPersona::cases())->value,
			'financial_profile' => null,
			'education_profile' => null,
			'ai_insights' => null,
			'preferences' => null,
		];
	}

	public function persona(string $persona): self
	{
		return $this->state(fn (array $attrs) => ['persona' => $persona]);
	}
}

