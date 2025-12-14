<?php

namespace App\Services\Education;

use App\Models\SocialPost;
use App\Models\TafeCareerProfile;
use App\Models\TafeProgram;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class TafeUniversityInsightService
{
    private bool $aiEnabled;
    private ?string $apiKey;
    private string $baseUrl;
    private string $model;
    private int $timeout;

    public function __construct(?bool $aiEnabled = null, ?string $apiKey = null, ?string $baseUrl = null, ?string $model = null, ?int $timeout = null)
    {
        $this->aiEnabled = $aiEnabled ?? (bool) config('services.ai.enabled', false);
        $this->apiKey = $apiKey ?? (string) (config('ai.providers.openai.api_key') ?? config('services.openai.api_key')) ?: null;
        $this->baseUrl = $baseUrl ?? rtrim((string) config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
        $this->model = $model ?? (string) config('ai.providers.openai.chat_model', config('services.openai.chat_model', 'gpt-4.1-mini'));
        $this->timeout = $timeout ?? (int) config('services.openai.timeout', 15);
    }

    public function generateInsights(User $user, Collection $programs): array
    {
        $snapshot = [
            'user' => [
                'name' => $user->name,
                'personas' => $user->persona_flags ?? [],
                'classification' => $user->account_classification,
            ],
            'programs' => $programs->take(5)->map(function (TafeProgram $program) {
                return [
                    'title' => $program->title,
                    'credential' => $program->credential_level,
                    'delivery' => $program->delivery_mode,
                    'duration' => $program->duration_weeks,
                    'tags' => $program->tags,
                ];
            })->values()->all(),
        ];

        if (!$this->aiEnabled || empty($this->apiKey)) {
            return $this->fallbackInsights($snapshot);
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post(Str::finish($this->baseUrl, '/').'chat/completions', [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are an AI planner for a women-first education platform. Write concise action steps and focus themes in JSON.',
                    ],
                    [
                        'role' => 'user',
                        'content' => json_encode($snapshot),
                    ],
                ],
                'max_tokens' => 300,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::warning('TAFE AI insight call failed', ['status' => $response->status(), 'body' => $response->body()]);
                return $this->fallbackInsights($snapshot);
            }

            $payload = json_decode($response->json('choices.0.message.content', '{}'), true);
            if (!is_array($payload)) {
                return $this->fallbackInsights($snapshot);
            }

            return [
                'focus' => Arr::wrap($payload['focus'] ?? []),
                'actions' => Arr::wrap($payload['actions'] ?? []),
                'tone' => $payload['tone'] ?? 'optimistic',
            ];
        } catch (\Throwable $throwable) {
            Log::error('TAFE AI insight exception: '.$throwable->getMessage(), ['trace' => $throwable->getTraceAsString()]);
            return $this->fallbackInsights($snapshot);
        }
    }

    public function scoreProgram(User $user, TafeProgram $program): float
    {
        $score = 64.0;

        $advancedCredentials = ['advanced_diploma', 'associate_degree', 'bachelor', 'graduate_certificate', 'graduate_diploma', 'masters'];
        if (in_array($program->credential_level, $advancedCredentials, true)) {
            $score += 6;
        }

        if ($program->delivery_mode === 'hybrid') {
            $score += 4;
        } elseif ($program->delivery_mode === 'online') {
            $score += 2;
        }

        if ($program->duration_weeks && $program->duration_weeks <= 26) {
            $score += 3;
        }

        if ($program->tags && $user->persona_flags) {
            $overlap = count(array_intersect($program->tags, $user->persona_flags));
            $score += $overlap * 2.5;
        }

        return (float) min(100, max(20, round($score, 2)));
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: 'Book a virtual campus tour to meet the teaching team and current cohort.'|'Request a funding consult to unlock scholarships and subsidies attached to this program.', 2?: 'Request a funding consult to unlock scholarships and subsidies attached to this program.'}
     */
    public function recommendedActions(TafeProgram $program): array
    {
        $actions = [];

        if ($program->application_url) {
            $actions[] = 'Review the admission checklist and submit documentation via the partner portal.';
        }

        if ($program->delivery_mode !== 'on_campus') {
            $actions[] = 'Book a virtual campus tour to meet the teaching team and current cohort.';
        }

        if ($program->funding_options) {
            $actions[] = 'Request a funding consult to unlock scholarships and subsidies attached to this program.';
        }

        return $actions ?: ['Schedule a discovery call with the student success team to map your pathway.'];
    }

    /**
     * @return ((int|string)|null|string[])[]
     *
     * @psalm-return array{trending_tags: array<int, string>, highlight: array-key|null}
     */
    public function summarizeSocial(Collection $posts): array
    {
        $tags = [];

        $posts->each(function (SocialPost $post) use (&$tags): void {
            if (is_array($post->tags)) {
                foreach ($post->tags as $tag) {
                    $tags[] = Str::of($tag)->lower()->trim()->__toString();
                }
            }
        });

        $counts = collect($tags)
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(5);

        return [
            'trending_tags' => $counts->keys()->map(fn ($tag) => '#'.$tag)->values()->all(),
            'highlight' => $counts->keys()->first(),
        ];
    }

    public function suggestCareers(User $user, ?TafeCareerProfile $profile = null): array
    {
        $snapshot = [
            'user' => [
                'name' => $user->name,
                'account_type' => $user->role,
                'personas' => $user->persona_flags ?? [],
            ],
            'profile' => [
                'motivations' => $profile?->motivations,
                'focus_areas' => $profile?->focus_areas ?? [],
                'preferred_sectors' => $profile?->preferred_sectors ?? [],
                'salary_aspiration' => $profile?->salary_aspiration,
                'impact_goals' => $profile?->impact_goals,
                'work_style' => $profile?->work_style,
                'top_skills' => $profile?->top_skills ?? [],
            ],
        ];

        if (!$this->aiEnabled || empty($this->apiKey)) {
            return $this->fallbackCareerSuggestions($snapshot);
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post(Str::finish($this->baseUrl, '/').'chat/completions', [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a women-first career economist. Return JSON with 3 high-growth, high-pay career paths for the next 5 years. Include growth and salary expectations in natural language.',
                    ],
                    [
                        'role' => 'user',
                        'content' => json_encode($snapshot),
                    ],
                ],
                'max_tokens' => 400,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::warning('TAFE AI career suggestion call failed', ['status' => $response->status(), 'body' => $response->body()]);
                return $this->fallbackCareerSuggestions($snapshot);
            }

            $payload = json_decode($response->json('choices.0.message.content', '{}'), true);
            if (!is_array($payload)) {
                return $this->fallbackCareerSuggestions($snapshot);
            }

            return [
                'careers' => Arr::wrap($payload['careers'] ?? []),
                'summary' => $payload['summary'] ?? null,
            ];
        } catch (\Throwable $throwable) {
            Log::error('TAFE AI career suggestion exception: '.$throwable->getMessage(), ['trace' => $throwable->getTraceAsString()]);
            return $this->fallbackCareerSuggestions($snapshot);
        }
    }

    /**
     * @return (string|string[])[]
     *
     * @psalm-return array{focus: list{'Nurture high-intent cohorts through personalised onboarding', 'Blend mentorship, wraparound support, and flexible delivery windows'}, actions: list{'Share 2-3 student stories about confidence gains within the first 30 days.', string, 'Activate community prompts in the social feed to capture student-led wins.'}, tone: 'uplifting'}
     */
    private function fallbackInsights(array $snapshot): array
    {
        $program_titles = collect($snapshot['programs'] ?? [])->pluck('title');

        return [
            'focus' => [
                'Nurture high-intent cohorts through personalised onboarding',
                'Blend mentorship, wraparound support, and flexible delivery windows',
            ],
            'actions' => [
                'Share 2-3 student stories about confidence gains within the first 30 days.',
                'Highlight the most in-demand programs: '.($program_titles->take(3)->implode(', ') ?: 'Digital & Growth pathways').'.',
                'Activate community prompts in the social feed to capture student-led wins.',
            ],
            'tone' => 'uplifting',
        ];
    }

    /**
     * @return ((string|string[])[][]|string)[]
     *
     * @psalm-return array{summary: string, careers: list{array{title: 'AI-Enabled Workforce Strategist', growth_outlook: 'Very high demand as organisations re-skill teams for automation-era roles.', median_salary: 'AUD $140K–$165K', why_match: 'Blends talent strategy, people analytics, and change leadership—perfect for women mapping equitable workplaces.', next_step: 'Complete an advanced people analytics certification and pilot an internal mobility sprint.', tags: list{'talent', 'ai', 'strategy'}}, array{title: 'Sustainable Infrastructure Program Lead', growth_outlook: 'Strong due to record public funding and private capital for resilient cities.', median_salary: 'AUD $155K–$185K', why_match: 'Uses systems thinking plus stakeholder orchestration across climate, housing, and transport.', next_step: 'Pair a project finance micro-credential with women-led infrastructure consortium experience.', tags: list{'climate', 'infrastructure', 'finance'}}, array{title: 'Digital Health Commercial Director', growth_outlook: 'Fast-growing as hospitals monetise virtual care and preventative health data.', median_salary: 'AUD $165K–$200K+', why_match: 'Combines care equity mission with high-margin go-to-market leadership.', next_step: 'Lead a pilot for women’s health platform adoption with measurable retention metrics.', tags: list{'health', 'commercial', 'growth'}}}}
     */
    private function fallbackCareerSuggestions(array $snapshot): array
    {
        $focus = collect($snapshot['profile']['focus_areas'] ?? [])->first();
        $sectors = collect($snapshot['profile']['preferred_sectors'] ?? []);
        $sectorText = $sectors->isNotEmpty() ? $sectors->implode(', ') : 'tech-enabled care and climate resilience';

        $careers = [
            [
                'title' => 'AI-Enabled Workforce Strategist',
                'growth_outlook' => 'Very high demand as organisations re-skill teams for automation-era roles.',
                'median_salary' => 'AUD $140K–$165K',
                'why_match' => 'Blends talent strategy, people analytics, and change leadership—perfect for women mapping equitable workplaces.',
                'next_step' => 'Complete an advanced people analytics certification and pilot an internal mobility sprint.',
                'tags' => ['talent', 'ai', 'strategy'],
            ],
            [
                'title' => 'Sustainable Infrastructure Program Lead',
                'growth_outlook' => 'Strong due to record public funding and private capital for resilient cities.',
                'median_salary' => 'AUD $155K–$185K',
                'why_match' => 'Uses systems thinking plus stakeholder orchestration across climate, housing, and transport.',
                'next_step' => 'Pair a project finance micro-credential with women-led infrastructure consortium experience.',
                'tags' => ['climate', 'infrastructure', 'finance'],
            ],
            [
                'title' => 'Digital Health Commercial Director',
                'growth_outlook' => 'Fast-growing as hospitals monetise virtual care and preventative health data.',
                'median_salary' => 'AUD $165K–$200K+',
                'why_match' => 'Combines care equity mission with high-margin go-to-market leadership.',
                'next_step' => 'Lead a pilot for women’s health platform adoption with measurable retention metrics.',
                'tags' => ['health', 'commercial', 'growth'],
            ],
        ];

        return [
            'summary' => sprintf('Focusing on %s opens doors to roles shaping high-growth, high-pay segments such as %s.', $focus ?? 'women-first innovation', $sectorText),
            'careers' => $careers,
        ];
    }
}

