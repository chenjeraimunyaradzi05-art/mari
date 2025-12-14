<?php

namespace App\Exports;

use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

final class BusinessCashbookEntriesExport implements FromQuery, WithMapping, WithHeadings, ShouldAutoSize, WithCustomCsvSettings
{
    use Exportable;

    public function __construct(private readonly BusinessCashbook $cashbook, private readonly array $filters = [])
    {
    }

    #[\Override]
    /**
     * @return Builder
     *
     * @psalm-return Builder<BusinessCashbookEntry>
     */
    public function query(): Builder
    {
        $query = BusinessCashbookEntry::query()
            ->where('business_cashbook_id', $this->cashbook->id)
            ->orderBy('date')
            ->orderBy('id');

        if (! empty($this->filters['from'])) {
            $query->whereDate('date', '>=', $this->filters['from']);
        }

        if (! empty($this->filters['to'])) {
            $query->whereDate('date', '<=', $this->filters['to']);
        }

        return $query;
    }

    /**
     * @param \App\Models\BusinessCashbookEntry  $entry
     *
     * @return (int|null|string)[]
     *
     * @psalm-return list{int, string, string, null|string, null|string, string, 'No'|'Yes'}
     */
    #[\Override]
    public function map($entry): array
    {
        return [
            $entry->id,
            optional($entry->date)->toDateString(),
            strtoupper((string) $entry->entry_type),
            $entry->category,
            $entry->description,
            number_format((float) $entry->amount, 2, '.', ''),
            $entry->is_tax_deductible ? 'Yes' : 'No',
        ];
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return list{'Entry ID', 'Date', 'Type', 'Category', 'Description', string, 'Tax Deductible'}
     */
    public function headings(): array
    {
        return [
            'Entry ID',
            'Date',
            'Type',
            'Category',
            'Description',
            'Amount ('.$this->cashbook->currency.')',
            'Tax Deductible',
        ];
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return array{enclosure: '"', delimiter: ',', line_ending: string}
     */
    public function getCsvSettings(): array
    {
        return [
            'enclosure' => '"',
            'delimiter' => ',',
            'line_ending' => PHP_EOL,
        ];
    }
}

