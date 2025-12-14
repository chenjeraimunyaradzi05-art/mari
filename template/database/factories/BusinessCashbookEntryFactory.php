<?php

namespace Database\Factories;

use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\BusinessCashbookEntry>
 */
final class BusinessCashbookEntryFactory extends Factory
{
    protected $model = BusinessCashbookEntry::class;

    #[\Override]
    /**
     * @return (BusinessCashbookFactory|\DateTime|array|bool|float|mixed|string)[]
     *
     * @psalm-return array{business_cashbook_id: BusinessCashbookFactory, date: \DateTime, entry_type: mixed, category: 'consulting'|'software', description: string, amount: float, is_tax_deductible: bool, metadata: array<never, never>}
     */
    public function definition(): array
    {
        $entryType = $this->faker->randomElement(['income', 'expense']);

        return [
            'business_cashbook_id' => BusinessCashbook::factory(),
            'date' => $this->faker->dateTimeBetween('-30 days', 'now'),
            'entry_type' => $entryType,
            'category' => $entryType === 'income' ? 'consulting' : 'software',
            'description' => $this->faker->sentence(6),
            'amount' => $this->faker->randomFloat(2, 25, 5000),
            'is_tax_deductible' => $entryType === 'expense' ? $this->faker->boolean(80) : false,
            'metadata' => [],
        ];
    }
}
