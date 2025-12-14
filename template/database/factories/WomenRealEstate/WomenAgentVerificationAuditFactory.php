<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenAgentVerificationAudit>
 */
final class WomenAgentVerificationAuditFactory extends Factory
{
	protected $model = WomenAgentVerificationAudit::class;

	#[\Override]
	public function definition(): array
	{
		return [
			'agent_id' => WomenVerifiedAgent::factory(),
			'reviewer_id' => User::factory(),
			'status_before' => 'pending',
			'status_after' => 'approved',
			'notes' => ['note' => $this->faker->sentence()],
			'ai_summary' => null,
		];
	}
}

