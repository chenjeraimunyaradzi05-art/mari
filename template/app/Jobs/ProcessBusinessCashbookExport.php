<?php

namespace App\Jobs;

use App\Exports\BusinessCashbookEntriesExport;
use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use App\Services\Business\BusinessCashbookSummaryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Excel as ExcelWriter;

final class ProcessBusinessCashbookExport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly string $jobId,
        public readonly int $userId,
        public readonly ?int $cashbookId,
        public readonly ?string $from,
        public readonly ?string $to,
        public readonly string $format = 'pdf'
    ) {
    }

    private function resolveCashbook(): BusinessCashbook|null
    {
        $query = BusinessCashbook::query()->where('user_id', $this->userId);

        if ($this->cashbookId) {
            return $query->find($this->cashbookId);
        }

        return $query->where('is_default', true)->first();
    }

    /**
     * @return (Carbon|null)[]
     *
     * @psalm-return list{Carbon|null, Carbon|null}
     */
    private function dateRange(): array
    {
        $from = $this->from ? Carbon::parse($this->from) : null;
        $to = $this->to ? Carbon::parse($this->to) : null;

        return [$from, $to];
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, BusinessCashbookEntry>
     */
    private function entriesForExport(BusinessCashbook $cashbook, ?Carbon $from, ?Carbon $to): \Illuminate\Database\Eloquent\Collection
    {
        $query = BusinessCashbookEntry::query()
            ->where('business_cashbook_id', $cashbook->id)
            ->orderBy('date')
            ->orderBy('id');

        if ($from) {
            $query->whereDate('date', '>=', $from->toDateString());
        }

        if ($to) {
            $query->whereDate('date', '<=', $to->toDateString());
        }

        return $query->get();
    }

    private function cacheKey(): string
    {
        return sprintf('exports:business:%s', $this->jobId);
    }
}

