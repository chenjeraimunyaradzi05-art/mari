<?php

namespace Database\Factories;

use App\Enums\OrganizationPageType;
use App\Models\Company;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrganizationPage>
 */
final class OrganizationPageFactory extends Factory
{
    protected $model = OrganizationPage::class;

    #[\Override]
    /**
     * @return (CompanyFactory|\Illuminate\Support\Carbon|array|string)[]
     *
     * @psalm-return array{company_id: CompanyFactory, type: 'employer', slug: string, name: string, tagline: string, about: string, mission: string, highlights: array<never, never>, policies: array<never, never>, profile_status: 'published', published_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $name = $this->faker->company();

        return [
            'company_id' => Company::factory(),
            'type' => OrganizationPageType::Employer->value,
            'slug' => Str::slug($name).'-'.$this->faker->unique()->numberBetween(1000, 9999),
            'name' => $name,
            'tagline' => $this->faker->sentence(8),
            'about' => $this->faker->paragraph(3),
            'mission' => $this->faker->paragraph(2),
            'highlights' => [],
            'policies' => [],
            'profile_status' => 'published',
            'published_at' => now(),
        ];
    }

    /**
     * Configure the factory for a 'university' persona to support tests
     * that expect persona metadata for educational providers.
     */
    public function university(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'type' => OrganizationPageType::University->value,
            ];
        });
    }
}
