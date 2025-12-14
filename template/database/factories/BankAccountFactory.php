<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\BankAccount>
 */
final class BankAccountFactory extends Factory
{
    protected $model = BankAccount::class;

    #[\Override]
    /**
     * @return ((bool|string)[]|UserFactory|\Illuminate\Support\Carbon|mixed|string)[]
     *
     * @psalm-return array{user_id: UserFactory, institution: mixed, account_name: string, account_number_mask: string, account_type: mixed, currency: 'AUD', last_synced_at: \Illuminate\Support\Carbon, metadata: array{primary: bool, branch: string}}
     */
    public function definition(): array
    {
        $accountSuffix = str_pad((string) $this->faker->numberBetween(0, 9999), 4, '0', STR_PAD_LEFT);

        return [
            'user_id' => User::factory(),
            'institution' => $this->faker->randomElement(['Athena Bank', 'NAB', 'ANZ', 'Westpac', 'CBA']),
            'account_name' => $this->faker->randomElement(['Everyday', 'Savings', 'Sole Trader']).' '.$this->faker->word(),
            'account_number_mask' => sprintf('***%s', $accountSuffix),
            'account_type' => $this->faker->randomElement(['transaction', 'savings', 'business']),
            'currency' => 'AUD',
            'last_synced_at' => now()->subMinutes($this->faker->numberBetween(0, 720)),
            'metadata' => [
                'primary' => $this->faker->boolean(),
                'branch' => $this->faker->city(),
            ],
        ];
    }
}
