<?php

namespace App\Services\Money;

use App\Models\Budget;
use App\Models\Debt;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class BudgetSyncService
{
    /**
     * Persist a budget snapshot and return the refreshed budget and debts collections.
     *
     * @param  array{scope:string,label:?string,currency:?string,savings_goal_monthly:?int,notes:?string,items:?array<array-key,array>,debts:?array<array-key,array>}  $payload
     * @return array{0:\App\Models\Budget,1:\Illuminate\Support\Collection<int,\App\Models\Debt>}
     */
    public function sync(User $user, array $payload): array
    {
        $scope = $payload['scope'];

        return DB::transaction(function () use ($user, $payload, $scope) {
            $budget = Budget::updateOrCreate(
                ['user_id' => $user->id, 'scope' => $scope],
                [
                    'label' => $payload['label'] ?? null,
                    'currency' => $payload['currency'] ?? 'AUD',
                    'savings_goal_monthly' => $payload['savings_goal_monthly'] ?? null,
                    'notes' => $payload['notes'] ?? null,
                ]
            );

            $budget->items()->delete();

            foreach ($payload['items'] ?? [] as $itemData) {
                $budget->items()->create([
                    'type' => $itemData['type'],
                    'category' => $itemData['category'] ?? null,
                    'description' => $itemData['description'] ?? null,
                    'amount' => $itemData['amount'],
                    'frequency' => $itemData['frequency'],
                ]);
            }

            Debt::query()
                ->where('user_id', $user->id)
                ->where('scope', $scope)
                ->delete();

            foreach ($payload['debts'] ?? [] as $debtData) {
                Debt::create([
                    'user_id' => $user->id,
                    'scope' => $scope,
                    'name' => $debtData['name'],
                    'balance' => $debtData['balance'],
                    'interest_rate' => $debtData['interest_rate'] ?? null,
                    'min_payment' => $debtData['min_payment'] ?? null,
                ]);
            }

            $budget->load(['items' => function ($query) {
                $query->orderBy('created_at');
            }]);

            $debts = Debt::query()
                ->where('user_id', $user->id)
                ->where('scope', $scope)
                ->orderBy('created_at')
                ->get();

            return [$budget, $debts];
        });
    }
}

