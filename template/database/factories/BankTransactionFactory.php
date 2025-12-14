<?php

namespace Database\Factories;

use App\Models\BankTransaction;
use App\Models\BankAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\BankTransaction>
 */
final class BankTransactionFactory extends Factory
{
    protected $model = BankTransaction::class;

    #[\Override]
    /**
     * @return (((float|string)[]|string)[]|BankAccountFactory|UserFactory|\DateTime|bool|int|mixed|null|string)[]
     *
     * @psalm-return array{bank_account_id: BankAccountFactory, user_id: UserFactory, posted_at: \DateTime, description: string, reference: string, amount_cents: int, direction: mixed, status: mixed, category_key: mixed, ai_suggestions: list{array{label: 'software', confidence: float}, array{label: 'operations', confidence: float}}, is_flagged: bool, reviewed_at: null, metadata: array{import_id: string}}
     */
    public function definition(): array
    {
        $direction = $this->faker->randomElement(['credit', 'debit']);
        $amountCents = $this->faker->numberBetween(5_000, 120_000);

        return [
            'bank_account_id' => BankAccount::factory(),
            'user_id' => User::factory(),
            'posted_at' => $this->faker->dateTimeBetween('-45 days', 'now'),
            'description' => $this->faker->company(),
            'reference' => strtoupper($this->faker->bothify('REF####')),
            'amount_cents' => $amountCents,
            'direction' => $direction,
            'status' => $this->faker->randomElement([
                BankTransaction::STATUS_PENDING,
                BankTransaction::STATUS_MATCHED,
                BankTransaction::STATUS_EXCLUDED,
            ]),
            'category_key' => $this->faker->randomElement([null, 'software', 'subscriptions', 'travel', 'payroll']),
            'ai_suggestions' => [
                ['label' => 'software', 'confidence' => 0.71],
                ['label' => 'operations', 'confidence' => 0.42],
            ],
            'is_flagged' => $this->faker->boolean(15),
            'reviewed_at' => null,
            'metadata' => [
                'import_id' => $this->faker->uuid(),
            ],
        ];
    }
}
