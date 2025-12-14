<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ListingPartnershipIntention;
use App\Models\PartnershipMatch;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class PartnershipMatchFactory extends Factory
{
    protected $model = PartnershipMatch::class;

    #[\Override]
    /**
     * @return (ListingPartnershipIntentionFactory|UserFactory|float|mixed|string)[]
     *
     * @psalm-return array{listing_partnership_intention_id: ListingPartnershipIntentionFactory, counterparty_user_id: UserFactory, match_score: float, ai_explanation: string, status: mixed, action_required_by: mixed}
     */
    public function definition(): array
    {
        return [
            'listing_partnership_intention_id' => ListingPartnershipIntention::factory(),
            'counterparty_user_id' => User::factory(),
            'match_score' => $this->faker->randomFloat(2, 0, 1),
            'ai_explanation' => $this->faker->optional()->paragraph(),
            'status' => $this->faker->randomElement(['requested', 'accepted', 'declined']),
            'action_required_by' => $this->faker->optional()->randomElement(['initiator', 'counterparty']),
        ];
    }
}

