<?php

namespace App\Services\Ai\Providers;

use App\Contracts\AI\TextModel;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class AnthropicTextModel implements TextModel
{
    public function __construct(
        private readonly ?string $apiKey,
        private readonly ?string $chatModel
    ) {
    }

    #[\Override]
    public function generate(string $prompt, array $options = []): string
    {
        $this->ensureConfigured();

        $payload = [
            'model' => $options['model'] ?? $this->chatModel,
            'max_tokens' => $options['max_tokens'] ?? 480,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ];

        $response = $this->http()->post('/messages', $payload);
        $response->throw();

        $content = Arr::get($response->json(), 'content', []);
        if (! is_array($content)) {
            return '';
        }

        $textBlocks = collect($content)
            ->where('type', 'text')
            ->pluck('text')
            ->implode("\n");

        return trim($textBlocks);
    }

    /**
     * @return never
     */
    #[\Override]
    public function embed(string $text, array $options = []): array
    {
        throw new RuntimeException('Anthropic embeddings are not supported via this adapter.');
    }

    #[\Override]
    public function stream(string $prompt, callable $onChunk, array $options = []): void
    {
        $onChunk($this->generate($prompt, $options));
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl('https://api.anthropic.com/v1')
            ->withHeaders([
                'x-api-key' => $this->apiKey ?? '',
                'anthropic-version' => '2023-06-01',
            ])
            ->acceptJson();
    }

    private function ensureConfigured(): void
    {
        if (blank($this->apiKey) || blank($this->chatModel)) {
            throw new RuntimeException('Anthropic provider is not configured.');
        }
    }
}

