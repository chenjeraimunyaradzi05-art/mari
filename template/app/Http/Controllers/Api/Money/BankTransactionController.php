<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Http\Resources\Money\BankTransactionResource;
use App\Models\BankTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use App\Models\BankAccount;
use App\Services\AiContextHistoryService;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class BankTransactionController extends Controller
{
    public function __construct(private readonly AiContextHistoryService $aiContextHistory)
    {
    }

    private const DIRECTIONS = ['credit', 'debit'];
    private const BULK_ACTIONS = [
        'mark_matched',
        'mark_excluded',
        'apply_ai_suggestion',
        'set_category',
        'flag',
        'unflag',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'status' => ['nullable', Rule::in([
                BankTransaction::STATUS_PENDING,
                BankTransaction::STATUS_MATCHED,
                BankTransaction::STATUS_EXCLUDED,
            ])],
            'direction' => ['nullable', Rule::in(self::DIRECTIONS)],
            'flagged' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string', 'max:255'],
            'posted_after' => ['nullable', 'date'],
            'posted_before' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $user = $request->user();

        $query = BankTransaction::query()
            ->with(['account'])
            ->where('user_id', $user->id);

        if (!empty($data['account_id'])) {
            $ownsAccount = $user->bankAccounts()->whereKey($data['account_id'])->exists();
            abort_unless($ownsAccount, 404);

            $query->where('bank_account_id', $data['account_id']);
        }

        if (!empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (!empty($data['direction'])) {
            $query->where('direction', $data['direction']);
        }

        if (array_key_exists('flagged', $data)) {
            $query->where('is_flagged', (bool) $data['flagged']);
        }

        if (!empty($data['search'])) {
            $likeTerm = sprintf('%%%s%%', $data['search']);
            $query->where(function ($builder) use ($likeTerm): void {
                $builder
                    ->where('description', 'like', $likeTerm)
                    ->orWhere('reference', 'like', $likeTerm);
            });
        }

        if (!empty($data['posted_after'])) {
            $query->whereDate('posted_at', '>=', $data['posted_after']);
        }

        if (!empty($data['posted_before'])) {
            $query->whereDate('posted_at', '<=', $data['posted_before']);
        }

        $perPage = $data['per_page'] ?? 25;

        $transactions = $query
            ->orderByDesc('posted_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->appends($request->query());

        return BankTransactionResource::collection($transactions);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_ids' => ['required', 'array', 'min:1'],
            'transaction_ids.*' => ['integer', 'distinct'],
            'action' => ['required', Rule::in(self::BULK_ACTIONS)],
            'category_key' => ['nullable', 'string', 'max:120'],
        ]);

        if ($data['action'] === 'set_category' && blank($data['category_key'])) {
            return response()->json([
                'message' => 'A category key is required for this action.',
            ], 422);
        }

        $user = $request->user();
        $transactionIds = collect($data['transaction_ids'])
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $transactions = BankTransaction::query()
            ->where('user_id', $user->id)
            ->whereIn('id', $transactionIds)
            ->get();

        abort_if($transactions->count() !== count($transactionIds), 404, 'One or more transactions were not found.');

        $updated = 0;
        $skipped = 0;

        foreach ($transactions as $transaction) {
            $changed = match ($data['action']) {
                'mark_matched' => $this->applyTransactionChanges($transaction, [
                    'status' => BankTransaction::STATUS_MATCHED,
                    'is_flagged' => false,
                    'reviewed_at' => now(),
                ]),
                'mark_excluded' => $this->applyTransactionChanges($transaction, [
                    'status' => BankTransaction::STATUS_EXCLUDED,
                    'reviewed_at' => now(),
                ]),
                'apply_ai_suggestion' => $this->applyAiSuggestion($transaction),
                'set_category' => $this->applyTransactionChanges($transaction, [
                    'category_key' => $data['category_key'],
                    'status' => BankTransaction::STATUS_MATCHED,
                    'is_flagged' => false,
                    'reviewed_at' => now(),
                ]),
                'flag' => $this->applyTransactionChanges($transaction, [
                    'is_flagged' => true,
                ]),
                'unflag' => $this->applyTransactionChanges($transaction, [
                    'is_flagged' => false,
                ]),
                default => false,
            };

            if ($changed) {
                $updated++;
            } else {
                $skipped++;
            }
        }

        $messages = [
            'mark_matched' => 'Transactions marked as matched.',
            'mark_excluded' => 'Transactions marked as excluded.',
            'apply_ai_suggestion' => 'AI suggestions applied where available.',
            'set_category' => 'Category applied to selected transactions.',
            'flag' => 'Transactions flagged for follow-up.',
            'unflag' => 'Flags cleared for selected transactions.',
        ];

        return response()->json([
            'updated' => $updated,
            'skipped' => $skipped,
            'message' => $messages[$data['action']] ?? 'Bulk action processed.',
        ]);
    }

    public function createAiContext(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_ids' => ['nullable', 'array', 'min:0', 'max:50'],
            'transaction_ids.*' => ['integer', 'distinct'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', Rule::in([
                BankTransaction::STATUS_PENDING,
                BankTransaction::STATUS_MATCHED,
                BankTransaction::STATUS_EXCLUDED,
                'all',
            ])],
            'filters.flagged' => ['nullable', 'boolean'],
            'filters.search' => ['nullable', 'string', 'max:255'],
            'filters.account_id' => ['nullable', 'integer'],
            'surface' => ['nullable', 'string', 'max:64'],
        ]);

        $user = $request->user();

        $transactionIds = collect($data['transaction_ids'])
            ->filter(fn ($id) => $id !== null)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $filters = $data['filters'] ?? [];
        $account = null;

        if (!empty($filters['account_id'])) {
            $account = $user->bankAccounts()->whereKey($filters['account_id'])->first();
            abort_unless($account, 404, 'Account not found.');
        }

        $previewLimit = 20;
        collect();
        collect();

        if (count($transactionIds) > 0) {
            $transactions = BankTransaction::query()
                ->where('user_id', $user->id)
                ->whereIn('id', $transactionIds)
                ->with(['account:id,account_name,institution'])
                ->orderByDesc('posted_at')
                ->orderByDesc('id')
                ->get([
                    'id',
                    'bank_account_id',
                    'description',
                    'posted_at',
                    'amount_cents',
                    'direction',
                    'status',
                    'category_key',
                    'is_flagged',
                    'ai_suggestions',
                ]);

            abort_if($transactions->count() !== count($transactionIds), 404, 'One or more transactions were not found.');

            $selectionTotal = $transactions->count();
            $preview = $transactions->take($previewLimit);
            $selectionCollection = $transactions;
        } else {
            $query = BankTransaction::query()->where('user_id', $user->id);

            if ($account) {
                $query->where('bank_account_id', $account->id);
            }

            $this->applyContextFilters($query, $filters);

            $preview = $query
                ->with(['account:id,account_name,institution'])
                ->orderByDesc('posted_at')
                ->orderByDesc('id')
                ->limit($previewLimit)
                ->get([
                    'id',
                    'bank_account_id',
                    'description',
                    'posted_at',
                    'amount_cents',
                    'direction',
                    'status',
                    'category_key',
                    'is_flagged',
                    'ai_suggestions',
                ]);

            $selectionTotal = $preview->count();
            $selectionCollection = $preview;
        }

        $filterSummary = $this->summariseFilterContext($filters, $account);
        $surface = $this->normaliseSurface($data['surface'] ?? null);
        $contextToken = (string) Str::uuid();
        $issuedAt = now()->toIso8601String();
        $this->recordAiUsage($selectionCollection, $contextToken, $issuedAt);

        $selectionPreview = $this->formatTransactionsForAi($preview);

        $contextPayload = base64_encode(json_encode([
            'token' => $contextToken,
            'generated_at' => $issuedAt,
            'selection_total' => $selectionTotal,
            'filters' => $filterSummary,
            'selection' => $selectionPreview,
        ], JSON_THROW_ON_ERROR));

        $prompt = $this->buildAiPrompt($selectionTotal, $filterSummary);

        $this->persistContextSnapshot(
            $user->id,
            $contextToken,
            $filters,
            $selectionPreview,
            $selectionTotal,
            $prompt,
            $contextPayload,
            $surface,
            'bank-feed-triage',
        );

        return response()->json([
            'context_payload' => $contextPayload,
            'prompt' => $prompt,
            'selection_preview_count' => $preview->count(),
            'selection_total' => $selectionTotal,
            'context_token' => $contextToken,
            'surface' => $surface,
        ]);
    }

    private function applyTransactionChanges(BankTransaction $transaction, array $attributes): bool
    {
        $transaction->fill($attributes);

        if (!$transaction->isDirty()) {
            return false;
        }

        $transaction->save();

        return true;
    }

    private function applyAiSuggestion(BankTransaction $transaction): bool
    {
        $suggestion = $this->resolveSuggestionLabel($transaction->ai_suggestions ?? []);

        if (!$suggestion) {
            return false;
        }

        return $this->applyTransactionChanges($transaction, [
            'category_key' => $suggestion,
            'status' => BankTransaction::STATUS_MATCHED,
            'is_flagged' => false,
            'reviewed_at' => now(),
        ]);
    }

    private function resolveSuggestionLabel(array $suggestions): ?string
    {
        if (empty($suggestions)) {
            return null;
        }

        foreach ((array) $suggestions as $suggestion) {
            if (is_string($suggestion) && trim($suggestion) !== '') {
                return trim($suggestion);
            }

            if (is_array($suggestion)) {
                $label = $suggestion['label']
                    ?? $suggestion['category']
                    ?? $suggestion['tag']
                    ?? null;

                if (is_string($label) && trim($label) !== '') {
                    return trim($label);
                }
            }
        }

        return null;
    }

    /**
     * @psalm-param \Illuminate\Database\Eloquent\Builder<BankTransaction> $query
     */
    private function applyContextFilters(\Illuminate\Database\Eloquent\Builder $query, array $filters): void
    {
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        if (array_key_exists('flagged', $filters)) {
            $query->where('is_flagged', (bool) $filters['flagged']);
        }

        if (!empty($filters['search'])) {
            $like = sprintf('%%%s%%', $filters['search']);
            $query->where(function ($builder) use ($like): void {
                $builder
                    ->where('description', 'like', $like)
                    ->orWhere('reference', 'like', $like);
            });
        }
    }

    /**
     * @return (bool|mixed|null|string)[]
     *
     * @psalm-return array{account: string, status: 'all'|mixed, flagged_only: bool, search: mixed|null}
     */
    private function summariseFilterContext(array $filters, ?BankAccount $account): array
    {
        $status = $filters['status'] ?? 'all';

        return [
            'account' => $account ? sprintf('%s (%s)', $account->account_name, $account->institution ?? 'Linked account') : 'All linked accounts',
            'status' => $status,
            'flagged_only' => (bool) ($filters['flagged'] ?? false),
            'search' => $filters['search'] ?? null,
        ];
    }

    private function buildAiPrompt(int $selectionTotal, array $filterSummary): string
    {
        $statusLabel = match ($filterSummary['status']) {
            BankTransaction::STATUS_PENDING => 'pending',
            BankTransaction::STATUS_MATCHED => 'matched',
            BankTransaction::STATUS_EXCLUDED => 'excluded',
            default => 'mixed',
        };

        $segments = [];
        $segments[] = sprintf('Help me review %d %s transactions', max($selectionTotal, 1), $statusLabel);

        if (!empty($filterSummary['flagged_only'])) {
            $segments[] = 'that are flagged';
        }

        if (!empty($filterSummary['search'])) {
            $segments[] = sprintf('matching "%s"', $filterSummary['search']);
        }

        $body = implode(' ', $segments);

        return trim(sprintf('%s from %s.', $body, $filterSummary['account']));
    }

    /**
     * @return (array|null|scalar)[][]
     *
     * @psalm-return array<array{id: int, description: string, posted_at: string, posted_at_display: string, amount: float, direction: string, status: string, category: null|string, flagged: bool, ai_suggestions: array, account: null|string}>
     */
    private function formatTransactionsForAi(Collection $transactions): array
    {
        return $transactions->map(function (BankTransaction $transaction) {
            return [
                'id' => $transaction->id,
                'description' => Str::limit($transaction->description, 80),
                'posted_at' => optional($transaction->posted_at)->toDateString(),
                'posted_at_display' => optional($transaction->posted_at)->format('d M Y'),
                'amount' => round($transaction->amount, 2),
                'direction' => $transaction->direction,
                'status' => $transaction->status,
                'category' => $transaction->category_key,
                'flagged' => (bool) $transaction->is_flagged,
                'ai_suggestions' => $transaction->ai_suggestions ?? [],
                'account' => $transaction->account
                    ? sprintf('%s (%s)', $transaction->account->account_name, $transaction->account->institution ?? 'Linked account')
                    : null,
            ];
        })->all();
    }

    private function recordAiUsage(Collection $transactions, string $contextToken, string $timestamp): void
    {
        if ($transactions->isEmpty()) {
            return;
        }

        $transactions->each(function (BankTransaction $transaction) use ($contextToken, $timestamp): void {
            $metadata = $transaction->metadata ?? [];
            $metadata['ai_last_context_token'] = $contextToken;
            $metadata['ai_last_context_at'] = $timestamp;

            $transaction->forceFill([
                'metadata' => $metadata,
            ])->save();
        });
    }

    private function persistContextSnapshot(
        int $userId,
        string $contextToken,
        array $filters,
        array $selectionPreview,
        int $selectionTotal,
        string $prompt,
        string $contextPayload,
        ?string $surface = null,
        string $contextKey = 'bank-feed-triage',
    ): void {
        $this->aiContextHistory->store($userId, $contextKey, [
            'token' => $contextToken,
            'filters' => $filters,
            'selection_preview' => $selectionPreview,
            'selection_total' => $selectionTotal,
            'prompt' => $prompt,
            'context_payload' => $contextPayload,
            'surface' => $surface ?? 'money_budget',
        ]);
    }

    private function normaliseSurface(?string $value, bool $fallback = true): ?string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return $fallback ? 'money_budget' : null;
        }

        return Str::of($text)->lower()->limit(64)->value();
    }

}

