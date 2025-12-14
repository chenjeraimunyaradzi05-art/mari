<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate\Ai;

use App\Contracts\AI\TextModel;
use App\Models\WomenHousingListing;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\WomenRealEstate\WomenCohortTimelineService;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

final class WomenListingAiService
{
    private const CACHE_PREFIX = 'women_real_estate:ai';

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

    private ?WomenCohortTimelineService $timelineService = null;

    public function listingInsights(WomenHousingListing $listing, array $context = []): array
    {
        $payload = $this->dispatchThroughProviders('listing_insights', $listing->id, /**
         * @return (array|string)[]|null
         *
         * @psalm-return array{summary: string, strengths: array, opportunities: array, next_action: string}|null
         */
        /**
         * @return (string|string[])[]|null
         *
         * @psalm-return array{summary: string, strengths: array<int, string>, opportunities: array<int, string>, next_action: string}|null
         */
        function (TextModel $client, string $providerKey) use ($listing, $context): array|null {
            $prompt = $this->buildListingInsightPrompt($listing, $context, $providerKey);
            $raw = $client->generate($prompt, ['max_tokens' => 600]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            return [
                'summary' => (string) Arr::get($decoded, 'summary', ''),
                'strengths' => $this->normaliseStringArray(Arr::get($decoded, 'strengths', [])),
                'opportunities' => $this->normaliseStringArray(Arr::get($decoded, 'opportunities', [])),
                'next_action' => (string) Arr::get($decoded, 'next_action', ''),
            ];
    }, fn () => $this->fallbackListingInsights($listing, $context));

        return $payload + ['listing_id' => $listing->id];
    }

    public function ownerRecommendations(int $ownerId, array $context = []): array
    {
        $metrics = [
            'dashboard' => Arr::get($context, 'metrics.dashboard', []),
            'social' => Arr::get($context, 'metrics.social', []),
            'engagement' => Arr::get($context, 'metrics.engagement', []),
        ];

        $listingsForPrompt = $this->normaliseListingsForPrompt(Arr::get($context, 'listings', []));
        $fingerprint = [
            'owner' => $ownerId,
            'metrics' => $metrics,
            'listings' => $listingsForPrompt,
        ];

        $sanitisedContext = [
            'metrics' => $metrics,
            'listings' => $listingsForPrompt,
        ];

        $recommendations = $this->dispatchThroughProviders(
            'owner_recommendations',
            $ownerId,
            /**
             * @return (((mixed|string)[]|null)[]|string)[]|null
             *
             * @psalm-return array{actions: array<int, array{label: string, priority: string, rationale?: string, listing_id?: mixed}|null>, focus_metric: string}|null
             */
            function (TextModel $client, string $providerKey) use ($metrics, $listingsForPrompt): array|null {
                $prompt = $this->buildOwnerRecommendationPrompt($metrics, $listingsForPrompt);
                $raw = $client->generate($prompt, ['max_tokens' => 700]);
                $decoded = $this->decodeJsonPayload($raw);

                if (! is_array($decoded)) {
                    return null;
                }

                return [
                    'actions' => collect(Arr::get($decoded, 'actions', []))
                        ->map(function ($item) {
                            if (is_string($item)) {
                                return ['label' => $item, 'priority' => 'medium'];
                            }

                            if (is_array($item)) {
                                return [
                                    'label' => (string) Arr::get($item, 'label', Arr::get($item, 'action', '')),
                                    'priority' => (string) Arr::get($item, 'priority', 'medium'),
                                    'rationale' => (string) Arr::get($item, 'rationale', ''),
                                    'listing_id' => Arr::get($item, 'listing_id'),
                                ];
                            }

                            return null;
                        })
                        ->filter()
                        ->values()
                        ->all(),
                    'focus_metric' => (string) Arr::get($decoded, 'focus_metric', ''),
                ];
            },
            fn () => $this->fallbackOwnerRecommendations($sanitisedContext),
            $fingerprint
        );

        $this->recordOwnerRecommendationTimeline($ownerId, $recommendations);

        return $recommendations;
    }

    public function moderationAssessment(WomenHousingListing $listing, array $context = []): array
    {
        $payload = $this->dispatchThroughProviders('moderation_review', $listing->id, /**
         * @return (array|bool|string)[]|null
         *
         * @psalm-return array{risk_level: string, recommended_action: string, flags: array, auto_hold: bool}|null
         */
        /**
         * @return (bool|string|string[])[]|null
         *
         * @psalm-return array{risk_level: string, recommended_action: string, flags: array<int, string>, auto_hold: bool}|null
         */
        function (TextModel $client, string $providerKey) use ($listing, $context): array|null {
            $prompt = $this->buildModerationPrompt($listing, $context, $providerKey);
            $raw = $client->generate($prompt, ['max_tokens' => 500]);
            $decoded = $this->decodeJsonPayload($raw);

            if (! is_array($decoded)) {
                return null;
            }

            $flags = $this->normaliseStringArray(Arr::get($decoded, 'flags', []));

            return [
                'risk_level' => (string) Arr::get($decoded, 'risk_level', 'low'),
                'recommended_action' => (string) Arr::get($decoded, 'recommended_action', ''),
                'flags' => $flags,
                'auto_hold' => (bool) Arr::get($decoded, 'auto_hold', false) || in_array('safety', $flags, true),
            ];
    }, fn () => $this->fallbackModerationAssessment($listing, $context));

        return $payload + ['listing_id' => $listing->id];
    }

    /**
     * @return (Carbon|bool|mixed|string|string[])[]
     *
     * @psalm-return array{provider: string, from_cache: bool, generated_at: Carbon, errors?: mixed|non-empty-list<string>,...}
     */
    private function dispatchThroughProviders(string $type, int $resourceId, callable $callback, callable $fallback, ?array $fingerprint = null): array
    {
        $results = [];
        $cacheKeyFingerprint = $fingerprint ?? [$resourceId];

        foreach ($this->providerOrderFor($type) as $providerKey) {
            $definition = $this->providerDefinitions[$providerKey] ?? null;

            if (! $this->providerIsEnabled($providerKey, $definition)) {
                continue;
            }

            $cacheKey = $this->cacheKey($providerKey, $type, $cacheKeyFingerprint);
            $cached = $this->cache()->get($cacheKey);

            if (is_array($cached) && isset($cached['value'])) {
                return $this->buildResponse(
                    (array) $cached['value'],
                    (string) ($cached['provider'] ?? $providerKey),
                    true,
                    isset($cached['stored_at']) ? (string) $cached['stored_at'] : null
                );
            }

            $client = $this->clientFor($providerKey, $definition);

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
                    ], $this->cacheTtlFor($type, $providerKey, $definition));

                    return $this->buildResponse($value, $providerKey, false, $storedAt);
                }
            } catch (Throwable $exception) {
                $this->logProviderError($providerKey, $type, $exception);
                $results[] = $exception->getMessage();
            }
        }

        $fallbackPayload = $this->buildResponse($fallback(), 'fallback', false);

        if ($results !== []) {
            $fallbackPayload['errors'] = $results;
        }

        return $fallbackPayload;
    }

    private function buildListingInsightPrompt(WomenHousingListing $listing, array $context, string $providerKey): string
    {
        $summaryContext = $this->listingContext($listing, $context);
        $locale = (string) config('women_real_estate.ai.default_prompt_locale', 'en-AU');
        $metadata = json_encode($summaryContext, JSON_THROW_ON_ERROR);

        return <<<PROMPT
You are an Assistive AI helping women-led real-estate founders optimise their listings. Respond in {$locale} locale.
Given the following listing JSON, produce a JSON object with keys: summary (<=80 words), strengths (array of <=3 bullets), opportunities (array of <=3 bullets), next_action (single sentence).
Return only valid JSON.
Listing:
{$metadata}
PROMPT;
    }

    private function buildOwnerRecommendationPrompt(array $metrics, array $listings): string
    {
        $locale = (string) config('women_real_estate.ai.default_prompt_locale', 'en-AU');
        $payload = json_encode([
            'dashboard' => $metrics['dashboard'] ?? [],
            'social' => $metrics['social'] ?? [],
            'engagement' => $metrics['engagement'] ?? [],
            'listings' => $listings,
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
You advise housing entrepreneurs on next best actions. Work in {$locale}.
Using the provided analytics JSON, return actionable recommendations as JSON with structure: {"focus_metric": string, "actions": [ {"label": string, "priority": "low"|"medium"|"high", "rationale": string, "listing_id": int|null } ] }.
Keep actions to 3 items, be specific, grounded in the metrics, and tailored to women housing outcomes.
Analytics:
{$payload}
PROMPT;
    }

    private function buildModerationPrompt(WomenHousingListing $listing, array $context, string $providerKey): string
    {
        $locale = (string) config('women_real_estate.ai.default_prompt_locale', 'en-AU');
        $payload = json_encode([
            'listing' => $this->listingContext($listing, $context),
            'recent_flags' => Arr::get($context, 'recent_flags', []),
            'safety_rules' => Arr::get($context, 'safety_rules', []),
        ], JSON_THROW_ON_ERROR);

        return <<<PROMPT
Act as a safety reviewer for women-only housing listings. Reply in {$locale}.
Return JSON with keys: risk_level (low|medium|high), flags (array of slugs), recommended_action (sentence), auto_hold (boolean).
Consider tone, discrimination, or missing critical info. Only output JSON.
Context JSON:
{$payload}
PROMPT;
    }

    /**
     * @return (string|string[])[]
     *
     * @psalm-return array{summary: string, strengths: list<'Amenity list showcases unique comforts for women households.'|'No mortgage required lowers entry barriers.'|'Pricing published gives prospects confidence.'>, opportunities: non-empty-list<'Add indicative pricing to increase qualified leads.'|'Expand the description to cover transport, neighbourhood and support networks.'|'Layer in safety and accessibility amenities to stand out.'|'Share more detail about safety and support offerings.'>, next_action: 'Highlight community, safety and affordability touch-points in your next update.'}
     */
    private function fallbackListingInsights(WomenHousingListing $listing, array $context): array
    {
        $strengths = [];
        $opportunities = [];

        if ($listing->price_cents) {
            $strengths[] = 'Pricing published gives prospects confidence.';
        } else {
            $opportunities[] = 'Add indicative pricing to increase qualified leads.';
        }

        if (! empty($listing->amenities)) {
            $strengths[] = 'Amenity list showcases unique comforts for women households.';
        } else {
            $opportunities[] = 'Layer in safety and accessibility amenities to stand out.';
        }

        if ($listing->description && strlen((string) $listing->description) < 240) {
            $opportunities[] = 'Expand the description to cover transport, neighbourhood and support networks.';
        }

        if ($listing->mortgage_required === false) {
            $strengths[] = 'No mortgage required lowers entry barriers.';
        }

        return [
            'summary' => Str::limit((string) ($listing->description ?? 'Listing overview pending.'), 160),
            'strengths' => array_values(array_unique($strengths)),
            'opportunities' => array_values(array_unique($opportunities ?: ['Share more detail about safety and support offerings.'])),
            'next_action' => 'Highlight community, safety and affordability touch-points in your next update.',
        ];
    }

    /**
     * @return ((mixed|string)[][]|string)[]
     *
     * @psalm-return array{focus_metric: 'portfolio_health', actions: list{0: array{label: string, priority: 'high'|'low'|'medium', rationale: string, listing_id?: mixed}, 1?: array{label: 'Follow up high-risk mortgage applicants with financial wellbeing resources.'|'Publish another listing targeting women caregivers or multigenerational households.', priority: 'medium', rationale: 'Mortgage telemetry flagged elevated risk leads.'|'Portfolio breadth is limited; diversify to reach broader audiences.'}, 2?: array{label: 'Publish another listing targeting women caregivers or multigenerational households.', priority: 'medium', rationale: 'Portfolio breadth is limited; diversify to reach broader audiences.'}}}
     */
    private function fallbackOwnerRecommendations(array $context): array
    {
        $actions = [];
        $metrics = Arr::get($context, 'metrics.dashboard', []);
        $social = Arr::get($context, 'metrics.social.recent_window_total');
        $totalListings = (int) Arr::get($metrics, 'total_quotes', 0);
        $recentShares = is_numeric($social) ? (int) $social : 0;

        if ($recentShares === 0) {
            $actions[] = [
                'label' => 'Queue a fresh social share for your most active listing.',
                'priority' => 'high',
                'rationale' => 'No recent social engagement detected in the last window.',
                'listing_id' => Arr::get($context, 'listings.0.id'),
            ];
        }

        if (($metrics['risk_breakdown']['high'] ?? 0) > 0) {
            $actions[] = [
                'label' => 'Follow up high-risk mortgage applicants with financial wellbeing resources.',
                'priority' => 'medium',
                'rationale' => 'Mortgage telemetry flagged elevated risk leads.',
            ];
        }

        if ($totalListings < 3) {
            $actions[] = [
                'label' => 'Publish another listing targeting women caregivers or multigenerational households.',
                'priority' => 'medium',
                'rationale' => 'Portfolio breadth is limited; diversify to reach broader audiences.',
            ];
        }

        if ($actions === []) {
            $actions[] = [
                'label' => 'Continue monitoring mortgage quote sentiment weekly.',
                'priority' => 'low',
                'rationale' => 'No urgent interventions detected.',
            ];
        }

        return [
            'focus_metric' => 'portfolio_health',
            'actions' => $actions,
        ];
    }

    private function recordOwnerRecommendationTimeline(int $ownerId, array $recommendations): void
    {
        if ($this->timelineService === null) {
            // resolve lazily so tests that use this service without explicit
            // DI still record timeline events.
            try {
                $this->timelineService = app(\App\Services\WomenRealEstate\WomenCohortTimelineService::class);
            } catch (\Throwable $e) {
                return;
            }
        }

        $actions = Arr::get($recommendations, 'actions', []);

        if (! is_array($actions) || $actions === []) {
            return;
        }

        $profile = WomenCohortProfile::query()
            ->where('user_id', $ownerId)
            ->first();

        if (! $profile) {
            return;
        }

        $steps = collect($actions)
            ->map(function ($action) {
                if (is_string($action)) {
                    return trim($action);
                }

                if (! is_array($action)) {
                    return null;
                }

                $label = trim((string) Arr::get($action, 'label', Arr::get($action, 'action', '')));

                if ($label === '') {
                    return null;
                }

                $priority = trim((string) Arr::get($action, 'priority', ''));

                return $priority !== ''
                    ? sprintf('[%s] %s', Str::upper($priority), $label)
                    : $label;
            })
            ->filter()
            ->values()
            ->all();

        if ($steps === []) {
            return;
        }

        $summary = sprintf(
            'Portfolio focus: %s',
            Str::headline((string) ($recommendations['focus_metric'] ?? 'portfolio health'))
        );

        $this->timelineService->recordAiGuidanceEvent($profile, [
            'summary' => $summary,
            'activation_steps' => $steps,
            'provider' => $recommendations['provider'] ?? null,
        ], [
            'source' => 'portfolio_recommendations',
            'subject' => 'Listing portfolio',
            'event_type' => 'portfolio_recommendation',
            'fingerprint' => $this->buildOwnerRecommendationFingerprint($ownerId, $summary, $steps),
        ]);
    }

    private function buildOwnerRecommendationFingerprint(int $ownerId, string $summary, array $steps): string
    {
        try {
            $payload = json_encode([
                'owner_id' => $ownerId,
                'summary' => $summary,
                'steps' => $steps,
            ], JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            $payload = serialize([$ownerId, $summary, $steps, $exception->getMessage()]);
        }

        return hash('sha1', $payload);
    }

    /**
     * @return (bool|string|string[])[]
     *
     * @psalm-return array{risk_level: 'high'|'low'|'medium', recommended_action: 'Pause the listing and escalate to human moderators.'|'Review copy for inclusive and safety-first language.', flags: list<'missing_description'|'prior_flags'|'unknown_visibility'>, auto_hold: bool}
     */
    private function fallbackModerationAssessment(WomenHousingListing $listing, array $context): array
    {
        $risk = 'low';
        $flags = [];

        if (empty($listing->description)) {
            $risk = 'medium';
            $flags[] = 'missing_description';
        }

        if (! in_array($listing->visibility, ['public', 'private'], true)) {
            $risk = 'medium';
            $flags[] = 'unknown_visibility';
        }

        if ($listing->moderation_status === 'flagged') {
            $risk = 'high';
            $flags[] = 'prior_flags';
        }

        return [
            'risk_level' => $risk,
            'recommended_action' => $risk === 'high'
                ? 'Pause the listing and escalate to human moderators.'
                : 'Review copy for inclusive and safety-first language.',
            'flags' => array_values(array_unique($flags)),
            'auto_hold' => $risk === 'high',
        ];
    }

    /**
     * @return (array|bool|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, title: string, audience: null|string, price_cents: int|null, currency: string, location: array|null, amenities: array|null, mortgage_required: bool, description: string, moderation_status: string, metrics: mixed}
     */
    private function listingContext(WomenHousingListing $listing, array $context): array
    {
        return [
            'id' => $listing->id,
            'title' => $listing->title,
            'audience' => $listing->audience,
            'price_cents' => $listing->price_cents,
            'currency' => $listing->currency,
            'location' => $listing->location,
            'amenities' => $listing->amenities,
            'mortgage_required' => $listing->mortgage_required,
            'description' => Str::limit((string) ($listing->description ?? ''), 1_200),
            'moderation_status' => $listing->moderation_status,
            'metrics' => Arr::get($context, 'metrics', []),
        ];
    }

    /**
     * @return ((array|bool|int|mixed|null|string)[]|null)[]
     *
     * @psalm-return array<int, array{id: int|mixed, title: mixed|string, audience: mixed|null|string, price_cents?: int|null, currency?: string, location?: array|null, amenities?: array|null, mortgage_required?: bool, description?: string, moderation_status: mixed|string, metrics?: mixed, mortgage_quotes_count?: mixed, social_share_count?: mixed}|null>
     */
    private function normaliseListingsForPrompt(mixed $listings): array
    {
        return collect(Arr::wrap($listings))
            ->take(6)
            ->map(function ($item) {
                if ($item instanceof WomenHousingListing) {
                    return $this->listingContext($item, []);
                }

                if (is_array($item)) {
                    return [
                        'id' => Arr::get($item, 'id'),
                        'title' => Arr::get($item, 'title'),
                        'audience' => Arr::get($item, 'audience'),
                        'mortgage_quotes_count' => Arr::get($item, 'mortgage_quotes_count'),
                        'social_share_count' => Arr::get($item, 'social_share_count'),
                        'moderation_status' => Arr::get($item, 'moderation_status'),
                    ];
                }

                return null;
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normaliseStringArray(mixed $value): array
    {
        return collect(Arr::wrap($value))
            ->map(static fn ($item) => trim((string) $item))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @psalm-return array<string, mixed>|null
     */
    private function decodeJsonPayload(string $raw): array|null
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
            /** @var array<string, mixed>|null $decoded */
            $decoded = json_decode($slice, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            return null;
        }

        return $decoded;
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

        Log::channel($channel)->warning('Women listing AI provider failure', [
            'provider' => $provider,
            'type' => $type,
            'message' => $exception->getMessage(),
        ]);
    }
}

