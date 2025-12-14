<?php

namespace Database\Factories;

use App\Models\ApprenticeshipProgram;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprenticeshipProgram>
 */
final class ApprenticeshipProgramFactory extends Factory
{
    protected $model = ApprenticeshipProgram::class;

    #[\Override]
    /**
     * @return (OrganizationPageFactory|int|string|string[])[]
     *
     * @psalm-return array{org_page_id: OrganizationPageFactory, title: string, summary: string, requirements: list{'women_led', 'australian_citizen'}, location: string, duration_weeks: int, application_url: string, status: 'published', meta: array{intake: '2026'}}
     */
    public function definition(): array
    {
        return [
            'org_page_id' => OrganizationPage::factory(),
            'title' => $this->faker->sentence(4),
            'summary' => $this->faker->paragraph(),
            'requirements' => ['women_led', 'australian_citizen'],
            'location' => $this->faker->city(),
            'duration_weeks' => $this->faker->numberBetween(12, 156),
            'application_url' => $this->faker->url(),
            'status' => 'published',
            'meta' => ['intake' => '2026'],
        ];
    }
}
