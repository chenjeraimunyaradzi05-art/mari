<?php

namespace Database\Factories;

use App\Models\PublicSectorAgency;
use App\Models\PublicSectorOpportunity;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\PublicSectorOpportunity>
 */
final class PublicSectorOpportunityFactory extends Factory
{
    protected $model = PublicSectorOpportunity::class;

    #[\Override]
    /**
     * @return (PublicSectorAgencyFactory|\Illuminate\Support\Carbon|array|bool|int|mixed|null|string)[]
     *
     * @psalm-return array{public_sector_agency_id: PublicSectorAgencyFactory, public_sector_program_id: null, title: string, slug: string, role_level: mixed, work_arrangement: mixed, location: string, salary_band: string, closes_at: \Illuminate\Support\Carbon, application_url: string, tags: array, summary: string, impact_statement: string, ai_signal: null, is_featured: bool, priority_score: int, status: 'open'}
     */
    public function definition(): array
    {
        $title = $this->faker->jobTitle.' (Public Sector)';

        return [
            'public_sector_agency_id' => PublicSectorAgency::factory(),
            'public_sector_program_id' => null,
            'title' => $title,
            'slug' => Str::slug($title).'-'.$this->faker->unique()->lexify('??'),
            'role_level' => $this->faker->randomElement(['Executive', 'Manager', 'Specialist']),
            'work_arrangement' => $this->faker->randomElement(['Hybrid', 'Remote-first', 'On-site']),
            'location' => $this->faker->city().', '.$this->faker->stateAbbr(),
            'salary_band' => 'AUD '.$this->faker->numberBetween(120, 220).'k',
            'closes_at' => now()->addDays($this->faker->numberBetween(5, 30)),
            'application_url' => $this->faker->url(),
            'tags' => $this->faker->randomElements([
                'public-sector', 'civic', 'governance', 'ai', 'climate', 'equity',
            ], 3),
            'summary' => $this->faker->paragraph(3),
            'impact_statement' => $this->faker->sentence(12),
            'ai_signal' => null,
            'is_featured' => $this->faker->boolean(60),
            'priority_score' => $this->faker->numberBetween(55, 95),
            'status' => 'open',
        ];
    }
}

