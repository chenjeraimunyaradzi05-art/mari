<?php

namespace App\Services;

use App\Models\SocialPost;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class AIContentService
{
    private bool $enabled;
    private string $provider;
    private array $providerConfig;
    private int $maxTags;
    private float $fallbackScore;
    private string $logChannel;

    public function __construct()
    {
        $this->enabled = (bool) config('services.ai.enabled', false);
        $this->provider = (string) config('ai.default_provider', 'openai');
        $this->providerConfig = (array) (config('ai.providers', [])[$this->provider] ?? []);
        $this->maxTags = (int) config('ai.content.max_tags', 8);
        $this->fallbackScore = (float) config('ai.content.fallback_score', 48);
        $this->logChannel = (string) config('ai.observability.log_channel', 'stack');
    }

    public function analyzePost(SocialPost $post): array
    {
        if (! $this->enabled) {
            return $this->fallbackWithLog('disabled', $post);
        }

        if (empty($this->providerConfig['api_key'])) {
            return $this->fallbackWithLog('missing-api-key', $post);
        }

        return match ($this->provider) {
            'openai' => $this->analyzeWithOpenAi($post),
            default => $this->fallbackWithLog('unsupported-provider', $post, ['provider' => $this->provider]),
        };
    }

    private function analyzeWithOpenAi(SocialPost $post): array
    {
        $baseUrl = rtrim($this->providerConfig['base_url'] ?? config('services.openai.base_url', 'https://api.openai.com/v1'), '/');
        $endpoint = $baseUrl . '/chat/completions';

        try {
            $response = Http::timeout($this->providerConfig['timeout'] ?? config('services.openai.timeout', 15))
                ->withHeaders(array_filter([
                    'Authorization' => 'Bearer ' . $this->providerConfig['api_key'],
                    'Content-Type' => 'application/json',
                    'OpenAI-Organization' => $this->providerConfig['organization'] ?? config('services.openai.organization'),
                ]))
                ->post($endpoint, $this->buildPromptPayload($post));

            if ($response->successful()) {
                $parsed = $this->parseAIResponse($response->json());

                if ($parsed !== null) {
                    return $parsed;
                }

                return $this->fallbackWithLog('empty-response', $post);
            }

            $this->log('warning', 'ai.social.analysis_http_error', [
                'post_id' => $post->id,
                'status' => $response->status(),
                'provider' => $this->provider,
            ]);
        } catch (\Throwable $e) {
            $this->log('error', 'ai.social.analysis_exception', [
                'post_id' => $post->id,
                'provider' => $this->provider,
                'message' => $e->getMessage(),
            ]);
        }

        return $this->fallbackWithLog('request-failed', $post);
    }

    /**
     * @return ((string|string[])[]|float|int|mixed)[]
     *
     * @psalm-return array{model: mixed, temperature: float, max_tokens: 280, response_format: array{type: 'json_object'}, messages: list{array{role: 'system', content: 'You analyze social posts for a women-focused professional community. Respond in JSON with "tags" (array of hashtags without the # symbol) and "engagement_score" (0-100).'}, array{role: 'user', content: string}}}
     */
    private function buildPromptPayload(SocialPost $post): array
    {
        $caption = trim((string) $post->caption);
        $content = trim((string) $post->content);
        $body = $caption !== '' ? $caption : $content;

        return [
            'model' => $this->providerConfig['chat_model'] ?? config('services.openai.chat_model', 'gpt-4.1-mini'),
            'temperature' => 0.2,
            'max_tokens' => 280,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You analyze social posts for a women-focused professional community. Respond in JSON with "tags" (array of hashtags without the # symbol) and "engagement_score" (0-100).',
                ],
                [
                    'role' => 'user',
                    'content' => sprintf(
                        "Post:\n%s\n\nExisting tags: %s\nContext: %s",
                        $body !== '' ? $body : '[empty]',
                        implode(', ', $this->stringifyExistingTags($post)),
                        $this->buildContextSummary($post)
                    ),
                ],
            ],
        ];
    }

    /**
     * @return (array|float)[]|null
     *
     * @psalm-return array{tags: array, engagement_score: float}|null
     */
    private function parseAIResponse(?array $response): array|null
    {
        if (! is_array($response)) {
            return null;
        }

        $content = trim((string) Arr::get($response, 'choices.0.message.content'));
        if ($content === '') {
            return null;
        }

        $decoded = json_decode($content, true);
        if (is_array($decoded)) {
            $tags = $this->normalizeTags($decoded['tags'] ?? []);
            $score = $this->normalizeScore($decoded['engagement_score'] ?? null);

            if (! empty($tags) || $score !== null) {
                return [
                    'tags' => $tags,
                    'engagement_score' => $score ?? $this->fallbackScore,
                ];
            }
        }

        $tags = $this->normalizeTags($this->extractTagsFromText($content));
        $score = $this->normalizeScore($this->extractScoreFromText($content));

        if (empty($tags) && $score === null) {
            return null;
        }

        return [
            'tags' => $tags,
            'engagement_score' => $score ?? $this->fallbackScore,
        ];
    }

    private function fallbackWithLog(string $reason, SocialPost $post, array $context = []): array
    {
        $analysis = $this->heuristicAnalysis($post);

        $this->log('info', 'ai.social.fallback', array_merge([
            'post_id' => $post->id,
            'reason' => $reason,
            'provider' => $this->provider,
            'engagement_score' => $analysis['engagement_score'],
            'tags' => $analysis['tags'],
        ], $context));

        return $analysis;
    }

    /**
     * @return (array|float)[]
     *
     * @psalm-return array{tags: array, engagement_score: float}
     */
    private function heuristicAnalysis(SocialPost $post): array
    {
        return [
            'tags' => $this->extractTagsFromPost($post),
            'engagement_score' => $this->heuristicScore($post),
        ];
    }

    private function extractTagsFromPost(SocialPost $post): array
    {
        $existing = $this->stringifyExistingTags($post);
        $textTags = $this->extractTagsFromText(
            trim((string) $post->caption . ' ' . (string) $post->content)
        );

        return $this->normalizeTags(array_merge($existing, $textTags));
    }

    /**
     * @return string[]
     *
     * @psalm-return list<non-falsy-string>
     */
    private function stringifyExistingTags(SocialPost $post): array
    {
        $tags = $post->tags;

        if (is_string($tags)) {
            $tags = array_map('trim', explode(',', $tags));
        }

        if (! is_array($tags)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($tag) {
            $normalized = Str::of((string) $tag)->trim()->ltrim('#')->toString();

            return $normalized === '' ? null : $normalized;
        }, $tags)));
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function extractTagsFromText(string $text): array
    {
        preg_match_all('/#([A-Za-z0-9_]+)/', $text, $matches);

        return $matches[1] ?? [];
    }

    private function extractScoreFromText(string $text): ?int
    {
        if (preg_match('/(\d{1,3})/', $text, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function normalizeTags(array|string $source): array
    {
        if (is_string($source)) {
            $source = [$source];
        }

        if (! is_array($source)) {
            return [];
        }

        $normalized = [];
        foreach ($source as $tag) {
            $cleanTag = Str::of((string) $tag)
                ->replace(['#', ',', '.'], ' ')
                ->squish()
                ->replace(' ', '-')
                ->ltrim('#')
                ->trim()
                ->lower()
                ->toString();

            if ($cleanTag === '') {
                continue;
            }

            $normalized[] = Str::limit($cleanTag, 40, '');
        }

        $normalized = array_values(array_unique($normalized));

        if (count($normalized) > $this->maxTags) {
            $normalized = array_slice($normalized, 0, $this->maxTags);
        }

        return $normalized;
    }

    private function normalizeScore(int|null $value): ?float
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value) && $value !== '') {
            if (! is_numeric($value)) {
                return null;
            }
            $value = (float) $value;
        }

        if (is_int($value) || is_float($value)) {
            $clamped = max(0, min(100, (float) $value));

            return round($clamped, 1);
        }

        return null;
    }

    private function heuristicScore(SocialPost $post): float
    {
        $likes = (int) ($post->likes_count ?? 0);
        $comments = (int) ($post->comments_count ?? 0);
        $shares = (int) ($post->shares_count ?? 0);
        $views = (int) ($post->views_count ?? 0);

        $score = $this->fallbackScore
            + min(25, $likes * 0.8)
            + min(25, $comments * 1.5)
            + min(20, $shares * 2)
            + min(10, $views / 200);

        return round(max(10, min(100, $score)), 1);
    }

    private function buildContextSummary(SocialPost $post): string
    {
        $parts = [];

        if ($post->type) {
            $parts[] = 'type:' . $post->type;
        }

        if ($post->visibility) {
            $parts[] = 'visibility:' . $post->visibility;
        }

        if ($post->published_at) {
            $parts[] = 'published:' . $post->published_at->toDateTimeString();
        }

        $parts[] = sprintf(
            'metrics(likes:%d,comments:%d,shares:%d,views:%d)',
            (int) ($post->likes_count ?? 0),
            (int) ($post->comments_count ?? 0),
            (int) ($post->shares_count ?? 0),
            (int) ($post->views_count ?? 0)
        );

        return implode(' | ', array_filter($parts));
    }

    private function log(string $level, string $message, array $context = []): void
    {
        try {
            $logger = Log::channel($this->logChannel);
        } catch (\Throwable) {
            $logger = Log::channel(config('logging.default'));
        }

        if (! method_exists($logger, $level)) {
            $level = 'info';
        }

        $logger->{$level}($message, $context);
    }
}

