<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CareerIntelligencePulseService
{
    private string $baseUrl;
    private int $timeout;

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $this->baseUrl = $baseUrl ?? config('career_intelligence.base_url', 'http://localhost');
        $this->timeout = $timeout ?? (int) config('career_intelligence.timeout', 5);
    }

    public function getPulse(int $userId): array
    {
        $url = $this->buildEndpoint('/api/v1/career-intelligence/pulse');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['X-User-Id' => $userId])
            ->get($url, ['user_id' => $userId]);

        if ($response->successful()) {
            return $this->normalisePayload($response->json(), $userId);
        }

        Log::warning('Career intelligence pulse unavailable', [
            'user_id' => $userId,
            'status' => $response->status(),
        ]);

        return $this->emptyPayload($userId);

        /*
        $url = $this->buildEndpoint('/api/v1/career-intelligence/pulse');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['X-User-Id' => $userId])
            ->get($url, ['user_id' => $userId]);

        if ($response->successful()) {
            return $this->normalisePayload($response->json(), $userId);
        }

        Log::warning('Career intelligence pulse unavailable', [
            'user_id' => $userId,
            'status' => $response->status(),
        ]);

        return $this->emptyPayload($userId);
        */
    }

    private function buildEndpoint(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }

    /**
     * @return (array|mixed)[]
     *
     * @psalm-return array{user_id: mixed, trajectory_score: mixed, target_role: mixed, summary: mixed, metrics: array{learning_hours: mixed, network_reach: mixed, content_influence: mixed}, forecast_updated_at: mixed}
     */
    private function normalisePayload(array $payload, int $userId): array
    {
        $metrics = Arr::get($payload, 'metrics', []);

        return [
            'user_id' => Arr::get($payload, 'user_id', $userId),
            'trajectory_score' => Arr::get($payload, 'trajectory_score'),
            'target_role' => Arr::get($payload, 'target_role'),
            'summary' => Arr::get($payload, 'summary'),
            'metrics' => [
                'learning_hours' => Arr::get($metrics, 'learning_hours'),
                'network_reach' => Arr::get($metrics, 'network_reach'),
                'content_influence' => Arr::get($metrics, 'content_influence'),
            ],
            'forecast_updated_at' => Arr::get($payload, 'forecast_updated_at'),
        ];
    }

    /**
     * @return (int|null|null[])[]
     *
     * @psalm-return array{user_id: int, trajectory_score: null, target_role: null, summary: null, metrics: array{learning_hours: null, network_reach: null, content_influence: null}, forecast_updated_at: null}
     */
    private function emptyPayload(int $userId): array
    {
        return [
            'user_id' => $userId,
            'trajectory_score' => null,
            'target_role' => null,
            'summary' => null,
            'metrics' => [
                'learning_hours' => null,
                'network_reach' => null,
                'content_influence' => null,
            ],
            'forecast_updated_at' => null,
        ];
    }
}

