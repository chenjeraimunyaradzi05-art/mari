<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\User;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenVerifiedAgent>
 */
final class WomenVerifiedAgentFactory extends Factory
{
	protected $model = WomenVerifiedAgent::class;

	#[\Override]
	public function definition(): array
	{
		return [
			'user_id' => User::factory(),
			'license_number' => 'LIC-' . $this->faker->bothify('###-###'),
			'license_expires_at' => $this->faker->optional()->dateTimeBetween('+1 month', '+5 years'),
			'regulator' => $this->faker->company(),
			'status' => 'active',
			'verification_stage' => VerificationStage::APPROVED->value,
			'trust_badge_level' => $this->faker->numberBetween(0, 3),
			'compliance_score' => $this->faker->randomFloat(2, 0, 100),
			'verification_payload' => null,
			'verified_at' => null,
		];
	}

	public function verified(): self
	{
		return $this->state(fn (array $attrs) => [
			'status' => 'active',
			'verification_stage' => VerificationStage::APPROVED->value,
			'verified_at' => now(),
		]);
	}

	public function pending(): self
	{
		return $this->state(fn (array $attrs) => [
			'status' => 'pending',
			'verification_stage' => \App\Enums\WomenRealEstate\VerificationStage::INITIAL->value,
			'verified_at' => null,
		]);
	}
}
