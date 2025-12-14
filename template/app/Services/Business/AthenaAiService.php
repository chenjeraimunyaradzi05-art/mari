<?php

namespace App\Services\Business;

use App\Exceptions\AthenaDocumentRateLimitException;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

final class AthenaAiService
{
    private bool $enabled;
    private string $providerKey;
    private array $providerConfig;
    private array $documentLimit;

    public function __construct(?string $providerKey = null)
    {
        $this->enabled = (bool) config('services.ai.enabled', false) || (bool) config('ai.enabled', false);
        $this->providerKey = $providerKey ?? (string) config('ai.default_provider', 'openai');
        $this->providerConfig = (array) (config('ai.providers', [])[$this->providerKey] ?? []);
        $globalLimit = (array) config('services.ai.document_limit', []);
        $providerLimit = (array) config(sprintf('services.ai.providers.%s.document_limit', $this->providerKey), []);

        $this->documentLimit = array_merge(['attempts' => 5, 'decay' => 60], $globalLimit, $providerLimit);
    }

    public function categorizeBusinessEntries(Collection $entries, array $context = []): array
    {
        if ($entries->isEmpty()) {
            return [];
        }

        if (! $this->canCallProvider()) {
            return $this->fallbackSuggestions($entries);
        }

        try {
            $payload = [
                'model' => $this->providerConfig['chat_model'] ?? config('services.openai.chat_model', 'gpt-4.1-mini'),
                'temperature' => 0.15,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are Athena, a respectful women-first business accounting co-pilot. Respond with JSON: {"suggestions": [{"entry_id": number, "category": string, "confidence": number, "tax_deductible": boolean, "notes": string}]}',
                    ],
                    [
                        'role' => 'user',
                        'content' => $this->buildPrompt($entries, $context),
                    ],
                ],
            ];

            $response = Http::timeout($this->providerConfig['timeout'] ?? config('services.openai.timeout', 15))
                ->withHeaders([
                    'Authorization' => 'Bearer '.$this->providerConfig['api_key'],
                    'Content-Type' => 'application/json',
                ])
                ->post($this->endpoint(), $payload);

            if (! $response->successful()) {
                Log::warning('business.ai.categorise_http_error', [
                    'status' => $response->status(),
                ]);

                return $this->fallbackSuggestions($entries);
            }

            $content = Arr::get($response->json(), 'choices.0.message.content');

            if (! $content) {
                return $this->fallbackSuggestions($entries);
            }

            try {
                $decoded = json_decode((string) $content, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $exception) {
                Log::warning('business.ai.categorise_json_error', [
                    'message' => $exception->getMessage(),
                ]);

                return $this->fallbackSuggestions($entries);
            }

            $suggestions = Arr::get($decoded, 'suggestions', []);

            if (! is_array($suggestions)) {
                return $this->fallbackSuggestions($entries);
            }

            return array_map(/**
             * @return (mixed|null|scalar)[]
             *
             * @psalm-return array{entry_id: int, category: string, confidence: float, tax_deductible: bool, notes: mixed|null}
             */
            static function ($suggestion): array {
                return [
                    'entry_id' => (int) ($suggestion['entry_id'] ?? 0),
                    'category' => (string) ($suggestion['category'] ?? ''),
                    'confidence' => (float) ($suggestion['confidence'] ?? 0.5),
                    'tax_deductible' => (bool) ($suggestion['tax_deductible'] ?? true),
                    'notes' => $suggestion['notes'] ?? null,
                ];
            }, $suggestions);
        } catch (\Throwable $exception) {
            Log::warning('business.ai.categorise_exception', [
                'message' => $exception->getMessage(),
            ]);

            return $this->fallbackSuggestions($entries);
        }
    }

    public function draftBusinessDocument(string $prompt, array $context = []): string
    {
        $this->enforceDocumentRateLimit($context);

        if (! $this->canCallProvider()) {
            return $this->fallbackDraft($prompt, $context);
        }

        $payload = [
            'model' => $this->providerConfig['chat_model'] ?? config('services.openai.chat_model', 'gpt-4.1-mini'),
            'temperature' => 0.3,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are Athena AI, drafting friendly plain-English business documents for founders. Keep it concise, actionable, and note where human advisors must review.',
                ],
                [
                    'role' => 'user',
                    'content' => $this->buildDocumentPrompt($prompt, $context),
                ],
            ],
        ];

        try {
            $response = Http::timeout($this->providerConfig['timeout'] ?? config('services.openai.timeout', 15))
                ->withHeaders([
                    'Authorization' => 'Bearer '.$this->providerConfig['api_key'],
                    'Content-Type' => 'application/json',
                ])
                ->post($this->endpoint(), $payload);

            if (! $response->successful()) {
                Log::warning('business.ai.document_http_error', ['status' => $response->status()]);

                return $this->fallbackDraft($prompt, $context);
            }

            $content = Arr::get($response->json(), 'choices.0.message.content');

            if (! $content) {
                return $this->fallbackDraft($prompt, $context);
            }

            return trim($content);
        } catch (\Throwable $exception) {
            Log::warning('business.ai.document_exception', ['message' => $exception->getMessage()]);

            return $this->fallbackDraft($prompt, $context);
        }
    }

    private function enforceDocumentRateLimit(array $context): void
    {
        $attempts = max(0, (int) ($this->documentLimit['attempts'] ?? 5));
        $decay = max(1, (int) ($this->documentLimit['decay'] ?? 60));

        if ($attempts === 0) {
            return;
        }

        $key = $this->documentLimiterKey($context);

        if (RateLimiter::tooManyAttempts($key, $attempts)) {
            $retryAfter = RateLimiter::availableIn($key);

            throw new AthenaDocumentRateLimitException($retryAfter > 0 ? $retryAfter : $decay);
        }

        RateLimiter::hit($key, $decay);
    }

    private function documentLimiterKey(array $context): string
    {
        $identifier = $context['user_id']
            ?? $context['user_email']
            ?? $context['context_token']
            ?? 'anonymous';

        return 'athena-document:'.sha1((string) $identifier);
    }

    private function buildPrompt(Collection $entries, array $context): string
    {
        $entryLines = $entries
            ->map(function ($entry) {
                $date = optional($entry->date)->toDateString();
                $amount = number_format((float) $entry->amount, 2);

                return sprintf('[%s] %s • %s • %s • %s', $entry->id, $date, strtoupper((string) $entry->entry_type), $entry->description ?? 'No description provided', $amount);
            })
            ->implode("\n");

        $contextLines = collect($context)
            ->map(function ($value, $key) {
                $normalised = is_scalar($value) ? $value : json_encode($value);

                return sprintf('%s: %s', ucfirst(str_replace('_', ' ', (string) $key)), $normalised);
            })
            ->implode("\n");

        return trim(sprintf(
            "Categorise the following business ledger entries for a sole-trader. Suggest gentle, plain categories and flag if tax deductible.\nContext:\n%s\nEntries:\n%s",
            $contextLines ?: 'No additional context provided.',
            $entryLines
        ));
    }

    /**
     * @return (bool|float|mixed|string)[][]
     *
     * @psalm-return array<array{entry_id: mixed, category: string, confidence: float, tax_deductible: bool, notes: 'Local heuristic suggestion while Athena AI is unavailable.'}>
     */
    private function fallbackSuggestions(Collection $entries): array
    {
        return $entries
            ->map(/**
             * @return (bool|float|mixed|string)[]
             *
             * @psalm-return array{entry_id: mixed, category: string, confidence: float, tax_deductible: bool, notes: 'Local heuristic suggestion while Athena AI is unavailable.'}
             */
            function ($entry): array {
                $category = $this->inferCategoryFromDescription((string) $entry->description, (string) $entry->entry_type);

                return [
                    'entry_id' => $entry->id,
                    'category' => $category,
                    'confidence' => 0.42,
                    'tax_deductible' => $entry->entry_type === 'expense',
                    'notes' => 'Local heuristic suggestion while Athena AI is unavailable.',
                ];
            })
            ->all();
    }

    private function fallbackDraft(string $prompt, array $context): string
    {
        $contextLine = empty($context)
            ? 'Context unavailable'
            : collect($context)
                ->map(fn ($value, $key) => sprintf('%s: %s', ucfirst(str_replace('_', ' ', (string) $key)), is_scalar($value) ? $value : json_encode($value)))
                ->implode("\n");

        return <<<TEXT
Athena AI is offline right now, but here is a starter outline:

Context snapshot:
{$contextLine}

Prompt summary:
{$prompt}

Add founder signatures, review with a lawyer/accountant, and rerun once the AI lane is back online.
TEXT;
    }

    private function buildDocumentPrompt(string $prompt, array $context): string
    {
        $contextLines = collect($context)
            ->map(fn ($value, $key) => sprintf('%s: %s', ucfirst(str_replace('_', ' ', (string) $key)), is_scalar($value) ? $value : json_encode($value)))
            ->implode("\n");

        return trim(sprintf(
            "Context for drafting:\n%s\n\nDrafting brief:\n%s",
            $contextLines ?: 'Founder provided no extra context.',
            $prompt
        ));
    }

    private function inferCategoryFromDescription(string $description, string $entryType): string
    {
        $description = strtolower($description);

        $map = [
            'stripe' => 'payments',
            'paypal' => 'payments',
            'square' => 'payments',
            'uber' => 'travel',
            'lyft' => 'travel',
            'qantas' => 'travel',
            'airbnb' => 'travel',
            'mailchimp' => 'marketing',
            'meta' => 'marketing',
            'google' => 'marketing',
            'ads' => 'marketing',
            'aws' => 'infrastructure',
            'digitalocean' => 'infrastructure',
            'azure' => 'infrastructure',
            'xero' => 'software',
            'notion' => 'software',
            'figma' => 'software',
            'canva' => 'software',
            'rent' => 'rent',
            'lease' => 'rent',
            'salary' => 'payroll',
            'wage' => 'payroll',
            'consult' => 'consulting income',
            'invoice' => 'client income',
            'grant' => 'grant income',
        ];

        foreach ($map as $needle => $category) {
            if (str_contains($description, $needle)) {
                return $category;
            }
        }

        return $entryType === 'income' ? 'income' : 'general expense';
    }

    private function canCallProvider(): bool
    {
        return $this->enabled && filled($this->providerConfig['api_key'] ?? null);
    }

    private function endpoint(): string
    {
        $base = rtrim($this->providerConfig['base_url'] ?? config('services.openai.base_url', 'https://api.openai.com/v1'), '/');

        return $base.'/chat/completions';
    }
}

