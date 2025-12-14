<?php

namespace App\Services\Moderation;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Simple adapter for calling the OpenAI moderation endpoint.
 final  * This is intentionally lightweight and safe for initial MVP; it should be
 * hardened with retries, circuit-breakers and rate-limiting in production.
 */
final class OpenAIModerationProvider implements ProviderInterface
{
    #[\Override]
    public function scanText(string $text): array
    {
        $key = config('moderation.openai.api_key');
        $model = config('moderation.openai.model', 'omni-moderation-latest');
        $base = rtrim(config('moderation.openai.base_url', 'https://api.openai.com/v1'), '/');

        if (empty($key) || $key === 'null') {
            // No key configured => fallback to local heuristic
            return (new \App\Services\ContentModerationService())->scanText($text);
        }

        // basic circuit-breaker: if provider failing repeatedly, short-circuit to fallback
        $circuitKey = 'openai_moderation_circuit';
        if (Cache::get($circuitKey, false)) {
            Log::warning('OpenAI moderation circuit is open — using local fallback');
            return (new \App\Services\ContentModerationService())->scanText($text);
        }

        try {
            // retry a few times with exponential backoff
            $resp = Http::withToken($key)
                ->timeout((float) config('moderation.openai.timeout', 5))
                ->retry(3, 100)
                ->post($base.'/moderations', [
                    'model' => $model,
                    'input' => $text,
                ]);

            if (! $resp->successful()) {
                // bump failure counter and potentially open circuit
                $count = Cache::increment('openai_moderation_failures');
                if ($count >= 3) {
                    Cache::put($circuitKey, true, now()->addSeconds(60));
                }

                Log::warning('OpenAI moderation returned non-success response: '.var_export($resp->body(), true));
                return (new \App\Services\ContentModerationService())->scanText($text);
            }

            $body = $resp->json();

            // OpenAI returns categories / category scores — map to simple violations
            $violations = [];
            $results = $body['results'][0] ?? [];
            $categories = $results['categories'] ?? [];

            foreach ($categories as $k => $flagged) {
                if ($flagged) {
                    $violations[] = ['type' => $k, 'match' => $k];
                }
            }

            // success — reset failure counter and increment success metric
            Cache::forget('openai_moderation_failures');
            try {
                Cache::increment('openai_moderation_success');
            } catch (\Throwable $e) {
                // ignore cache storage failures in tests/environments
            }

            return $violations;
        } catch (\Throwable $e) {
            // on exceptions, increment failure and open circuit if needed
            $count = Cache::increment('openai_moderation_failures');
            if ($count >= 3) {
                Cache::put($circuitKey, true, now()->addSeconds(60));
            }

            Log::warning('OpenAI moderation error: '.$e->getMessage());
            return (new \App\Services\ContentModerationService())->scanText($text);
        }
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{type: 'pornographic', match: string}}
     */
    #[\Override]
    public function scanFile(array $fileInfo): array
    {
        // At present we only use filename heuristics for files; image/video analysis
        // would need to upload to provider or use a vision service.
        $filename = mb_strtolower($fileInfo['filename'] ?? '');
        mb_strtolower($fileInfo['mime'] ?? '');

        if (str_contains($filename, 'porn') || str_contains($filename, 'xxx')) {
            return [['type' => 'pornographic', 'match' => $filename]];
        }

        return [];
    }
}
