<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use App\Models\BusinessBudget;
use App\Models\BusinessBudgetLine;
use App\Models\BusinessCashbook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class BusinessBudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
        ]);

        $cashbook = $this->resolveCashbook($request, $data['cashbook_id'] ?? null);
        $this->authorize('view', $cashbook);

        $budgets = $cashbook->budgets()
            ->with(['lines'])
            ->orderByDesc('period_start')
            ->limit(6)
            ->get();

        return response()->json([
            'budgets' => $budgets,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'title' => ['nullable', 'string', 'max:120'],
            'currency' => ['nullable', 'string', 'max:12'],
            'auto_rollover' => ['nullable', 'boolean'],
            'lines' => ['nullable', 'array'],
            'lines.*.line_type' => ['required_with:lines', 'string'],
            'lines.*.category' => ['nullable', 'string', 'max:120'],
            'lines.*.label' => ['nullable', 'string', 'max:120'],
            'lines.*.planned_amount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.sort_order' => ['nullable', 'integer'],
            'lines.*.notes' => ['nullable', 'string'],
        ]);

        $cashbook = $this->resolveCashbook($request, $data['cashbook_id'] ?? null);
        $this->authorize('manageBudgets', $cashbook);

        $budget = null;

        DB::transaction(function () use (&$budget, $cashbook, $data) {
            $budget = BusinessBudget::updateOrCreate([
                'business_cashbook_id' => $cashbook->id,
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
            ], [
                'title' => $data['title'] ?? null,
                'currency' => $data['currency'] ?? $cashbook->currency,
                'auto_rollover' => $data['auto_rollover'] ?? false,
            ]);

            if (! empty($data['lines'])) {
                $budget->lines()->delete();

                $linePayloads = collect($data['lines'])
                    ->map(fn ($line, $index) => [
                        'line_type' => $line['line_type'],
                        'category' => $line['category'] ?? null,
                        'label' => $line['label'] ?? null,
                        'planned_amount' => $line['planned_amount'] ?? 0,
                        'sort_order' => $line['sort_order'] ?? $index,
                        'notes' => $line['notes'] ?? null,
                    ])->all();

                $budget->lines()->createMany($linePayloads);
            }
        });

        return response()->json([
            'budget' => $budget?->load('lines'),
            'message' => 'Budget saved.',
        ]);
    }

    private function resolveCashbook(Request $request, ?int $cashbookId = null): BusinessCashbook
    {
        $user = $request->user();

        if ($cashbookId) {
            return BusinessCashbook::query()
                ->where('user_id', $user->id)
                ->findOrFail($cashbookId);
        }

        return $user->businessCashbooks()->where('is_default', true)->firstOrFail();
    }
}

