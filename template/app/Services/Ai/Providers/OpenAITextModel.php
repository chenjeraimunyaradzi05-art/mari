<?php

namespace App\Services\Ai\Providers;

use App\Contracts\AI\TextModel;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class OpenAITextModel implements TextModel
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly ?string $organization,
        private readonly ?string $chatModel,
        private readonly ?string $embedModel
    ) {
    }

    #[\Override]
    public function generate(string $prompt, array $options = []): string
    {
        $this->ensureConfigured();

        $payload = [
            'model' => $options['model'] ?? $this->chatModel,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => $options['temperature'] ?? 0.7,
            'max_tokens' => $options['max_tokens'] ?? 480,
        ];

        $response = $this->http()->post('/chat/completions', $payload);
        $response->throw();

        return trim(Arr::get($response->json(), 'choices.0.message.content', ''));
    }

    #[\Override]
    public function embed(string $text, array $options = []): array
    {
        $this->ensureConfigured();

        $payload = [
            'model' => $options['model'] ?? $this->embedModel,
            'input' => $text,
        ];

        $response = $this->http()->post('/embeddings', $payload);
        $response->throw();

        return Arr::get($response->json(), 'data.0.embedding', []);
    }

    #[\Override]
    public function stream(string $prompt, callable $onChunk, array $options = []): void
    {
        $chunk = $this->generate($prompt, $options);
        if ($chunk !== '') {
            $onChunk($chunk);
        }
    }

    private function http(): PendingRequest
    {
        $request = Http::baseUrl('https://api.openai.com/v1')
            ->withToken($this->apiKey ?? '')
            ->acceptJson();

        if ($this->organization) {
            $request = $request->withHeaders([
                'OpenAI-Organization' => $this->organization,
            ]);
        }

        return $request;
    }

    private function ensureConfigured(): void
    {
        if (blank($this->apiKey) || blank($this->chatModel)) {
            throw new RuntimeException('OpenAI provider is not configured.');
        }
    }
}

