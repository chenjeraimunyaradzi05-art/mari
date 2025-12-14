<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Debt;
use App\Services\Money\BudgetSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class BudgetController extends Controller
{
    public function __construct(private readonly BudgetSyncService $budgetSync)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scope' => ['nullable', Rule::in(['personal', 'business'])],
        ]);

        $user = $request->user();
        $scope = $validated['scope'] ?? 'personal';

        $budget = Budget::query()
            ->with(['items' => function ($query) {
                $query->orderBy('created_at');
            }])
            ->where('user_id', $user->id)
            ->where('scope', $scope)
            ->first();

        $debts = Debt::query()
            ->where('user_id', $user->id)
            ->where('scope', $scope)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'budget' => $budget,
            'debts' => $debts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', Rule::in(['personal', 'business'])],
            'label' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:8'],
            'savings_goal_monthly' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['nullable', 'array'],
            'items.*.id' => ['nullable', 'integer', 'exists:budget_items,id'],
            'items.*.type' => ['required', Rule::in(['income', 'expense'])],
            'items.*.category' => ['nullable', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.amount' => ['required', 'integer', 'min:0'],
            'items.*.frequency' => ['required', Rule::in(['week', 'fortnight', 'month', 'year', 'once'])],
            'debts' => ['nullable', 'array'],
            'debts.*.id' => ['nullable', 'integer', 'exists:debts,id'],
            'debts.*.name' => ['required', 'string', 'max:255'],
            'debts.*.balance' => ['required', 'integer', 'min:0'],
            'debts.*.interest_rate' => ['nullable', 'numeric', 'min:0', 'max:99.99'],
            'debts.*.min_payment' => ['nullable', 'integer', 'min:0'],
        ]);

        $user = $request->user();
        $data['scope'];

        [$budget, $debts] = $this->budgetSync->sync($user, $data);

        return response()->json([
            'budget' => $budget,
            'debts' => $debts,
            'message' => 'Budget saved.',
        ]);
    }
}

