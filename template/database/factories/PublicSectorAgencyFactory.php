<?php

namespace Database\Factories;

use App\Models\PublicSectorAgency;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\PublicSectorAgency>
 */
final class PublicSectorAgencyFactory extends Factory
{
    protected $model = PublicSectorAgency::class;

    #[\Override]
    /**
     * @return (array|int|mixed|null|string)[]
     *
     * @psalm-return array{name: string, slug: string, tagline: string, category: mixed, hq_city: string, hq_country: 'Australia', hero_image: null, primary_contact: string, contact_email: string, focus_areas: array, service_regions: list{mixed}, social_handles: array{linkedin: string}, impact_score: int, status: 'active', summary: string, ai_summary: null}
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->company.' Civic Office';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.$this->faker->unique()->lexify('??'),
            'tagline' => $this->faker->sentence(8),
            'category' => $this->faker->randomElement(['federal', 'state', 'local']),
            'hq_city' => $this->faker->city(),
            'hq_country' => 'Australia',
            'hero_image' => null,
            'primary_contact' => $this->faker->name(),
            'contact_email' => $this->faker->unique()->safeEmail(),
            'focus_areas' => $this->faker->randomElements([
                'climate', 'infrastructure', 'health', 'education', 'justice', 'regional',
            ], 3),
            'service_regions' => [$this->faker->state()],
            'social_handles' => [
                'linkedin' => 'https://linkedin.com/company/'.$this->faker->slug(),
            ],
            'impact_score' => $this->faker->numberBetween(60, 95),
            'status' => 'active',
            'summary' => $this->faker->paragraph(),
            'ai_summary' => null,
        ];
    }
}
