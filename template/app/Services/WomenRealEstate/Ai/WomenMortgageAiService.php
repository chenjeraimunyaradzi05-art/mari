<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate\Ai;

use App\Contracts\AI\TextModel;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WomenMortgageAiService
{
    private const CACHE_PREFIX = 'women_real_estate:mortgage_ai';

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
    public function climatePositiveGuidance(WomenCohortProfile $profile, array $goalSummary = []): array
    {
        $financial = $profile->financial_profile ?? [];
        $targetPrice = (float) ($financial['target_property_price'] ?? 550000);
        $currentSavings = (float) ($financial['savings_balance'] ?? Arr::get($goalSummary, 'primary_goal.current', 62000));
        $persona = (string) ($profile->persona?->value ?? $profile->persona ?? 'first_home_buyer');

        $fingerprint = [
            'profile' => $profile->getKey(),
            'persona' => $persona,
            'target_price' => round($targetPrice, -3),
            'savings' => round($currentSavings, -3),
        ];

        return $this->dispatchThroughProviders('mortgage_guidance', $fingerprint, /**
         * @return (array|string)[]|null
         *
         * @psalm-return array{headline: string, risk_rating: string, next_actions: array, sustainability_plan: array{carbon_score: int, flora_fauna_support: string, community_equity: string}, provider: string}|null
         */
        /**
         * @return ((int|null|string|string[])[]|string)[]|null
         *
         * @psalm-return array{headline: string, risk_rating: string, next_actions: array<int, array{label: string, impact: string, urgency: string}|null>, sustainability_plan: array{carbon_score: int, flora_fauna_support: string, community_equity: string}, provider: string}|null
         */
        function (TextModel $client, string $providerKey) use ($profile, $financial, $goalSummary, $persona): array|null {
            $prompt = $this->buildGuidancePrompt($profile, $financial, $goalSummary, $persona);
            $raw = $client->generate($prompt, [
                'max_tokens' => 650,
                'temperature' => 0.28,
            ]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            $headline = trim((string) Arr::get($decoded, 'headline', ''));

            if ($headline === '') {
                return null;
            }

            return [
                'headline' => Str::limit($headline, 180),
                'risk_rating' => strtolower((string) Arr::get($decoded, 'risk_rating', 'medium')),
                'next_actions' => $this->normaliseActions(Arr::get($decoded, 'next_actions', [])),
                'sustainability_plan' => [
                    'carbon_score' => (int) Arr::get($decoded, 'sustainability_plan.carbon_score', 65),
                    'flora_fauna_support' => (string) Arr::get($decoded, 'sustainability_plan.flora_fauna_support', 'Fund a local habitat regeneration session.'),
                    'community_equity' => (string) Arr::get($decoded, 'sustainability_plan.community_equity', 'Prioritise First Nations owned contractors.'),
                ],
                'provider' => $providerKey,
            ];
        }, fn () => $this->fallbackGuidance($targetPrice, $currentSavings, $persona));
    }

    private function buildGuidancePrompt(WomenCohortProfile $profile, array $financial, array $goalSummary, string $persona): string
    {
        $payload = json_encode([
            'persona' => $persona,
            'financial_profile' => $financial,
            'goal_summary' => $goalSummary,
            'impact_commitments' => config('women_real_estate.impact'),
            'instructions' => 'Return JSON with keys headline, risk_rating (low|medium|high), next_actions (array of {label,impact,urgency}), sustainability_plan (carbon_score:int, flora_fauna_support, community_equity). Mention how plan benefits communities, flora, fauna, and emissions.',
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You are the WomenRise Mortgage Guide ensuring carbon-positive, justice-first finance journeys. Highlight socio-economic equity gains and regenerative practices for flora and fauna.
Only output JSON.
{$payload}
PROMPT;
    }

    /**
     * @return ((int|string|string[])[]|false|string)[]
     *
     * @psalm-return array{headline: 'Stabilise your deposit momentum while banking impact credits for local habitats.', risk_rating: 'high'|'low'|'medium', next_actions: list{array{label: 'Automate weekly green savings transfers', impact: 'equity', urgency: 'near-term'}, array{label: 'Pledge 1% of loan towards biodiversity offsets', impact: 'climate', urgency: 'immediate'}}, sustainability_plan: array{carbon_score: 64|82, flora_fauna_support: 'Sponsor native pollinator corridors tied to your property search.', community_equity: 'Direct a portion of fees to women-owned, First Nations-led building crews.'}, provider: 'fallback', from_cache: false}
     */
    private function fallbackGuidance(float $targetPrice, float $currentSavings, string $persona): array
    {
        $depositRatio = $targetPrice > 0 ? round($currentSavings / $targetPrice, 2) : 0.0;
        $risk = $depositRatio >= 0.2 ? 'low' : ($depositRatio >= 0.1 ? 'medium' : 'high');

        return [
            'headline' => 'Stabilise your deposit momentum while banking impact credits for local habitats.',
            'risk_rating' => $risk,
            'next_actions' => [
                ['label' => 'Automate weekly green savings transfers', 'impact' => 'equity', 'urgency' => 'near-term'],
                ['label' => 'Pledge 1% of loan towards biodiversity offsets', 'impact' => 'climate', 'urgency' => 'immediate'],
            ],
            'sustainability_plan' => [
                'carbon_score' => $risk === 'low' ? 82 : 64,
                'flora_fauna_support' => 'Sponsor native pollinator corridors tied to your property search.',
                'community_equity' => 'Direct a portion of fees to women-owned, First Nations-led building crews.',
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
     * @psalm-return array<int, array{label: string, impact: string, urgency: string}|null>
     */
    private function normaliseActions(mixed $value): array
    {
        return collect(Arr::wrap($value))
            ->map(function ($action) {
                if (is_string($action)) {
                    return [
                        'label' => trim($action),
                        'impact' => 'equity',
                        'urgency' => 'near-term',
                    ];
                }

                if (is_array($action)) {
                    return [
                        'label' => trim((string) Arr::get($action, 'label', 'Advance equity through safer lending.')),
                        'impact' => (string) Arr::get($action, 'impact', 'climate'),
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

        Log::channel($channel)->warning('Women mortgage AI provider failure', [
            'provider' => $provider,
            'type' => $type,
            'message' => $exception->getMessage(),
        ]);
    }
}

