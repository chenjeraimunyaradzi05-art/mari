<?php

namespace App\Services\Business;

use App\Models\Business\BusinessProfile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class BusinessAiAdvisor
{
    private bool $enabled;
    private string $providerKey;
    private array $providerConfig;

    public function __construct(?string $providerKey = null, ?bool $enabled = null)
    {
        $this->providerKey = $providerKey ?? (string) config('ai.default_provider', 'openai');
        $providers = (array) config('ai.providers', []);
        $this->providerConfig = (array) ($providers[$this->providerKey] ?? []);
        $this->enabled = $enabled ?? (bool) config('services.ai.enabled', false);
    }

    public function generatePlaybook(BusinessProfile $profile, ?Collection $milestones = null): array
    {
        $milestones ??= collect();

        if ($this->canCallProvider()) {
            $response = $this->callProvider($profile, $milestones);

            if ($response !== null) {
                return $response;
            }
        }

        return $this->fallbackPlaybook($profile, $milestones);
    }

    private function canCallProvider(): bool
    {
        return $this->enabled && filled($this->providerConfig['api_key'] ?? null);
    }

    private function callProvider(BusinessProfile $profile, Collection $milestones): ?array
    {
        try {
            $baseUrl = rtrim($this->providerConfig['base_url'] ?? config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
            $endpoint = $baseUrl.'/chat/completions';
            $timeout = (int) ($this->providerConfig['timeout'] ?? config('services.openai.timeout', 15));

            $payload = [
                'model' => $this->providerConfig['chat_model'] ?? config('services.openai.chat_model', 'gpt-4.1-mini'),
                'temperature' => 0.35,
                'max_tokens' => 500,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are an inclusive venture coach crafting poetic but precise launch plans for women-founded businesses. Always respond with JSON containing north_star, actions[], community_prompts[], and social_hooks[].',
                    ],
                    [
                        'role' => 'user',
                        'content' => $this->buildPrompt($profile, $milestones),
                    ],
                ],
            ];

            $response = Http::timeout($timeout)
                ->withHeaders([
                    'Authorization' => 'Bearer '.$this->providerConfig['api_key'],
                    'Content-Type' => 'application/json',
                ])
                ->post($endpoint, $payload);

            if (! $response->successful()) {
                Log::warning('business.ai.playbook_http_error', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            $content = Arr::get($response->json(), 'choices.0.message.content');
            $decoded = json_decode((string) $content, true);

            if (! is_array($decoded)) {
                return null;
            }

            return $this->normalizePayload($decoded, $profile);
        } catch (\Throwable $exception) {
            Log::warning('business.ai.playbook_exception', [
                'message' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function buildPrompt(BusinessProfile $profile, Collection $milestones): string
    {
        $context = [
            'venture' => $profile->venture_name ?? $profile->user?->name,
            'tagline' => $profile->tagline ?? 'Women-first business inside the Business Network.',
            'industry' => $profile->focus_industry ?? 'multi-vertical',
            'stage' => $profile->stage,
            'focus_pillars' => implode(', ', $profile->focus_pillars ?? ['capital', 'distribution', 'community']),
        ];

        $milestoneSummary = $milestones
            ->take(3)
            ->map(fn ($milestone) => $milestone->title.' ('.$milestone->status.')')
            ->implode(' | ');

        return sprintf(
            "Craft a luxe but actionable playbook for %s. Tagline: %s. Industry: %s. Stage: %s. Focus pillars: %s. Current milestones: %s",
            $context['venture'],
            $context['tagline'],
            $context['industry'],
            $context['stage'],
            $context['focus_pillars'],
            $milestoneSummary ?: 'planning phase'
        );
    }

    /**
     * @return (((mixed|string)[]|mixed)[]|mixed|string)[]
     *
     * @psalm-return array{north_star: mixed|string, actions: array<int, array{title: mixed|string, description: 'Bring the idea to life with warmth.'|mixed, status: 'planned'|mixed}>, community_prompts: list<mixed>, social_hooks: list<mixed>}
     */
    private function normalizePayload(array $payload, BusinessProfile $profile): array
    {
        $actions = collect($payload['actions'] ?? [])
            ->map(function ($action, $index) {
                return [
                    'title' => Arr::get($action, 'title') ?? Arr::get($action, 'name') ?? 'Action '.($index + 1),
                    'description' => Arr::get($action, 'description') ?? Arr::get($action, 'detail') ?? 'Bring the idea to life with warmth.',
                    'status' => Arr::get($action, 'status') ?? 'planned',
                ];
            })
            ->values()
            ->all();

        return [
            'north_star' => $payload['north_star'] ?? 'Soft launch '.($profile->venture_name ?? 'your studio').' with clarity and grace.',
            'actions' => $actions,
            'community_prompts' => array_values($payload['community_prompts'] ?? [
                'Who is the boldest woman-owned brand you want to collaborate with this quarter?',
                'Drop a win from this week so we can cheer with you.',
            ]),
            'social_hooks' => array_values($payload['social_hooks'] ?? [
                '#WomenInBusiness #GlowBoldly',
                '#CommunityPowered',
            ]),
        ];
    }

    /**
     * @return ((string|string[])[]|string)[]
     *
     * @psalm-return array{north_star: string, actions: list{array{title: 'Curate the pilot circle', description: 'Identify three dreamy partners and craft concierge-style outreach notes.', status: 'planned'}, array{title: 'Codify the story stack', description: 'Record a founder note, carousel, and newsletter snippet to keep the tone cohesive.', status: 'planned'}, array{title: 'Measure the glow', description: 'Track invitations, replies, and conversions weekly to keep momentum visible.', status: 'planned'}}, community_prompts: list{'What support do you want from this week’s Business Network drop-ins?', 'Who should we spotlight next on the Business feed? Nominate a founder ↓'}, social_hooks: list{'#BusinessNetwork #WomenLead', '#GlowBoldly'}}
     */
    private function fallbackPlaybook(BusinessProfile $profile, Collection $milestones): array
    {
        $venture = $profile->venture_name ?? $profile->user?->name ?? 'your studio';
        $pillars = $profile->focus_pillars ?? ['capital readiness', 'brand heat', 'community'];


        return [
            'north_star' => 'Turn '.$venture.' into the go-to '.($profile->focus_industry ?? 'women-first venture').' by compounding '.($pillars[0] ?? 'capital readiness').', '.($pillars[1] ?? 'brand heat').', and '.($pillars[2] ?? 'community love').'.',
            'actions' => [
                [
                    'title' => 'Curate the pilot circle',
                    'description' => 'Identify three dreamy partners and craft concierge-style outreach notes.',
                    'status' => 'planned',
                ],
                [
                    'title' => 'Codify the story stack',
                    'description' => 'Record a founder note, carousel, and newsletter snippet to keep the tone cohesive.',
                    'status' => 'planned',
                ],
                [
                    'title' => 'Measure the glow',
                    'description' => 'Track invitations, replies, and conversions weekly to keep momentum visible.',
                    'status' => 'planned',
                ],
            ],
            'community_prompts' => [
                'What support do you want from this week’s Business Network drop-ins?',
                'Who should we spotlight next on the Business feed? Nominate a founder ↓',
            ],
            'social_hooks' => [
                '#BusinessNetwork #WomenLead',
                '#GlowBoldly',
            ],
        ];
    }
}

