<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use App\Http\Resources\Business\BusinessCashbookEntryResource;
use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use App\Services\Business\BusinessCashbookSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class BusinessCashbookEntryController extends Controller
{
    public function __construct(private readonly BusinessCashbookSummaryService $summaryService)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
            'entry_type' => ['nullable', Rule::in(['income', 'expense'])],
            'category' => ['nullable', 'string', 'max:120'],
            'search' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $cashbook = $this->resolveCashbook($request, $data['cashbook_id'] ?? null);
        $this->authorize('view', $cashbook);

        $query = $cashbook->entries()->orderByDesc('date')->orderByDesc('id');

        if (! empty($data['entry_type'])) {
            $query->where('entry_type', $data['entry_type']);
        }

        if (! empty($data['category'])) {
            $query->where('category', $data['category']);
        }

        if (! empty($data['search'])) {
            $like = sprintf('%%%s%%', $data['search']);
            $query->where(function ($builder) use ($like) {
                $builder->where('description', 'like', $like)
                    ->orWhere('category', 'like', $like);
            });
        }

        if (! empty($data['from'])) {
            $query->whereDate('date', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('date', '<=', $data['to']);
        }

        $entries = $query->paginate($data['per_page'] ?? 25)->appends($request->query());

        return BusinessCashbookEntryResource::collection($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
            'date' => ['required', 'date'],
            'entry_type' => ['required', Rule::in(['income', 'expense'])],
            'category' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'is_tax_deductible' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);

        $cashbook = $this->resolveCashbook($request, $data['cashbook_id'] ?? null);
        $this->authorize('manageEntries', $cashbook);

        $entry = $cashbook->entries()->create([
            'date' => $data['date'],
            'entry_type' => $data['entry_type'],
            'category' => $data['category'] ?? null,
            'description' => $data['description'] ?? null,
            'amount' => $data['amount'],
            'is_tax_deductible' => $data['is_tax_deductible'] ?? true,
            'metadata' => $data['metadata'] ?? null,
        ]);

        return (new BusinessCashbookEntryResource($entry))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, BusinessCashbookEntry $entry): BusinessCashbookEntryResource
    {
        $this->authorize('update', $entry);

        $data = $request->validate([
            'date' => ['sometimes', 'date'],
            'entry_type' => ['sometimes', Rule::in(['income', 'expense'])],
            'category' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['sometimes', 'numeric', 'min:0'],
            'is_tax_deductible' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);

        $entry->fill(array_filter($data, static fn ($value) => ! is_null($value)))->save();

        return new BusinessCashbookEntryResource($entry->fresh());
    }

    public function destroy(Request $request, BusinessCashbookEntry $entry): JsonResponse
    {
        $this->authorize('delete', $entry);

        $entry->delete();

        return response()->json(['message' => 'Entry deleted.']);
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_ids' => ['required', 'array', 'min:1'],
            'entry_ids.*' => ['integer', 'distinct'],
            'action' => ['required', Rule::in(['delete', 'toggle_tax', 'reclassify'])],
            'entry_type' => ['nullable', Rule::in(['income', 'expense'])],
            'is_tax_deductible' => ['nullable', 'boolean'],
            'category' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $entries = BusinessCashbookEntry::query()
            ->whereHas('cashbook', fn ($q) => $q->where('user_id', $user->id))
            ->whereIn('id', $data['entry_ids'])
            ->with('cashbook')
            ->get();

        abort_if($entries->count() !== count($data['entry_ids']), 404, 'One or more entries were not found.');

        $updated = 0;

        $entries->pluck('cashbook')
            ->filter()
            ->unique('id')
            ->each(fn (BusinessCashbook $cashbook) => $this->authorize('manageEntries', $cashbook));

        DB::transaction(function () use (&$updated, $entries, $data) {
            foreach ($entries as $entry) {
                if ($data['action'] === 'delete') {
                    if ($entry->delete()) {
                        $updated++;
                    }

                    continue;
                }

                $changed = match ($data['action']) {
                    'toggle_tax' => $entry->forceFill([
                        'is_tax_deductible' => $data['is_tax_deductible'] ?? ! $entry->is_tax_deductible,
                    ])->isDirty(),
                    'reclassify' => $entry->forceFill([
                        'entry_type' => $data['entry_type'] ?? $entry->entry_type,
                        'category' => $data['category'] ?? $entry->category,
                    ])->isDirty(),
                    default => false,
                };

                if ($changed) {
                    $entry->save();
                    $updated++;
                }
            }
        });

        return response()->json([
            'updated' => $updated,
            'message' => 'Bulk action processed.',
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $cashbook = $this->resolveCashbook($request, $data['cashbook_id'] ?? null);
        $this->authorize('view', $cashbook);

        $summary = $this->summaryService->buildSummary($cashbook, $data);

        return response()->json($summary);
    }

    private function resolveCashbook(Request $request, ?int $cashbookId = null): BusinessCashbook
    {
        $user = $request->user();

        if ($cashbookId) {
            return BusinessCashbook::query()
                ->where('user_id', $user->id)
                ->findOrFail($cashbookId);
        }

        $cashbook = $user->businessCashbooks()->where('is_default', true)->first();

        if (! $cashbook) {
            $cashbook = BusinessCashbook::create([
                'user_id' => $user->id,
                'name' => 'My business',
                'entity_type' => 'sole_trader',
                'currency' => 'AUD',
                'is_default' => true,
            ]);
        }

        return $cashbook;
    }

}

