<?php

namespace Database\Factories;

use App\Models\GrantProgram;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GrantProgram>
 */
final class GrantProgramFactory extends Factory
{
    protected $model = GrantProgram::class;

    #[\Override]
    /**
     * @return (\Illuminate\Support\Carbon|int|mixed|string|string[])[]
     *
     * @psalm-return array{slug: string, name: string, provider_name: string, provider_type: mixed, location_restriction: mixed, max_amount_cents: int, currency: 'AUD', opens_at: \Illuminate\Support\Carbon, closes_at: \Illuminate\Support\Carbon, decision_at: \Illuminate\Support\Carbon, application_url: string, description: string, required_documents: list{'id', 'business_plan'}, eligibility_requirements: list{'women_led', 'australian_based'}, tags: list{'grant', 'women'}, match_score: int, states: list{'NSW', 'VIC'}}
     */
    public function definition(): array
    {
        $name = $this->faker->sentence(3);

        return [
            'slug' => Str::slug($name.'-'.$this->faker->unique()->numberBetween(100, 999)),
            'name' => $name,
            'provider_name' => $this->faker->company(),
            'provider_type' => $this->faker->randomElement(['federal', 'state', 'corporate']),
            'location_restriction' => $this->faker->randomElement([null, 'AU', 'NSW', 'VIC']),
            'max_amount_cents' => $this->faker->numberBetween(500000, 5000000),
            'currency' => 'AUD',
            'opens_at' => now()->subWeeks(1),
            'closes_at' => now()->addWeeks($this->faker->numberBetween(1, 8)),
            'decision_at' => now()->addWeeks($this->faker->numberBetween(8, 16)),
            'application_url' => $this->faker->url(),
            'description' => $this->faker->paragraph(3),
            'required_documents' => ['id', 'business_plan'],
            'eligibility_requirements' => ['women_led', 'australian_based'],
            'tags' => ['grant', 'women'],
            'match_score' => $this->faker->numberBetween(60, 95),
            'states' => ['NSW', 'VIC'],
        ];
    }
}
