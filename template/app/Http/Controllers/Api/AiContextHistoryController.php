<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankTransactionContext;
use App\Services\AiContextHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class AiContextHistoryController extends Controller
{
    public function __construct(private readonly AiContextHistoryService $history)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'surface' => ['nullable', 'string', 'max:64'],
            'context' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:25'],
            'track_open' => ['nullable', 'boolean'],
        ]);

        $page = isset($data['page']) ? (int) $data['page'] : 1;
        $perPage = isset($data['per_page']) ? (int) $data['per_page'] : 10;
        $surface = $this->normaliseSurface($data['surface'] ?? null);
        $contextKey = $this->normaliseContext($data['context'] ?? null);

        $contexts = $this->history->recent($user->id, $surface, $contextKey, $perPage, $page);

        if (!empty($data['track_open']) && $page === 1) {
            $this->history->recordDrawerOpen($user->id, (int) $contexts->total(), $surface);
        }

        return response()->json([
            'data' => collect($contexts->items())->map(fn (BankTransactionContext $context) => [
                'token' => $context->token,
                'filters' => $context->filters ?? [],
                'selection_preview' => $context->selection_preview ?? [],
                'selection_total' => $context->selection_total,
                'prompt' => $context->prompt,
                'context_payload' => $context->context_payload,
                'surface' => $context->surface,
                'context' => $context->context_key,
                'created_at' => optional($context->created_at)->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $contexts->currentPage(),
                'last_page' => $contexts->lastPage(),
                'per_page' => $contexts->perPage(),
                'total' => $contexts->total(),
                'from' => $contexts->firstItem(),
                'to' => $contexts->lastItem(),
            ],
        ]);
    }

    private function normaliseSurface(?string $value): ?string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        return Str::of($text)->lower()->limit(64)->value();
    }

    private function normaliseContext(?string $value): ?string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        return Str::of($text)->limit(80)->value();
    }
}

