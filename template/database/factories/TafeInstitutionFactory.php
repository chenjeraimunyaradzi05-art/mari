<?php

namespace Database\Factories;

use App\Models\TafeInstitution;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TafeInstitution>
 */
final class TafeInstitutionFactory extends Factory
{
    protected $model = TafeInstitution::class;

    #[\Override]
    /**
     * @return (UserFactory|\Illuminate\Support\Carbon|array|mixed|null|string)[]
     *
     * @psalm-return array{owner_user_id: UserFactory, name: string, slug: string, institution_type: mixed, tagline: mixed, summary: string, mission_statement: array|string, brand_color: string, hero_image: null, website_url: string, contact_email: string, contact_phone: string, location: array{state: mixed, city: string}, specialties: array, support_channels: array{email: string, phone: string}, ai_strengths: array, impact_metrics: array{graduates_supported: int, industry_partners: int}, status: 'live', published_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->company().' Institute';

        return [
            'owner_user_id' => User::factory(),
            'name' => $name,
            'slug' => Str::slug($name),
            'institution_type' => $this->faker->randomElement(['tafe', 'university', 'rto']),
            'tagline' => $this->faker->catchPhrase(),
            'summary' => $this->faker->paragraph(),
            'mission_statement' => $this->faker->paragraphs(2, true),
            'brand_color' => $this->faker->hexColor(),
            'hero_image' => null,
            'website_url' => $this->faker->url(),
            'contact_email' => $this->faker->unique()->companyEmail(),
            'contact_phone' => $this->faker->e164PhoneNumber(),
            'location' => [
                'state' => $this->faker->randomElement(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
                'city' => $this->faker->city(),
            ],
            'specialties' => $this->faker->randomElements([
                'climate-tech',
                'health-innovation',
                'advanced-manufacturing',
                'creative-industries',
                'ai-ops',
            ], 3),
            'support_channels' => [
                'email' => $this->faker->companyEmail(),
                'phone' => $this->faker->phoneNumber(),
            ],
            'ai_strengths' => $this->faker->randomElements([
                'personalised-learning',
                'coaching-ops',
                'skills-matching',
                'journey-orchestration',
            ], 2),
            'impact_metrics' => [
                'graduates_supported' => $this->faker->numberBetween(100, 5000),
                'industry_partners' => $this->faker->numberBetween(10, 120),
            ],
            'status' => 'live',
            'published_at' => now()->subDays($this->faker->numberBetween(5, 120)),
        ];
    }
}

