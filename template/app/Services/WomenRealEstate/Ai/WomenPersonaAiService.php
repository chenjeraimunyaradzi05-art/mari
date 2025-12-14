<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate\Ai;

use App\Contracts\AI\TextModel;
use App\Models\User;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WomenPersonaAiService
{
    private const CACHE_PREFIX = 'women_real_estate:persona_ai';

    /**
     * @var array<string, array<string, mixed>>
     */
    private array $providerDefinitions = [];

    /**
     * @var array<int, string>
     */
    private array $providerOrder = [];

    /**
     * @var array<string, array<int, string>>
     */
    private array $flowProviderOrder = [];

    /**
     * @var array<string, TextModel>
     */
    private array $clients = [];

    private ?CacheRepository $cacheRepository = null;

    public function buildStorySummary(User $user, ?WomenPersonaProfile $profile, string $prompt, array $context = []): string
    {
        $fingerprint = [
            'type' => 'story_builder',
            'user_id' => $user->getKey(),
            'persona' => $profile?->persona ?? Arr::get($context, 'persona'),
            'prompt_hash' => md5($prompt),
        ];

        $payload = $this->dispatchThroughProviders('persona_story_builder', $fingerprint, /**
         * @return null|string[]
         *
         * @psalm-return array{summary: string, tone: string}|null
         */
        function (TextModel $client, string $provider) use ($user, $profile, $prompt, $context): array|null {
            $json = $this->buildStoryPromptPayload($user, $profile, $prompt, $context);
            $raw = $client->generate($json, [
                'max_tokens' => 500,
                'temperature' => 0.3,
            ]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            $summary = trim((string) Arr::get($decoded, 'summary', ''));

            if ($summary === '') {
                return null;
            }

            return [
                'summary' => Str::limit($summary, 240),
                'tone' => (string) Arr::get($decoded, 'tone', 'warm'),
            ];
        }, /**
         * @return (mixed|string)[]
         *
         * @psalm-return array{summary: string, tone: 'warm', source: 'fallback', persona: 'househunter'|mixed}
         */
        function () use ($prompt, $context): array {
            return [
                'summary' => $this->fallbackStorySummary($prompt),
                'tone' => 'warm',
                'source' => 'fallback',
                'persona' => Arr::get($context, 'persona') ?? 'househunter',
            ];
        });

        return (string) Arr::get($payload, 'summary', $this->fallbackStorySummary($prompt));
    }

    /**
     * @param array<string, array{percent:int,complete:int,total:int}> $sectionProgress
     * @return array<int, array{section:string,label:string,status:string,percent:int}>
     */
    public function trustCoachChecklist(User $user, ?WomenPersonaProfile $profile, array $sectionProgress, ?string $focus = null, int $limit = 3): array
    {
        $fingerprint = [
            'type' => 'trust_coach',
            'user_id' => $user->getKey(),
            'persona' => $profile?->persona,
            'focus' => $focus,
            'sections' => $sectionProgress,
        ];

        $payload = $this->dispatchThroughProviders('persona_trust_coach', $fingerprint, /**
         * @return (int|string)[][][]|null
         *
         * @psalm-return array{tips: array<int, array{section: string, label: string, status: string, percent: int<0, 100>, position: int}>}|null
         */
        /**
         * @return (int|string)[][][]|null
         *
         * @psalm-return array{tips: array<int, array{section: string, label: string, status: string, percent: int<0, 100>, position: int}>}|null
         */
        function (TextModel $client, string $provider) use ($user, $profile, $focus, $sectionProgress, $limit): array|null {
            $prompt = $this->buildTrustCoachPromptPayload($user, $profile, $sectionProgress, $focus, $limit);
            $raw = $client->generate($prompt, [
                'max_tokens' => 400,
                'temperature' => 0.35,
            ]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            $tips = collect(Arr::get($decoded, 'tips', []))
                ->map(function ($tip, int $index) {
                    $section = (string) Arr::get($tip, 'section', 'identity');
                    $label = trim((string) Arr::get($tip, 'label', "Share more about {$section}"));
                    $status = in_array(Arr::get($tip, 'status'), ['done', 'todo'], true)
                        ? (string) Arr::get($tip, 'status')
                        : 'todo';
                    $percent = (int) Arr::get($tip, 'percent', 0);

                    return [
                        'section' => Str::slug($section, '_'),
                        'label' => $label,
                        'status' => $status,
                        'percent' => max(0, min(100, $percent)),
                        'position' => $index,
                    ];
                })
                ->filter(fn (array $tip) => $tip['label'] !== '')
                ->take($limit)
                ->values()
                ->all();

            if ($tips === []) {
                return null;
            }

            return ['tips' => $tips];
        }, /**
         * @return (int|string)[][][]
         *
         * @psalm-return array{tips: array<int, array{section: string, label: string, status: string, percent: int}>}
         */
        /**
         * @return (int|string)[][][]
         *
         * @psalm-return array{tips: array<int, array{section: string, label: string, status: 'done'|'todo', percent: int<0, 100>}>}
         */
        function () use ($sectionProgress, $focus, $limit): array {
            return ['tips' => $this->fallbackTrustCoachChecklist($sectionProgress, $focus, $limit)];
        });

        return Arr::get($payload, 'tips', $this->fallbackTrustCoachChecklist($sectionProgress, $focus, $limit));
    }

    /**
     * @psalm-return array<string, mixed>
     */
    public function personaCoachingTips(User $user, ?WomenPersonaProfile $profile, string $persona, array $formDraft, array $sectionProgress): array
    {
        $fingerprint = [
            'type' => 'persona_coaching',
            'user_id' => $user->getKey(),
            'persona' => $persona,
            'sections' => $sectionProgress,
        ];

        $payload = $this->dispatchThroughProviders('persona_coaching', $fingerprint, /**
         * @return (mixed|string)[][][]|null
         *
         * @psalm-return array{tips: array<int, array{title: string, body: string, cta: mixed, tone: mixed}>}|null
         */
        /**
         * @return (mixed|string)[][][]|null
         *
         * @psalm-return array{tips: array<int, array{title: string, body: string, cta: mixed, tone: mixed}>}|null
         */
        function (TextModel $client, string $provider) use ($user, $profile, $persona, $formDraft, $sectionProgress): array|null {
            $prompt = $this->buildPersonaCoachingPromptPayload($user, $profile, $persona, $formDraft, $sectionProgress);
            $raw = $client->generate($prompt, [
                'max_tokens' => 400,
                'temperature' => 0.4,
            ]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            $tips = collect(Arr::get($decoded, 'tips', []))
                ->map(function ($tip) {
                    return [
                        'title' => (string) Arr::get($tip, 'title', 'Keep sharing your story'),
                        'body' => (string) Arr::get($tip, 'body', ''),
                        'cta' => Arr::get($tip, 'cta'),
                        'tone' => Arr::get($tip, 'tone', 'warm'),
                    ];
                })
                ->filter(fn (array $tip) => $tip['title'] !== '' && $tip['body'] !== '')
                ->take(3)
                ->values()
                ->all();

            if ($tips === []) {
                return null;
            }

            return ['tips' => $tips];
        }, /**
         * @return array[]
         *
         * @psalm-return array{tips: array}
         */
        /**
         * @return (mixed|string)[][][]
         *
         * @psalm-return array{tips: array<int, array{title: string, body: string, cta: mixed, tone: mixed}>}
         */
        function () use ($persona): array {
            return ['tips' => $this->fallbackPersonaHints($persona)];
        });

        $tips = Arr::get($payload, 'tips');

        if (! is_array($tips) || $tips === []) {
            $payload['tips'] = $this->fallbackPersonaHints($persona);
        }

        return $payload;
    }

    private function buildStoryPromptPayload(User $user, ?WomenPersonaProfile $profile, string $prompt, array $context): string
    {
        $personaPayload = [
            'persona' => $profile?->persona ?? Arr::get($context, 'persona'),
            'completion_score' => $profile?->completion_score,
            'sections' => [
                'identity' => $profile?->identity,
                'household' => $profile?->household,
                'lifestyle' => $profile?->lifestyle,
                'work' => $profile?->work,
                'transport' => $profile?->transport,
                'media' => $profile?->media,
            ],
        ];

        $form = Arr::get($context, 'form', []);

        $payload = json_encode([
            'persona' => $personaPayload,
            'form_draft' => $form,
            'user' => [
                'display_name' => $user->preferred_name ?? $user->name,
                'pronouns' => $user->pronouns,
                'personas' => $user->persona_flags,
            ],
            'focus_text' => (string) Str::of($prompt)->limit(1_200),
            'instructions' => 'Return JSON {"summary": "string <= 220 chars", "tone": "warm|bold|calm"}. Summary must be first-person, empathetic, safety- and community-aware, referencing focus_text or persona data.',
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You help WomenRise members articulate authentic housing personas.
Only respond with JSON. If data is missing, encourage gentle storytelling without inventing facts.
{$payload}
PROMPT;
    }

    /**
     * @param array<string, array{percent:int,complete:int,total:int}> $sectionProgress
     */
    private function buildTrustCoachPromptPayload(User $user, ?WomenPersonaProfile $profile, array $sectionProgress, ?string $focus, int $limit): string
    {
        $payload = json_encode([
            'persona' => [
                'persona' => $profile?->persona,
                'completion_score' => $profile?->completion_score,
                'highlight_in_feed' => $profile?->highlight_in_feed,
                'auto_share_opt_in' => $profile?->auto_share_opt_in,
            ],
            'sections' => $sectionProgress,
            'focus' => $focus,
            'limit' => $limit,
            'user' => [
                'pronouns' => $user->pronouns,
                'name' => $user->preferred_name ?? $user->name,
            ],
            'instructions' => 'Return JSON with tips array. Each tip: {"section": "identity", "label": "Share more about safety planning", "status": "todo|done", "percent": 0-100}',
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You are Trust Coach inside WomenRise. Recommend up to {$limit} micro-actions that make a persona feel trustworthy.
Celebrate completed sections (>80%) by marking status "done" but still suggest a next action. Leverage focus keywords when present.
Only emit JSON.
{$payload}
PROMPT;
    }

    private function buildPersonaCoachingPromptPayload(User $user, ?WomenPersonaProfile $profile, string $persona, array $formDraft, array $sectionProgress): string
    {
        $payload = json_encode([
            'persona' => [
                'persona' => $persona,
                'completion_score' => $profile?->completion_score,
                'sections' => $sectionProgress,
            ],
            'form_draft' => $formDraft,
            'user' => [
                'name' => $user->preferred_name ?? $user->name,
                'pronouns' => $user->pronouns,
            ],
            'instructions' => 'Return JSON {"tips":[{"title":"string","body":"string","cta":"string|null","tone":"warm|bold|calm"}]}. Tips must be actionable and specific to persona context.',
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You are Athena persona coach. Study the persona payload and suggest up to 3 concrete micro-actions that help the member finish onboarding and unlock premium housing/business modules.
Keep language respectful, empowering, and free from jargon. Always respect safety and consent.
{$payload}
PROMPT;
    }

    private function fallbackStorySummary(string $prompt): string
    {
        return (string) Str::of($prompt)
            ->replaceMatches('/\s+/', ' ')
            ->squish()
            ->limit(220, '…');
    }

    /**
     * @param array<string, array{percent:int,complete:int,total:int}> $sectionProgress
     *
     * @return (int|string)[][]
     *
     * @psalm-return array<int, array{section: string, label: string, status: 'done'|'todo', percent: int<0, 100>}>
     */
    private function fallbackTrustCoachChecklist(array $sectionProgress, ?string $focus, int $limit): array
    {
        $collection = collect($sectionProgress)
            ->map(fn ($meta, $section) => [
                'section' => (string) $section,
                'percent' => (int) ($meta['percent'] ?? 0),
            ])
            ->sortBy('percent');

        if ($focus) {
            $collection->prepend([
                'section' => Str::slug($focus, '_'),
                'percent' => 0,
            ]);
        }

        return $collection
            ->take(max(1, $limit))
            ->map(function (array $meta) {
                $section = (string) ($meta['section'] ?? 'identity');
                $label = Str::headline(str_replace('_', ' ', $section));
                $percent = max(0, min(100, (int) ($meta['percent'] ?? 0)));

                return [
                    'section' => $section,
                    'label' => "Share more about {$label}",
                    'status' => $percent >= 80 ? 'done' : 'todo',
                    'percent' => $percent,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array<int, array{title: string, body: string, cta: mixed, tone: mixed}>
     */
    private function fallbackPersonaHints(?string $persona): array
    {
        $catalog = (array) config('women_real_estate.persona_profiles.hints', []);
        $bucket = $catalog[$persona] ?? $catalog['default'] ?? [];

        return collect($bucket)
            ->map(function ($hint) {
                return [
                    'title' => (string) Arr::get($hint, 'title', 'Keep going'),
                    'body' => (string) Arr::get($hint, 'body', ''),
                    'cta' => Arr::get($hint, 'cta'),
                    'tone' => Arr::get($hint, 'tone', 'warm'),
                ];
            })
            ->filter(fn (array $hint) => $hint['body'] !== '')
            ->take(3)
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $fingerprint
    * @param callable(TextModel,string):?array $callback
     * @param callable():array $fallback
     * @return array<string, mixed>
     */
    private function dispatchThroughProviders(string $type, array $fingerprint, callable $callback, callable $fallback): array
    {
        $errors = [];

        foreach ($this->providerOrderFor($type) as $providerKey) {
            $definition = $this->providerDefinitions[$providerKey] ?? null;

            if (! $this->providerIsEnabled($providerKey, $definition)) {
                continue;
            }

            $cacheKey = $this->cacheKey($providerKey, $type, $fingerprint);
            $cached = $this->cache()->get($cacheKey);

            if (is_array($cached) && isset($cached['value'])) {
                return $this->buildResponse((array) $cached['value'], (string) ($cached['provider'] ?? $providerKey), true, $cached['stored_at'] ?? null);
            }

            $client = $this->clientFor($providerKey, $definition ?? []);

            if (! $client) {
                continue;
            }

            try {
                $value = $callback($client, $providerKey);

                if (is_array($value) && $value !== []) {
                    $storedAt = Carbon::now()->toIso8601String();
                    $this->cache()->put($cacheKey, [
                        'value' => $value,
                        'stored_at' => $storedAt,
                        'provider' => $providerKey,
                    ], $this->cacheTtlFor($type, $providerKey, $definition ?? []));

                    return $this->buildResponse($value, $providerKey, false, $storedAt);
                }
            } catch (Throwable $exception) {
                $errors[] = $exception->getMessage();
                $this->logProviderError($providerKey, $type, $exception);
            }
        }

        $payload = $this->buildResponse($fallback(), 'fallback', false);

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return $payload;
    }

    private function decodeJsonPayload(string $raw): ?array
    {
        $raw = trim($raw);

        if ($raw === '') {
            return null;
        }

        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $slice = substr($raw, $start, $end - $start + 1);

        try {
            return json_decode($slice, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            return null;
        }
    }

    private function providerIsEnabled(string $providerKey, ?array $definition): bool
    {
        if ($definition === null) {
            return false;
        }

        return (bool) ($definition['enabled'] ?? true);
    }

    private function clientFor(string $providerKey, array $definition): ?TextModel
    {
        if (isset($this->clients[$providerKey])) {
            return $this->clients[$providerKey];
        }

        $aiConfig = (array) config('ai.providers', []);
        $providerConfig = $aiConfig[$providerKey] ?? null;

        if (! is_array($providerConfig)) {
            return null;
        }

        $driver = (string) ($definition['driver'] ?? $providerKey);

        try {
            $client = match ($driver) {
                'anthropic' => new AnthropicTextModel(
                    $providerConfig['api_key'] ?? null,
                    $providerConfig['chat_model'] ?? null,
                ),
                default => new OpenAITextModel(
                    $providerConfig['api_key'] ?? null,
                    $providerConfig['organization'] ?? null,
                    $providerConfig['chat_model'] ?? null,
                    $providerConfig['embedding_model'] ?? null,
                ),
            };
        } catch (Throwable $exception) {
            $this->logProviderError($providerKey, 'bootstrap', $exception);

            return null;
        }

        return $this->clients[$providerKey] = $client;
    }

    private function cacheKey(string $providerKey, string $type, array $fingerprint): string
    {
        try {
            $hashSource = json_encode($fingerprint, JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            $hashSource = serialize($fingerprint);
        }

        return sprintf('%s:%s:%s:%s', self::CACHE_PREFIX, $type, $providerKey, md5($hashSource));
    }

    /**
     * @psalm-return int<60, max>
     */
    private function cacheTtlFor(string $type, string $providerKey, array $definition): int
    {
        $overrides = $definition['cache_overrides'][$type] ?? null;

        if ($overrides !== null && is_numeric($overrides)) {
            return max(60, (int) $overrides);
        }

        $defaultMap = (array) config('women_real_estate.ai.cache_ttl', []);

        return max(60, (int) ($defaultMap[$type] ?? 3_600));
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function resolveProviderOrder(mixed $ordered = null): array
    {
        $parsed = $this->parseProviderOrder($ordered);

        if ($parsed === []) {
            return array_keys($this->providerDefinitions);
        }

        return $parsed;
    }

    /**
     * @return string[][]
     *
     * @psalm-return array<string, non-empty-list<non-falsy-string>>
     */
    private function resolveFlowProviderOrder(): array
    {
        $flowConfig = (array) config('women_real_estate.ai.flow_provider_order', []);
        $map = [];

        foreach ($flowConfig as $type => $order) {
            $parsed = $this->parseProviderOrder($order);

            if ($parsed !== []) {
                $map[(string) $type] = $parsed;
            }
        }

        return $map;
    }

    /**
     * @return string[]
     *
     * @psalm-return list<non-falsy-string>
     */
    private function parseProviderOrder(mixed $value): array
    {
        if (is_string($value)) {
            $value = explode(',', $value);
        }

        if (! is_array($value)) {
            return [];
        }

        $ordered = array_values(array_filter(array_map(
            static fn ($entry) => trim((string) $entry),
            $value
        )));

        return array_values(array_filter(
            $ordered,
            fn ($provider) => isset($this->providerDefinitions[$provider])
        ));
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function providerOrderFor(string $type): array
    {
        $order = $this->flowProviderOrder[$type] ?? [];

        if ($order === []) {
            return $this->providerOrder;
        }

        return $order;
    }

    private function cache(): CacheRepository
    {
        return $this->cacheRepository ?? Cache::driver();
    }

    /**
     * @return (Carbon|bool|mixed|string)[]
     *
     * @psalm-return array{provider: string, from_cache: bool, generated_at: Carbon,...}
     */
    private function buildResponse(array $payload, string $provider, bool $fromCache, ?string $storedAt = null): array
    {
        $timestamp = $storedAt ? Carbon::parse($storedAt) : Carbon::now();

        $mutated = $payload;
        $mutated['provider'] = $provider;
        $mutated['from_cache'] = $fromCache;
        $mutated['generated_at'] = $timestamp;

        return $mutated;
    }

    private function logProviderError(string $provider, string $type, Throwable $exception): void
    {
        $channel = config('ai.observability.log_channel', 'stack');

        Log::channel($channel)->warning('Women persona AI provider failure', [
            'provider' => $provider,
            'type' => $type,
            'message' => $exception->getMessage(),
        ]);
    }
}

