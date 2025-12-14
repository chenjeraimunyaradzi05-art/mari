<?php

namespace App\Services;

final class AiConciergeTelemetryService
{


    public function questionSent(
        int $userId,
        string $contextKey,
        string $surface,
        string $question,
        bool $usedHistoryPayload = false,
        array $meta = []
    ): void {
        $length = $this->promptLength($question);
        $properties = array_filter(
            [
                'user_id' => $userId,
                'context_key' => $contextKey,
                'surface' => $surface,
                'prompt_length' => $length,
                'prompt_length_bucket' => $this->bucketPromptLength($length),
                'used_history_payload' => $usedHistoryPayload,
                'history_token' => $meta['history_token'] ?? null,
                'snapshot_token' => $meta['snapshot_token'] ?? null,
                'selection_total' => $meta['selection_total'] ?? null,
                'filters' => $this->normaliseFilters($meta['filters'] ?? []),
            ],
            fn ($value) => $value !== null && $value !== []
        );

        $this->analytics->record('ai.concierge.question_sent', [
            'properties' => $properties,
            'metadata' => [
                'surface' => $surface,
                'context_key' => $contextKey,
            ],
            'source' => 'app',
        ]);
    }

    /**
     * @psalm-return int<0, max>
     */
    private function promptLength(string $question): int
    {
        return mb_strlen($question);
    }

    private function bucketPromptLength(int $length): string
    {
        return match (true) {
            $length < 120 => 'under_120',
            $length < 260 => '120_259',
            $length < 520 => '260_519',
            default => '520_plus',
        };
    }

    /**
     * @return (array|string)[]
     *
     * @psalm-return array<list<mixed>|string>
     */
    private function normaliseFilters(mixed $filters): array
    {
        if (!is_array($filters)) {
            return [];
        }

        $sanitised = [];

        foreach (array_slice($filters, 0, 8) as $key => $value) {
            if (is_array($value)) {
                $sanitised[$key] = array_slice(array_values($value), 0, 6);
                continue;
            }

            if (is_scalar($value)) {
                $sanitised[$key] = (string) $value;
            }
        }

        return $sanitised;
    }
}

