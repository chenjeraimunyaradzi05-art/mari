<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Http\Resources\Money\BankAccountResource;
use App\Models\BankTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class BankAccountController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $accounts = $user->bankAccounts()
            ->withCount([
                'transactions as pending_transactions_count' => fn ($query) => $query->where('status', BankTransaction::STATUS_PENDING),
            ])
            ->orderByDesc('created_at')
            ->get();

        return BankAccountResource::collection($accounts);
    }
}

