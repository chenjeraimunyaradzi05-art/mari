<?php

namespace App\Services\Social;

use App\Jobs\Social\FinalizeSocialImportJob;
use App\Models\SocialImportJob;
use App\Models\SocialIntegration;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class LinkImportService
{


    /**
     * @return array{job: SocialImportJob, items: array<int, array<string, mixed>>}
     */
    public function importLinks(User $user, array $links): array
    {
        $normalizedLinks = collect($links)
            ->map(fn ($link) => is_string($link) ? trim($link) : '')
            ->filter(fn ($link) => $link !== '' && filter_var($link, FILTER_VALIDATE_URL))
            ->unique()
            ->values();

        if ($normalizedLinks->isEmpty()) {
            throw ValidationException::withMessages([
                'links' => ['Provide at least one valid URL to import.'],
            ]);
        }

        $maxLinks = max(1, (int) config('social.integrations.max_links_per_request', 5));
        if ($normalizedLinks->count() > $maxLinks) {
            throw ValidationException::withMessages([
                'links' => ["You can import up to {$maxLinks} links at a time."],
            ]);
        }

        $this->enforceRateLimit($user);

        $items = [];
        $providers = $this->integrations->providerConfig();

        foreach ($normalizedLinks as $link) {
            $providerMeta = $this->detectProvider($link, $providers);
            if (! $providerMeta) {
                continue;
            }

            [$providerKey, $config] = $providerMeta;
            $this->integrations->ensureConnection($user, $providerKey);

            $item = $this->buildImportPayload($user, $providerKey, $config, $link);
            if ($item !== null) {
                $items[] = $item;
            }
        }

        if (empty($items)) {
            throw ValidationException::withMessages([
                'links' => ['No supported providers detected in the supplied links.'],
            ]);
        }

        $job = SocialImportJob::create([
            'user_id' => $user->getKey(),
            'provider' => count($items) === 1 ? ($items[0]['provider'] ?? 'multi') : 'multi',
            'type' => 'links',
            'status' => 'queued',
            'payload' => ['links' => $normalizedLinks->all()],
            'started_at' => now(),
        ]);

        FinalizeSocialImportJob::dispatch($job->getKey(), $items)
            ->onConnection(config('social.queue.connection', config('queue.default')))
            ->onQueue(config('social.queue.imports', 'social-imports'));

        return compact('job', 'items');
    }

    /**
     * @param  array<int, string>  $encoded
     * @return array<int, array<string, mixed>>
     */
    public function decodeForSubmission(array $encoded): array
    {
        if (empty($encoded)) {
            return [];
        }

        $maxAttachments = max(1, (int) config('social.integrations.max_attachments_per_post', 5));
        $items = [];

        foreach ($encoded as $payload) {
            if (! is_string($payload) || trim($payload) === '') {
                continue;
            }

            $decoded = json_decode($payload, true);
            if (! is_array($decoded)) {
                continue;
            }

            $required = ['provider', 'type', 'embed_url', 'original_url', 'signature'];
            if (array_diff($required, array_keys($decoded))) {
                continue;
            }

            $signature = $decoded['signature'];
            unset($decoded['signature']);

            if (! $this->validateSignature($decoded, $signature)) {
                continue;
            }

            $decoded['signature'] = $signature;
            $items[] = $decoded;
            if (count($items) >= $maxAttachments) {
                break;
            }
        }

        return $items;
    }

    /**
     * @return ((int|string)|mixed)[]|null
     *
     * @psalm-return list{array-key, mixed}|null
     */
    private function detectProvider(string $url, array $providers): array|null
    {
        $host = Str::of(parse_url($url, PHP_URL_HOST) ?? '')
            ->lower()
            ->replaceFirst('www.', '')
            ->toString();

        foreach ($providers as $key => $config) {
            $domains = (array) ($config['domains'] ?? []);
            foreach ($domains as $domain) {
                if ($host === $domain || Str::endsWith($host, '.'.$domain)) {
                    return [$key, $config];
                }
            }
        }

        return null;
    }

    private function enforceRateLimit(User $user): void
    {
        $raw = (string) config('social.integrations.rate_limits.link_imports', '6:10');
        [$maxAttempts, $windowMinutes] = $this->parseRateLimit($raw);

        $count = SocialImportJob::query()
            ->where('user_id', $user->getKey())
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->count();

        if ($count >= $maxAttempts) {
            throw ValidationException::withMessages([
                'links' => ['You have reached the import rate limit. Try again in a few minutes.'],
            ]);
        }
    }

    /**
     * @return int[]
     *
     * @psalm-return list{int<1, max>, int<1, max>}
     */
    private function parseRateLimit(string $reference): array
    {
        [$attempts, $window] = array_pad(array_map('intval', explode(':', $reference, 2)), 2, 1);
        $attempts = max(1, $attempts);
        $window = max(1, $window);

        return [$attempts, $window];
    }

    /**
     * @return (mixed|null|string)[]|null
     *
     * @psalm-return array{provider: string, type: 'embed'|mixed, original_url: string, embed_url: string, thumbnail_url: null|string, title: string, remote_id: null|string, signature: string}|null
     */
    private function buildImportPayload(User $user, string $providerKey, array $config, string $url): array|null
    {
        $remoteId = $this->extractRemoteId($providerKey, $url);
        $embedUrl = $this->buildEmbedUrl($config, $remoteId, $url);

        if (! $embedUrl) {
            return null;
        }

        $payload = [
            'provider' => $providerKey,
            'type' => $config['media_type'] ?? 'embed',
            'original_url' => $url,
            'embed_url' => $embedUrl,
            'thumbnail_url' => $this->buildThumbnailUrl($config, $remoteId, $url),
            'title' => $this->buildTitle($config, $remoteId),
            'remote_id' => $remoteId,
        ];

        $payload['signature'] = $this->sign($payload);

        return $payload;
    }

    private function extractRemoteId(string $provider, string $url): ?string
    {
        return match ($provider) {
            'youtube' => $this->extractYoutubeId($url),
            'instagram' => $this->extractPathSegment($url, ['p', 'reel']),
            'facebook' => null,
            'x' => null,
            'threads' => $this->extractThreadsId($url),
            default => null,
        };
    }

    private function extractYoutubeId(string $url): ?string
    {
        if (preg_match('/youtu\.be\/([A-Za-z0-9_-]{6,})/i', $url, $matches)) {
            return $matches[1];
        }

        $query = parse_url($url, PHP_URL_QUERY);
        parse_str((string) $query, $params);
        if (! empty($params['v'])) {
            return substr($params['v'], 0, 32);
        }

        if (preg_match('/embed\/([A-Za-z0-9_-]{6,})/i', $url, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function extractPathSegment(string $url, array $candidates): ?string
    {
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        $segments = explode('/', $path);

        foreach ($segments as $index => $segment) {
            if (in_array(strtolower($segment), $candidates, true) && isset($segments[$index + 1])) {
                return $segments[$index + 1];
            }
        }

        return null;
    }

    private function extractThreadsId(string $url): ?string
    {
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        if ($path === '') {
            return null;
        }

        return str_replace('/', '-', $path);
    }

    private function buildEmbedUrl(array $config, ?string $remoteId, string $url): string
    {
        $template = $config['embed_template'] ?? null;
        if (! $template) {
            return $url;
        }

        $replacements = [
            '{id}' => $remoteId ?? '',
            '{encoded_url}' => rawurlencode($url),
        ];

        $resolved = strtr($template, $replacements);

        return $resolved !== '' ? $resolved : $url;
    }

    private function buildThumbnailUrl(array $config, ?string $remoteId, string $url): ?string
    {
        $template = $config['thumbnail_template'] ?? null;
        if ($template && $remoteId) {
            return strtr($template, ['{id}' => $remoteId]);
        }

        if (in_array(($config['media_type'] ?? ''), ['embed', 'link'], true)) {
            return null;
        }

        return $remoteId ? $url : null;
    }

    private function buildTitle(array $config, ?string $remoteId): string
    {
        $label = $config['label'] ?? 'Social import';
        if ($remoteId) {
            return sprintf('%s • %s', $label, substr($remoteId, 0, 12));
        }

        return $label;
    }

    private function sign(array $payload): string
    {
        $key = (string) config('social.integrations.import_signing_key', config('app.key'));
        $normalized = $this->normalizeForSigning($payload);

        return hash_hmac('sha256', json_encode($normalized, JSON_UNESCAPED_SLASHES), $key);
    }

    private function validateSignature(array $payload, string $signature): bool
    {
        $expected = $this->sign($payload);

        return hash_equals($expected, $signature);
    }

    private function normalizeForSigning(array $payload): array
    {
        ksort($payload);
        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = $this->normalizeForSigning($value);
            }
        }

        return $payload;
    }
}

