<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Course>
 */
final class CourseFactory extends Factory
{
    protected $model = Course::class;

    #[\Override]
    /**
     * @return (OrganizationPageFactory|\Illuminate\Support\Carbon|array|int|mixed|string)[]
     *
     * @psalm-return array{provider_org_page_id: OrganizationPageFactory, code: string, title: string, slug: string, summary: string, type: mixed, mode: mixed, location: string, duration_weeks: int, cost_cents: int, funding: array{federal_grant: bool, state_support: bool}, prerequisites: array, outcomes: array, tags: array, application_url: string, contact_email: string, contact_phone: string, status: 'published', published_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $title = $this->faker->sentence(3);

        return [
            'provider_org_page_id' => OrganizationPage::factory(),
            'code' => strtoupper($this->faker->bothify('CRS-###')),
            'title' => $title,
            'slug' => Str::slug($title.'-'.$this->faker->unique()->numberBetween(1000, 9999)),
            'summary' => $this->faker->paragraph(),
            'type' => $this->faker->randomElement(['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship']),
            'mode' => $this->faker->randomElement(['on_campus','online','hybrid']),
            'location' => $this->faker->city(),
            'duration_weeks' => $this->faker->numberBetween(4, 104),
            'cost_cents' => $this->faker->numberBetween(50000, 2500000),
            'funding' => [
                'federal_grant' => $this->faker->boolean(40),
                'state_support' => $this->faker->boolean(30),
            ],
            'prerequisites' => $this->faker->randomElements([
                'Working With Children Check',
                'Certificate III in Business',
                'Bachelor in related field',
                '2 years industry experience',
            ], $this->faker->numberBetween(0, 2)),
            'outcomes' => $this->faker->randomElements([
                'Industry placement',
                'National accreditation',
                'Guaranteed interview',
                'Digital credential',
            ], $this->faker->numberBetween(1, 3)),
            'tags' => $this->faker->randomElements([
                'STEM',
                'Leadership',
                'Remote-friendly',
                'Women in trades',
            ], $this->faker->numberBetween(1, 3)),
            'application_url' => $this->faker->url(),
            'contact_email' => $this->faker->companyEmail(),
            'contact_phone' => $this->faker->phoneNumber(),
            'status' => 'published',
            'published_at' => now()->subDays($this->faker->numberBetween(1, 120)),
        ];
    }
}
