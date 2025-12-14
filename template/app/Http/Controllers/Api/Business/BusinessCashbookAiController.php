<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use App\Jobs\CategorizeBusinessEntriesWithAI;
use App\Models\BusinessCashbookEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class BusinessCashbookAiController extends Controller
{
    public function suggest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_ids' => ['required', 'array', 'min:1'],
            'entry_ids.*' => ['integer', 'distinct'],
            'context' => ['nullable', 'array'],
        ]);

        $user = $request->user();
        $entries = BusinessCashbookEntry::query()
            ->with('cashbook:id,user_id')
            ->whereHas('cashbook', fn ($q) => $q->where('user_id', $user->id))
            ->whereIn('id', $data['entry_ids'])
            ->get(['id', 'business_cashbook_id', 'entry_type', 'category', 'amount', 'description']);

        abort_if($entries->count() !== count($data['entry_ids']), 404, 'One or more entries were not found.');

        $entries->pluck('cashbook')
            ->filter()
            ->unique('id')
            ->each(fn ($cashbook) => $this->authorize('ai', $cashbook));

        $jobId = (string) Str::uuid();
        CategorizeBusinessEntriesWithAI::dispatch(
            $user->id,
            $entries->pluck('id')->all(),
            $data['context'] ?? []
        )->onQueue('ai');

        return response()->json([
            'job_id' => $jobId,
            'status' => 'queued',
            'queued_entries' => $entries->count(),
        ], 202);
    }

    public function context(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_ids' => ['nullable', 'array', 'min:0', 'max:50'],
            'entry_ids.*' => ['integer', 'distinct'],
            'filters' => ['nullable', 'array'],
            'filters.entry_type' => ['nullable', Rule::in(['income', 'expense'])],
            'filters.category' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $entriesQuery = BusinessCashbookEntry::query()
            ->with('cashbook:id,user_id')
            ->whereHas('cashbook', fn ($q) => $q->where('user_id', $user->id))
            ->orderByDesc('date');

        if (! empty($data['entry_ids'])) {
            $entriesQuery->whereIn('id', $data['entry_ids']);
        }

        if (! empty($data['filters']['entry_type'])) {
            $entriesQuery->where('entry_type', $data['filters']['entry_type']);
        }

        if (! empty($data['filters']['category'])) {
            $entriesQuery->where('category', $data['filters']['category']);
        }

        $entries = $entriesQuery->limit(25)->get([
            'id',
            'date',
            'entry_type',
            'category',
            'description',
            'amount',
            'is_tax_deductible',
            'business_cashbook_id',
        ]);

        $cashbook = $entries->first()?->cashbook;

        if (! $cashbook) {
            $cashbook = $user->businessCashbooks()->where('is_default', true)->first();
        }

        if ($cashbook) {
            $this->authorize('ai', $cashbook);
        }

        $contextToken = (string) Str::uuid();
        $payload = base64_encode(json_encode([
            'token' => $contextToken,
            'generated_at' => now()->toIso8601String(),
            'selection_total' => $entries->count(),
            'filters' => $data['filters'] ?? [],
            'selection' => $entries->map(fn ($entry) => [
                'id' => $entry->id,
                'date' => optional($entry->date)->toDateString(),
                'entry_type' => $entry->entry_type,
                'category' => $entry->category,
                'description' => $entry->description,
                'amount' => $entry->amount,
                'is_tax_deductible' => $entry->is_tax_deductible,
            ])->all(),
        ], JSON_THROW_ON_ERROR));

        $prompt = sprintf(
            'You are Athena, a respectful business accounting assistant. Provide calm categorisation guidance for %d highlighted entries.',
            $entries->count()
        );

        return response()->json([
            'context_payload' => $payload,
            'prompt' => $prompt,
            'context_token' => $contextToken,
            'selection_preview_count' => $entries->count(),
        ]);
    }
}

