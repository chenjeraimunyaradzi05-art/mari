<?php

namespace App\Services;

use App\Models\BankTransactionContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use App\Services\RealTimeAnalyticsEngine;

class AiContextHistoryService
{
    public function __construct(
        private RealTimeAnalyticsEngine $analytics
    ) {}


    public function store(int $userId, string $contextKey, array $payload): BankTransactionContext
    {
        $selectionPreview = $payload['selection_preview'] ?? [];
        if (is_array($selectionPreview)) {
            $selectionPreview = array_slice($selectionPreview, 0, 8);
        } else {
            $selectionPreview = [];
        }

        $context = BankTransactionContext::query()->create([
            'user_id' => $userId,
            'token' => $payload['token'] ?? (string) Str::uuid(),
            'filters' => $payload['filters'] ?? [],
            'selection_preview' => $selectionPreview,
            'selection_total' => (int) ($payload['selection_total'] ?? 0),
            'prompt' => $payload['prompt'] ?? null,
            'context_payload' => $payload['context_payload'] ?? '',
            'surface' => $payload['surface'] ?? 'ai_workspace',
            'context_key' => $contextKey,
        ]);

        $this->prune($userId);

        return $context;
    }

    public function recent(
        int $userId,
        ?string $surface = null,
        ?string $contextKey = null,
        int $perPage = 10,
        int $page = 1
    ): LengthAwarePaginator {
        return BankTransactionContext::query()
            ->where('user_id', $userId)
            ->when($surface, fn (Builder $query, string $value) => $query->where('surface', $value))
            ->when($contextKey, fn (Builder $query, string $value) => $query->where('context_key', $value))
            ->orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function latest(
        int $userId,
        int $limit = 5,
        ?string $surface = null,
        ?string $contextKey = null
    ): Collection {
        return BankTransactionContext::query()
            ->where('user_id', $userId)
            ->when($surface, fn (Builder $query, string $value) => $query->where('surface', $value))
            ->when($contextKey, fn (Builder $query, string $value) => $query->where('context_key', $value))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    public function recordDrawerOpen(int $userId, int $totalContexts, ?string $surface = null): void
    {
        $surfaceKey = $surface ?: 'ai_workspace';
        $event = $surfaceKey === 'transactions_inbox'
            ? 'money.bank_inbox.context_drawer.opened'
            : 'ai.concierge.history.opened';

        $this->analytics->record($event, [
            'properties' => [
                'user_id' => $userId,
                'total_contexts_available' => $totalContexts,
            ],
            'metadata' => [
                'surface' => $surfaceKey,
            ],
        ]);
    }

    private function prune(int $userId, int $retain = 5): void
    {
        $ids = BankTransactionContext::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->pluck('id')
            ->slice($retain)
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        BankTransactionContext::query()->whereIn('id', $ids)->delete();
    }
}

