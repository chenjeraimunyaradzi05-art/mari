<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class VerticalAggregatorService
{
    private string $baseUrl;
    private int $timeout;

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $configuredBase = $baseUrl ?? config('services.vertical_gateway.base_url');
        $this->baseUrl = $configuredBase ? rtrim($configuredBase, '/') : rtrim((string) url('/'), '/');
        $this->timeout = $timeout ?? (int) config('services.vertical_gateway.timeout', 5);
    }

    public function listVerticals(): array
    {
        $url = $this->buildEndpoint('/api/v1/verticals');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->get($url, ['include' => 'stats,badges']);

        if ($response->successful()) {
            return $this->normaliseCollection($response->json());
        }

        Log::notice('Vertical aggregator fallback triggered', [
            'status' => $response->status(),
        ]);

        return ['data' => []];
    }

    public function fetchSpotlight(string $slug): array
    {
        $url = $this->buildEndpoint("/api/v1/verticals/{$slug}/spotlight");

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->get($url);

        if ($response->successful()) {
            return $this->normaliseSpotlight($response->json());
        }

        Log::info('Vertical spotlight unavailable', [
            'slug' => $slug,
            'status' => $response->status(),
        ]);

        return [
            'slug' => $slug,
            'title' => null,
            'tagline' => null,
            'media' => [],
            'stats' => [],
        ];
    }

    private function buildEndpoint(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }

    /**
     * @return (array|mixed)[][][]
     *
     * @psalm-return array{data: array<int, array{slug: mixed, name: mixed, tagline: mixed, stats: array{open_roles: mixed, courses: mixed, mentors: mixed}, media: mixed}>}
     */
    private function normaliseCollection(array $payload): array
    {
        $data = collect(Arr::get($payload, 'data', []))
            ->map(function ($vertical) {
                return [
                    'slug' => Arr::get($vertical, 'slug'),
                    'name' => Arr::get($vertical, 'name'),
                    'tagline' => Arr::get($vertical, 'tagline'),
                    'stats' => [
                        'open_roles' => Arr::get($vertical, 'stats.open_roles'),
                        'courses' => Arr::get($vertical, 'stats.courses'),
                        'mentors' => Arr::get($vertical, 'stats.mentors'),
                    ],
                    'media' => Arr::get($vertical, 'media', []),
                ];
            })
            ->filter(fn ($vertical) => ! empty($vertical['slug']))
            ->values()
            ->all();

        return ['data' => $data];
    }

    /**
     * @psalm-return array{slug: mixed, title: mixed, tagline: mixed, media: mixed, stats: mixed}
     */
    private function normaliseSpotlight(array $payload): array
    {
        return [
            'slug' => Arr::get($payload, 'slug'),
            'title' => Arr::get($payload, 'title'),
            'tagline' => Arr::get($payload, 'tagline'),
            'media' => Arr::get($payload, 'media', []),
            'stats' => Arr::get($payload, 'stats', []),
        ];
    }
}

