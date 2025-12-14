<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessBusinessCashbookExport;
use App\Models\BusinessCashbook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class BusinessCashbookExportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:business_cashbooks,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]);

        $user = $request->user();
        $cashbook = $this->resolveCashbook($user->id, $data['cashbook_id'] ?? null);

        if ($cashbook) {
            $this->authorize('export', $cashbook);
        }
        $jobId = (string) Str::uuid();
        $format = $data['format'] ?? 'pdf';
        $filters = array_filter([
            'from' => $data['from'] ?? null,
            'to' => $data['to'] ?? null,
        ]);

        Cache::put(
            sprintf('exports:business:%s', $jobId),
            [
                'user_id' => $user->id,
                'status' => 'pending',
                'format' => $format,
                'queued_at' => now()->toIso8601String(),
                'filters' => $filters,
            ],
            now()->addDays(7)
        );

        ProcessBusinessCashbookExport::dispatch(
            $jobId,
            $user->id,
            $data['cashbook_id'] ?? null,
            $data['from'] ?? null,
            $data['to'] ?? null,
            $format
        )->onQueue('exports');

        return response()->json([
            'job_id' => $jobId,
            'status' => 'queued',
        ], 202);
    }

    private function resolveCashbook(int $userId, ?int $cashbookId): BusinessCashbook|null
    {
        $query = BusinessCashbook::query()->where('user_id', $userId);

        if ($cashbookId) {
            return $query->find($cashbookId);
        }

        return $query->where('is_default', true)->first();
    }
}

