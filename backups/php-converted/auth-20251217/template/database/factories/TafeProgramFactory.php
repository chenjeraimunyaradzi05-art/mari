<?php

namespace Database\Factories;

use App\Models\TafeInstitution;
use App\Models\TafeProgram;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TafeProgram>
 */
final class TafeProgramFactory extends Factory
{
    protected $model = TafeProgram::class;

    #[\Override]
    /**
     * @return (TafeInstitutionFactory|\Illuminate\Support\Carbon|array|float|int|mixed|string)[]
     *
     * @psalm-return array{tafe_institution_id: TafeInstitutionFactory, title: string, slug: string, credential_level: mixed, delivery_mode: mixed, duration_weeks: int, weekly_commitment_hours: int, tuition_from_aud: int, tuition_to_aud: int, funding_options: array, ai_match_traits: array, outcomes: array|string, support_services: array{mentor: 'Dedicated women-led mentorship', wellbeing: 'Trauma-informed wellbeing circle'}, tags: array, summary: string, ai_recommendation_snippet: string, cta_label: 'Explore program', application_url: string, status: 'published', ai_match_score: float, last_ai_sync_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $title = $this->faker->unique()->catchPhrase().' Program';
        $credentialLevels = [
            'certificate_iii',
            'certificate_iv',
            'diploma',
            'advanced_diploma',
            'bachelor',
            'graduate_certificate',
            'graduate_diploma',
            'masters',
            'micro_credential',
        ];

        $deliveryModes = ['on_campus', 'online', 'hybrid'];
        $fundingOptions = ['HECS-HELP', 'Skills First', 'WomenRise scholarship', 'Employer sponsored'];
        $tags = ['ai-ops', 'climate', 'health', 'design', 'policy', 'leadership'];

        return [
            'tafe_institution_id' => TafeInstitution::factory(),
            'title' => $title,
            'slug' => Str::slug($title),
            'credential_level' => $this->faker->randomElement($credentialLevels),
            'delivery_mode' => $this->faker->randomElement($deliveryModes),
            'duration_weeks' => $this->faker->numberBetween(6, 52),
            'weekly_commitment_hours' => $this->faker->numberBetween(4, 20),
            'tuition_from_aud' => $this->faker->numberBetween(1200, 8500),
            'tuition_to_aud' => $this->faker->numberBetween(8501, 15000),
            'funding_options' => $this->faker->randomElements($fundingOptions, 2),
            'ai_match_traits' => $this->faker->randomElements([
                'leadership-pathway',
                'community-impact',
                'digital-fluency',
                'enterprise-readiness',
                'lived-experience-led',
            ], 3),
            'outcomes' => $this->faker->sentences(3),
            'support_services' => [
                'mentor' => 'Dedicated women-led mentorship',
                'wellbeing' => 'Trauma-informed wellbeing circle',
            ],
            'tags' => $this->faker->randomElements($tags, 3),
            'summary' => $this->faker->paragraph(),
            'ai_recommendation_snippet' => $this->faker->sentence(),
            'cta_label' => 'Explore program',
            'application_url' => $this->faker->url(),
            'status' => 'published',
            'ai_match_score' => $this->faker->randomFloat(2, 68, 99),
            'last_ai_sync_at' => now()->subDays($this->faker->numberBetween(1, 14)),
        ];
    }
}

