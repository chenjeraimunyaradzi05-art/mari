<?php

namespace App\Services\PublicSector;

use App\Models\PublicSectorAgency;
use App\Models\PublicSectorOpportunity;
use App\Models\PublicSectorInsight;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class PublicSectorInsightService
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

    public function buildPlaybook(User $user, Collection $agencies, Collection $opportunities, Collection $insights): array
    {
        $snapshot = [
            'user' => [
                'name' => $user->name,
                'personas' => $user->persona_flags ?? [],
                'classification' => $user->account_classification,
            ],
            'agencies' => $agencies->take(5)->map(fn (PublicSectorAgency $agency) => [
                'name' => $agency->name,
                'category' => $agency->category,
                'focus' => $agency->focus_areas,
                'score' => $agency->impact_score,
            ])->values()->all(),
            'opportunities' => $opportunities->take(5)->map(fn (PublicSectorOpportunity $opportunity) => [
                'title' => $opportunity->title,
                'location' => $opportunity->location,
                'work_arrangement' => $opportunity->work_arrangement,
                'tags' => $opportunity->tags,
                'closing_window' => $opportunity->closing_window,
            ])->values()->all(),
            'insights' => $insights->map(fn (PublicSectorInsight $insight) => [
                'metric' => $insight->metric_label,
                'value' => $insight->metric_value,
                'trend' => $insight->trend,
            ])->values()->all(),
        ];

        if (!$this->aiEnabled || empty($this->apiKey)) {
            return $this->fallbackPlaybook($snapshot);
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
                        'content' => 'You are a civic innovation strategist helping women navigate public sector programs. Return JSON with "themes" and "actions".',
                    ],
                    [
                        'role' => 'user',
                        'content' => json_encode($snapshot),
                    ],
                ],
                'max_tokens' => 350,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::warning('Public sector AI playbook failed', ['status' => $response->status(), 'body' => $response->body()]);
                return $this->fallbackPlaybook($snapshot);
            }

            $payload = json_decode($response->json('choices.0.message.content', '{}'), true);
            if (!is_array($payload)) {
                return $this->fallbackPlaybook($snapshot);
            }

            return [
                'themes' => $this->normalisePlaybookItems($payload['themes'] ?? [], ['theme', 'headline']),
                'actions' => $this->normalisePlaybookItems($payload['actions'] ?? [], ['action', 'next_step', 'recommendation']),
                'tone' => $payload['tone'] ?? 'optimistic',
            ];
        } catch (\Throwable $throwable) {
            Log::error('Public sector playbook exception: '.$throwable->getMessage(), ['trace' => $throwable->getTraceAsString()]);
            return $this->fallbackPlaybook($snapshot);
        }
    }

    /**
     * @return ((mixed|string)[]|mixed|null|string)[]
     *
     * @psalm-return array{tagline: mixed|string, call_to_action: mixed|string, hashtags: array<mixed|string>, momentum: mixed|null|string}
     */
    public function summarizeOpportunity(PublicSectorOpportunity $opportunity): array
    {
        $fallback = [
            'tagline' => Str::limit($opportunity->impact_statement ?: $opportunity->summary, 140) ?: 'Help shape equitable services for women and diverse communities.',
            'call_to_action' => 'Submit your expression of interest before '.(($opportunity->closes_at?->format('j M')) ?? 'the posted deadline').'.',
            'hashtags' => collect($opportunity->tags ?? ['PublicSector', 'CivicImpact'])->take(4)->map(fn ($tag) => '#'.Str::slug($tag))->values()->all(),
            'momentum' => $opportunity->closing_window,
        ];

        if (!$this->aiEnabled || empty($this->apiKey)) {
            return $fallback;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post(Str::finish($this->baseUrl, '/').'chat/completions', [
                'model' => $this->model,
                'messages' => [
                    ['role' => 'system', 'content' => 'You craft confident, modern microcopy for public sector initiatives. Return JSON with tagline, call_to_action, hashtags, momentum.'],
                    ['role' => 'user', 'content' => json_encode([
                        'title' => $opportunity->title,
                        'summary' => $opportunity->summary,
                        'impact' => $opportunity->impact_statement,
                        'closing_window' => $opportunity->closing_window,
                        'tags' => $opportunity->tags,
                    ])],
                ],
                'max_tokens' => 260,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::warning('Public sector opportunity summary failed', ['status' => $response->status()]);
                return $fallback;
            }

            $payload = json_decode($response->json('choices.0.message.content', '{}'), true);
            if (!is_array($payload)) {
                return $fallback;
            }

            return [
                'tagline' => $payload['tagline'] ?? $fallback['tagline'],
                'call_to_action' => $payload['call_to_action'] ?? $fallback['call_to_action'],
                'hashtags' => Arr::wrap($payload['hashtags'] ?? $fallback['hashtags']),
                'momentum' => $payload['momentum'] ?? $fallback['momentum'],
            ];
        } catch (\Throwable $throwable) {
            Log::error('Public sector opportunity summary exception: '.$throwable->getMessage());
            return $fallback;
        }
    }

    public function summarizeEngagement(User $user, PublicSectorOpportunity $opportunity, array $channels = [], ?string $motivation = null): string
    {
        $summary = sprintf(
            '%s signalled interest in %s via %s. Motivation: %s.',
            $user->name,
            $opportunity->title,
            empty($channels) ? 'portal' : implode(', ', $channels),
            $motivation ? Str::limit($motivation, 120) : 'drive to elevate civic outcomes'
        );

        if (!$this->aiEnabled || empty($this->apiKey)) {
            return $summary;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($this->timeout)->post(Str::finish($this->baseUrl, '/').'chat/completions', [
                'model' => $this->model,
                'messages' => [
                    ['role' => 'system', 'content' => 'Summarise civic talent engagement events in one upbeat sentence.'],
                    ['role' => 'user', 'content' => $summary],
                ],
                'max_tokens' => 100,
            ]);

            if ($response->successful()) {
                return Str::limit(trim($response->json('choices.0.message.content', $summary)), 200);
            }
        } catch (\Throwable $throwable) {
            Log::debug('Public sector engagement summary failure: '.$throwable->getMessage());
        }

        return $summary;
    }

    /**
     * @return int[]
     *
     * @psalm-return array{closing_soon: int, hybrid_friendly: int, executive_paths: int}
     */
    public function opportunitySignals(Collection $opportunities): array
    {
        $soon = $opportunities->filter(fn (PublicSectorOpportunity $opportunity) => $opportunity->closes_at && now()->diffInDays($opportunity->closes_at, false) <= 7);
        $hybrid = $opportunities->filter(fn (PublicSectorOpportunity $opportunity) => Str::contains(Str::lower($opportunity->work_arrangement ?? ''), 'hybrid'));
        $executive = $opportunities->filter(fn (PublicSectorOpportunity $opportunity) => Str::contains(Str::lower($opportunity->role_level ?? ''), 'executive'));

        return [
            'closing_soon' => $soon->count(),
            'hybrid_friendly' => $hybrid->count(),
            'executive_paths' => $executive->count(),
        ];
    }

    /**
     * @return (string|string[])[]
     *
     * @psalm-return array{themes: list{'Lead with transparency and women-first procurement frameworks', 'Pair civic innovation pilots with storytelling across social channels', 'Fund hybrid, family-friendly leadership pathways inside the public service'}, actions: list{string, 'Invite 3 agencies to co-host a Public Sector Lab sprint this quarter.', 'Route all new applicants through the AI stability check to de-risk onboarding.'}, tone: 'confident'}
     */
    private function fallbackPlaybook(array $snapshot): array
    {
        $focus = collect($snapshot['agencies'] ?? [])->pluck('focus')->flatten()->unique()->take(3)->filter();

        return [
            'themes' => [
                'Lead with transparency and women-first procurement frameworks',
                'Pair civic innovation pilots with storytelling across social channels',
                'Fund hybrid, family-friendly leadership pathways inside the public service',
            ],
            'actions' => [
                'Highlight '.$focus->implode(', ') ?: 'community wellbeing'.' across your org page and reels.',
                'Invite 3 agencies to co-host a Public Sector Lab sprint this quarter.',
                'Route all new applicants through the AI stability check to de-risk onboarding.',
            ],
            'tone' => 'confident',
        ];
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function normalisePlaybookItems(mixed $items, array $priorityKeys = []): array
    {
        $fallbackKeys = ['text', 'title', 'summary', 'description', 'content', 'message', 'value'];
        $keys = array_values(array_unique(array_merge($priorityKeys, $fallbackKeys)));

        return collect(Arr::wrap($items))
            ->map(function ($item) use ($keys) {
                if (is_string($item)) {
                    $item = trim($item);
                    return $item === '' ? null : $item;
                }

                if (is_array($item)) {
                    foreach ($keys as $key) {
                        $value = Arr::get($item, $key);
                        if (is_string($value) && trim($value) !== '') {
                            return trim($value);
                        }
                    }

                    if (count($item) === 1) {
                        $value = reset($item);
                        if (is_string($value) && trim($value) !== '') {
                            return trim($value);
                        }
                    }
                }

                return null;
            })
            ->filter()
            ->values()
            ->all();
    }
}

