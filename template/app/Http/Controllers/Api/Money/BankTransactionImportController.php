<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Models\BankTransaction;
use App\Services\Money\BankTransactionCsvImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class BankTransactionImportController extends Controller
{
    public function __construct(private readonly BankTransactionCsvImportService $importer)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:8192'],
            'account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'default_status' => ['nullable', Rule::in([
                BankTransaction::STATUS_PENDING,
                BankTransaction::STATUS_MATCHED,
                BankTransaction::STATUS_EXCLUDED,
            ])],
        ]);

        $account = null;

        if (! empty($data['account_id'])) {
            $account = $user->bankAccounts()->whereKey($data['account_id'])->first();
            abort_if(! $account, 404, 'Account not found.');
        }

        $result = $this->importer->importFromCsv(
            $user,
            $request->file('csv')->getRealPath(),
            $account,
            [
                'default_status' => $data['default_status'] ?? BankTransaction::STATUS_PENDING,
            ]
        );

        $stats = $result['stats'];
        $message = sprintf(
            'Import complete: %d created, %d updated, %d unchanged, %d skipped.',
            $stats['created'],
            $stats['updated'],
            $stats['unchanged'],
            $stats['skipped']
        );

        return response()->json([
            'message' => $message,
            'stats' => $stats,
            'warnings' => $result['warnings'],
        ]);
    }
}

