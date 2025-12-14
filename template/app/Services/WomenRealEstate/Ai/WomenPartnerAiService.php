<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate\Ai;

use App\Contracts\AI\TextModel;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WomenPartnerAiService
{
    private const CACHE_PREFIX = 'women_real_estate:partner_ai';

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

    /**
     * @psalm-return array<string, mixed>
     */
    public function matchNarrative(WomenPartnerProject $project, WomenCohortProfile $profile, array $context = []): array
    {
        $fingerprint = [
            'project' => $project->getKey(),
            'profile' => $profile->getKey(),
            'summary_hash' => md5((string) $project->summary),
        ];

        return $this->dispatchThroughProviders('partner_matching', $fingerprint, /**
         * @return (array|mixed|string)[]|null
         *
         * @psalm-return array{summary: string, values_alignment: mixed, activation_steps: array, provider: string}|null
         */
        /**
         * @return ((null|string[])[]|mixed|string)[]|null
         *
         * @psalm-return array{summary: string, values_alignment: mixed, activation_steps: array<int, array{label: string, urgency: string}|null>, provider: string}|null
         */
        function (TextModel $client, string $providerKey) use ($project, $profile, $context): array|null {
            $prompt = $this->buildPartnerPrompt($project, $profile, $context);
            $raw = $client->generate($prompt, [
                'max_tokens' => 520,
                'temperature' => 0.32,
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
                'values_alignment' => Arr::get($decoded, 'values_alignment', []),
                'activation_steps' => $this->normaliseActions(Arr::get($decoded, 'activation_steps', [])),
                'provider' => $providerKey,
            ];
        }, fn () => $this->fallbackNarrative($project, $profile));
    }

    private function buildPartnerPrompt(WomenPartnerProject $project, WomenCohortProfile $profile, array $context): string
    {
        $payload = json_encode([
            'project' => [
                'title' => $project->title,
                'status' => $project->status?->value,
                'summary' => $project->summary,
                'capital_stack' => $project->capital_stack,
            ],
            'profile' => [
                'persona' => $profile->persona?->value ?? $profile->persona,
                'region' => $profile->region,
                'preferred_types' => $profile->preferences['preferred_listing_types'] ?? [],
                'equity_commitments' => $profile->ai_insights['equity_commitments'] ?? [],
            ],
            'impact_commitments' => config('women_real_estate.impact'),
            'context' => $context,
            'instructions' => 'Return JSON with keys summary, values_alignment (array of {pillar,confidence}), activation_steps (array of {label,urgency}). Reference socio-economic equity, carbon positivity, flora/fauna regeneration.',
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You are the WomenRise Partnerships AI championing regenerative, gender-equitable capital coordination. Celebrate carbon-positive actions, highlight socio-economic equity levers, and weave in flora/fauna uplift commitments.
Only produce JSON.
{$payload}
PROMPT;
    }

    /**
     * @return (false|string|string[][])[]
     *
     * @psalm-return array{summary: string, values_alignment: list{array{pillar: 'equity', confidence: 'high'}, array{pillar: 'climate', confidence: 'medium'}}, activation_steps: list{array{label: 'Schedule a regenerative capital lab with community elders', urgency: 'near-term'}, array{label: 'Co-design carbon-positive site rituals uplifting local fauna', urgency: 'immediate'}}, provider: 'fallback', from_cache: false}
     */
    private function fallbackNarrative(WomenPartnerProject $project, WomenCohortProfile $profile): array
    {
        $personaLabel = $profile->persona?->label()
            ?? Str::headline((string) ($profile->persona ?? 'womenrise member'));

        return [
            'summary' => sprintf(
                '%s is a strong values-fit: %s can unlock capital while pledging biodiversity offsets together.',
                $personaLabel,
                $project->title
            ),
            'values_alignment' => [
                ['pillar' => 'equity', 'confidence' => 'high'],
                ['pillar' => 'climate', 'confidence' => 'medium'],
            ],
            'activation_steps' => [
                ['label' => 'Schedule a regenerative capital lab with community elders', 'urgency' => 'near-term'],
                ['label' => 'Co-design carbon-positive site rituals uplifting local fauna', 'urgency' => 'immediate'],
            ],
            'provider' => 'fallback',
            'from_cache' => false,
        ];
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

    /**
     * @return (null|string[])[]
     *
     * @psalm-return array<int, array{label: string, urgency: string}|null>
     */
    private function normaliseActions(mixed $value): array
    {
        return collect(Arr::wrap($value))
            ->map(function ($action) {
                if (is_string($action)) {
                    return [
                        'label' => trim($action),
                        'urgency' => 'near-term',
                    ];
                }

                if (is_array($action)) {
                    return [
                        'label' => trim((string) Arr::get($action, 'label', 'Align on equity safeguards.')),
                        'urgency' => (string) Arr::get($action, 'urgency', 'near-term'),
                    ];
                }

                return null;
            })
            ->filter(fn ($action) => is_array($action) && $action['label'] !== '')
            ->values()
            ->all();
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
    private function resolveProviderOrder(): array
    {
        $ordered = $this->parseProviderOrder(config('women_real_estate.ai.provider_order'));

        if ($ordered === []) {
            $ordered = array_keys($this->providerDefinitions);
        }

        return $ordered;
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

        Log::channel($channel)->warning('Women partner AI provider failure', [
            'provider' => $provider,
            'type' => $type,
            'message' => $exception->getMessage(),
        ]);
    }
}

