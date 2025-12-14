<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpportunityStreamService
{
    private string $baseUrl;
    private int $timeout;

    /**
     * @var array<string, string>
     */
    private array $endpoints = [
        'jobs' => '/api/v1/jobs/recommended',
        'apprenticeships' => '/api/v1/apprenticeships/recommended',
        'courses' => '/api/v1/courses/recommended',
        'mentorship' => '/api/v1/mentorship/opportunities',
        'creator_earnings' => '/api/v1/creator/earnings/summary',
    ];

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $this->baseUrl = $baseUrl ?? config('opportunity_stream.base_url', 'http://localhost');
        $this->timeout = $timeout ?? (int) config('opportunity_stream.timeout', 5);
    }

    /**
     * @return array[]
     *
     * @psalm-return array<string, array>
     */
    public function fetchStreams(int $userId): array
    {
        $streams = [];

        foreach ($this->endpoints as $key => $path) {
            $streams[$key] = $this->fetchStream($path, $userId);
        }

        return $streams;
    }

    private function fetchStream(string $path, int $userId): array
    {
        $url = $this->buildEndpoint($path);

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['X-User-Id' => $userId])
            ->get($url, ['persona' => true]);

        if ($response->successful()) {
            return $this->normaliseCollection($response->json());
        }

        Log::warning('Opportunity stream fallback triggered', [
            'user_id' => $userId,
            'endpoint' => $path,
            'status' => $response->status(),
        ]);

        return [];
    }

    private function buildEndpoint(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }

    private function normaliseCollection(array $payload): array
    {
        $data = Arr::get($payload, 'data');

        if (is_array($data)) {
            return $data;
        }

        return $payload;
    }
}

