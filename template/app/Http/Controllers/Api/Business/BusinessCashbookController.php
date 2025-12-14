<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use App\Models\BusinessCashbook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BusinessCashbookController extends Controller
{
    public function showOrCreateDefault(Request $request): JsonResponse
    {
        $user = $request->user();

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

        return response()->json([
            'cashbook' => $cashbook,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['required', 'integer', 'exists:business_cashbooks,id'],
            'name' => ['nullable', 'string', 'max:120'],
            'entity_type' => ['nullable', 'string', 'max:60'],
            'currency' => ['nullable', 'string', 'max:12'],
            'is_default' => ['nullable', 'boolean'],
            'start_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $cashbook = BusinessCashbook::query()
            ->where('user_id', $user->id)
            ->findOrFail($data['cashbook_id']);

        $this->authorize('update', $cashbook);

        $payload = collect($data)
            ->except(['cashbook_id'])
            ->filter(fn ($value) => ! is_null($value))
            ->toArray();

        $cashbook->fill($payload)->save();

        if (! empty($payload['is_default']) && $payload['is_default']) {
            $user->businessCashbooks()
                ->whereKeyNot($cashbook->getKey())
                ->update(['is_default' => false]);
        }

        return response()->json([
            'cashbook' => $cashbook->fresh(),
            'message' => 'Cashbook updated.',
        ]);
    }
}

