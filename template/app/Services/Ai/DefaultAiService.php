<?php

namespace App\Services\Ai;

use App\Contracts\AI\TextModel;
use Illuminate\Support\Arr;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

final class DefaultAiService implements Ai
{
    private int $cacheTtl;

    private TextModel $textModel;

    public function __construct(?TextModel $textModel = null)
    {
        if ($textModel !== null) {
            $this->textModel = $textModel;
            $this->cacheTtl = (int) config('ai.cache_ttl', 900);
            return;
        }

        $providers = (array) config('ai.providers', []);
        $default = (string) config('ai.default_provider', 'openai');

        $cfg = $providers[$default] ?? [];

        try {
            $driver = (string) ($cfg['driver'] ?? $default);

            $this->textModel = match ($driver) {
                'anthropic' => new AnthropicTextModel($cfg['api_key'] ?? null, $cfg['chat_model'] ?? null),
                default => new OpenAITextModel($cfg['api_key'] ?? null, $cfg['organization'] ?? null, $cfg['chat_model'] ?? null, $cfg['embedding_model'] ?? null),
            };
        } catch (\Throwable $exception) {
            // fallback to a minimal OpenAITextModel instance without credentials (best effort)
            $this->textModel = new OpenAITextModel($cfg['api_key'] ?? null, $cfg['organization'] ?? null, $cfg['chat_model'] ?? null, $cfg['embedding_model'] ?? null);
        }

        $this->cacheTtl = (int) config('ai.cache_ttl', 900);
    }

    #[\Override]
    public function caption(string $textContext): string
    {
        $context = $this->normalizeContext($textContext);

        return $this->rememberResult('caption', $context, function () use ($context): string {
            return $this->callAi(
                function () use ($context): ?string {
                $prompt = <<<PROMPT
You help women-focused community members craft inclusive social captions.
Given the context below, respond with JSON: {"caption": "string <= 180 chars"}.
Context:
{$context}
-- END CONTEXT --
PROMPT;

                    $raw = $this->textModel->generate($prompt, ['max_tokens' => 160]);
                    $caption = $this->extractStringField($raw, 'caption');

                    return $caption ? Str::limit($caption, 220, '') : null;
                },
                fn () => $this->fallbackCaption($context)
            );
        });
    }

    #[\Override]
    public function tags(string $textContext): array
    {
        $context = $this->normalizeContext($textContext);

        return $this->rememberResult('tags', $context, function () use ($context): array {
            return $this->callAi(
                /**
                 * @return null|string[]
                 *
                 * @psalm-return array<int, string>|null
                 */
                /**
                 * @return null|string[]
                 *
                 * @psalm-return list<non-empty-string>|null
                 */
                function () use ($context): array|null {
                $prompt = <<<PROMPT
Suggest 3-5 lowercase topic tags (no leading #) for the community update below.
Reply with JSON: {"tags": ["tag-one", "tag-two"]}.
Context:
{$context}
-- END CONTEXT --
PROMPT;

                    $raw = $this->textModel->generate($prompt, ['max_tokens' => 120]);
                    $decoded = $this->decodeJson($raw);
                    $tags = $this->normaliseTagArray(Arr::get($decoded, 'tags', []));

                    if ($tags !== []) {
                        return $tags;
                    }

                    if (is_string($raw)) {
                        return $this->normaliseTagArray(explode(',', $raw));
                    }

                    return null;
                },
                fn () => $this->fallbackTags($context)
            );
        });
    }

    #[\Override]
    public function moderate(string $textContext): bool
    {
        $context = $this->normalizeContext($textContext);

        return $this->rememberResult('moderate', $context, function () use ($context): bool {
            return $this->callAi(
                function () use ($context): ?bool {
                $prompt = <<<PROMPT
You review short social captions. Reply with JSON {"safe": true|false}.
Mark safe=false if the text includes hate, slurs, threats, or harassment.
Text:
{$context}
-- END TEXT --
PROMPT;

                    $raw = $this->textModel->generate($prompt, ['max_tokens' => 60]);
                    $decoded = $this->decodeJson($raw);

                    if (is_bool(Arr::get($decoded, 'safe'))) {
                        return (bool) $decoded['safe'];
                    }

                    if (is_string($raw)) {
                        $normalized = Str::lower($raw);

                        if (str_contains($normalized, 'false') || str_contains($normalized, 'unsafe')) {
                            return false;
                        }

                        if (str_contains($normalized, 'true') || str_contains($normalized, 'safe')) {
                            return true;
                        }
                    }

                    return null;
                },
                fn () => $this->fallbackModeration($context)
            );
        });
    }

    private function callAi(callable $callback, callable $fallback)
    {
        try {
            $result = $callback();

            if ($result !== null && $result !== '' && $result !== []) {
                return $result;
            }
        } catch (Throwable $exception) {
            Log::warning('ai.assist.failed', [
                'message' => $exception->getMessage(),
                'exception' => $exception,
            ]);
        }

        return $fallback();
    }

    private function normalizeContext(string $context): string
    {
        $trimmed = trim($context);

        if ($trimmed === '') {
            return 'Women helping women thrive through apprenticeships, careers, and supportive housing.';
        }

        return Str::limit($trimmed, 1200, '');
    }

    private function fallbackCaption(string $context): string
    {
        $base = $context !== '' ? Str::limit($context, 160, '') : 'Sharing today’s wins from our women-led community';

        return rtrim($base, '.') . ' — ✨ Women at work, together';
    }

    /**
     * @return string[]
     *
     * @psalm-return list<'apprenticeships'|'careers'|'community'|'financial-wellbeing'|'mentorship'|'women'|'women-housing'|'women-in-tech'|'women-leaders'|'women-real-estate'>
     */
    private function fallbackTags(string $context): array
    {
        $tags = ['women', 'community', 'careers'];
        $context = Str::lower($context);

        $keywords = [
            'tech' => 'women-in-tech',
            'apprentice' => 'apprenticeships',
            'mentor' => 'mentorship',
            'housing' => 'women-housing',
            'finance' => 'financial-wellbeing',
            'real estate' => 'women-real-estate',
            'leadership' => 'women-leaders',
        ];

        foreach ($keywords as $needle => $tag) {
            if (str_contains($context, $needle)) {
                $tags[] = $tag;
            }
        }

        return array_values(array_unique(array_slice($tags, 0, 6)));
    }

    private function fallbackModeration(string $context): bool
    {
        $blocked = ['hate', 'violence', 'harass', 'slur'];
        $context = Str::lower($context);

        foreach ($blocked as $word) {
            if ($word !== '' && str_contains($context, $word)) {
                return false;
            }
        }

        return true;
    }

    private function decodeJson(string $raw): array
    {
        if (! is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function extractStringField(string $raw, string $field): ?string
    {
        $decoded = $this->decodeJson($raw);
        $value = Arr::get($decoded, $field);

        if (is_string($value) && $value !== '') {
            return trim($value);
        }

        if (is_string($raw) && trim($raw) !== '') {
            return trim($raw);
        }

        return null;
    }

    /**
     * @param iterable<mixed> $candidates
     *
     * @return string[]
     *
     * @psalm-return list<non-empty-string>
     */
    private function normaliseTagArray(iterable $candidates): array
    {
        $tags = [];

        foreach ($candidates as $candidate) {
            if (is_array($candidate)) {
                $candidate = Arr::get($candidate, 'tag', Arr::first($candidate));
            }

            if (! is_string($candidate)) {
                continue;
            }

            $tag = Str::of($candidate)
                ->lower()
                ->replace('#', '')
                ->trim()
                ->slug('-')
                ->value();

            if ($tag !== '') {
                $tags[] = $tag;
            }
        }

        return array_values(array_unique(array_slice($tags, 0, 6)));
    }

    private function rememberResult(string $type, string $context, callable $callback)
    {
        if ($this->cacheTtl <= 0) {
            return $callback();
        }

        $cacheKey = $this->cacheKey($type, $context);

        return Cache::remember($cacheKey, $this->cacheTtl, $callback);
    }

    private function cacheKey(string $type, string $context): string
    {
        return 'social_ai_assist:' . $type . ':' . sha1($context);
    }
}

