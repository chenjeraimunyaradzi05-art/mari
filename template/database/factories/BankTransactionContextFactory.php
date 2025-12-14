<?php

namespace Database\Factories;

use App\Models\BankTransactionContext;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\BankTransactionContext>
 */
final class BankTransactionContextFactory extends Factory
{
    protected $model = BankTransactionContext::class;

    #[\Override]
    /**
     * @return (((array|false|float|int|mixed|null|string)[]|false|string)[]|UserFactory|int|string)[]
     *
     * @psalm-return array{user_id: UserFactory, token: string, filters: array{status: 'pending', flagged: false, search: string}, selection_preview: list{array{id: int, description: string, posted_at: string, posted_at_display: string, amount: float, direction: mixed, status: 'pending', category: null, flagged: false, ai_suggestions: array<never, never>, account: 'Main Operating (Fictional Bank)'}}, selection_total: int, prompt: string, context_payload: string, surface: 'money_budget', context_key: 'bank-feed-triage'}
     */
    public function definition(): array
    {
        $token = (string) Str::uuid();

        return [
            'user_id' => User::factory(),
            'token' => $token,
            'filters' => [
                'status' => 'pending',
                'flagged' => false,
                'search' => $this->faker->word(),
            ],
            'selection_preview' => [[
                'id' => $this->faker->randomNumber(5),
                'description' => $this->faker->company(),
                'posted_at' => $this->faker->date(),
                'posted_at_display' => $this->faker->date('d M Y'),
                'amount' => $this->faker->randomFloat(2, 10, 500),
                'direction' => $this->faker->randomElement(['credit', 'debit']),
                'status' => 'pending',
                'category' => null,
                'flagged' => false,
                'ai_suggestions' => [],
                'account' => 'Main Operating (Fictional Bank)',
            ]],
            'selection_total' => $this->faker->numberBetween(1, 20),
            'prompt' => $this->faker->sentence(),
            'context_payload' => base64_encode(json_encode([
                'token' => $token,
                'selection_total' => 3,
            ], JSON_THROW_ON_ERROR)),
            'surface' => 'money_budget',
            'context_key' => 'bank-feed-triage',
        ];
    }
}
