<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PersonaNudgeService
{
    private string $baseUrl;
    private int $timeout;

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $this->baseUrl = $baseUrl ?? (string) config('services.onboarding_personas.base_url', '');
        $this->timeout = $timeout ?? (int) config('services.onboarding_personas.timeout', 5);
    }

    public function fetchNudges(int $userId): array
    {
        // If there's no valid base URL configured, avoid making an outbound call
        // (tests and local dev may not have a reachable service) and return a
        // sensible fallback.
        if (! $this->baseUrl || ! filter_var($this->baseUrl, FILTER_VALIDATE_URL)) {
            return ['personas' => []];
        }

        $url = $this->buildEndpoint('/api/v1/onboarding/persona-nudges');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['X-User-Id' => $userId])
            ->get($url);

        if ($response->successful()) {
            return $this->normalise($response->json());
        }

        Log::info('Persona nudges unavailable, returning fallback', [
            'user_id' => $userId,
            'status' => $response->status(),
        ]);

        return ['personas' => []];

        /*
        $url = $this->buildEndpoint('/api/v1/onboarding/persona-nudges');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['X-User-Id' => $userId])
            ->get($url);

        if ($response->successful()) {
            return $this->normalise($response->json());
        }

        Log::info('Persona nudges unavailable, returning fallback', [
            'user_id' => $userId,
            'status' => $response->status(),
        ]);

        return ['personas' => []];
        */
    }

    public function dismiss(string $personaId): bool
    {
        if (! $this->baseUrl || ! filter_var($this->baseUrl, FILTER_VALIDATE_URL)) {
            return false;
        }

        $url = $this->buildEndpoint('/api/v1/onboarding/persona-nudges/'.ltrim($personaId, '/').'/dismiss');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->post($url);

        return $response->successful();
    }

    private function buildEndpoint(string $path): string
    {
        return $this->baseUrl . '/' . ltrim($path, '/');
    }

    /**
     * @return (array|mixed)[][][]
     *
     * @psalm-return array{personas: array<int, array{id: mixed, label: mixed, icon: mixed, nudges: array, cta: array{label: mixed, url: mixed}}>}
     */
    private function normalise(array $payload): array
    {
        $personas = collect(Arr::get($payload, 'personas', []))
            ->map(function ($persona) {
                return [
                    'id' => Arr::get($persona, 'id'),
                    'label' => Arr::get($persona, 'label'),
                    'icon' => Arr::get($persona, 'icon'),
                    'nudges' => array_filter((array) Arr::get($persona, 'nudges', [])),
                    'cta' => [
                        'label' => Arr::get($persona, 'cta.label'),
                        'url' => Arr::get($persona, 'cta.url'),
                    ],
                ];
            })
            ->filter(fn ($persona) => ! empty($persona['id']))
            ->values()
            ->all();

        return ['personas' => $personas];
    }
}

