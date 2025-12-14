<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerProjectStatus;
use App\Models\User;
use App\Models\WomenRealEstate\WomenPartnerProject;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenPartnerProject>
 */
final class WomenPartnerProjectFactory extends Factory
{
	protected $model = WomenPartnerProject::class;

	#[\Override]
	public function definition(): array
	{
		$title = $this->faker->sentence(4);

		return [
			'owner_id' => User::factory(),
			'title' => $title,
			'slug' => Str::slug($title) . '-' . Str::random(6),
			'status' => PartnerProjectStatus::DRAFT->value,
			'summary' => $this->faker->sentence(),
			'capital_stack' => null,
			'ai_insights' => null,
			'target_launch_at' => null,
		];
	}

	public function active(): self
	{
		return $this->state(fn (array $attrs) => [
			'status' => PartnerProjectStatus::ACTIVE->value,
		]);
	}

	public function seekingPartners(): self
	{
		return $this->state(fn (array $attrs) => [
			'status' => PartnerProjectStatus::SEEKING_PARTNERS->value,
			'capital_stack' => null,
			'ai_insights' => null,
		]);
	}
}

