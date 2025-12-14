<?php

declare(strict_types=1);

namespace App\Exports\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

final class WomenVerificationRegulatorSummarySheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    private ?string $regulator;

    private ?string $status;

    private ?CarbonImmutable $from;

    private ?CarbonImmutable $to;

    public function __construct(?string $regulator = null, ?string $status = null, ?string $from = null, ?string $to = null)
    {
        $this->regulator = $regulator !== null && $regulator !== '' ? $regulator : null;
        $this->status = $status !== null && $status !== '' ? $status : null;
        $this->from = $from ? CarbonImmutable::parse($from) : null;
        $this->to = $to ? CarbonImmutable::parse($to) : null;
    }

    #[\Override]
    /**
     * @return \Illuminate\Database\Eloquent\Collection
     *
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, WomenVerifiedAgent>
     */
    public function collection(): Collection
    {
        $query = WomenVerifiedAgent::query()
            ->selectRaw(
                'regulator, COUNT(*) as total_agents,' .
                ' SUM(CASE WHEN status = "verified" THEN 1 ELSE 0 END) as total_verified,' .
                ' SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as total_pending,' .
                ' SUM(CASE WHEN status = "pending_information" THEN 1 ELSE 0 END) as total_pending_information,' .
                ' SUM(CASE WHEN status = "pending_compliance" THEN 1 ELSE 0 END) as total_pending_compliance,' .
                ' SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as total_rejected,' .
                ' AVG(compliance_score) as average_compliance_score'
            )
            ->groupBy('regulator')
            ->orderBy('regulator');

        if ($this->regulator) {
            $query->where('regulator', $this->regulator);
        }

        if ($this->status) {
            $query->where('status', $this->status);
        }

        if ($this->from) {
            $query->where('verified_at', '>=', $this->from->startOfDay());
        }

        if ($this->to) {
            $query->where('verified_at', '<=', $this->to->endOfDay());
        }

        return $query->get();
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return list{'Regulator', 'Total Agents', 'Verified', 'Pending', 'Pending Information', 'Pending Compliance', 'Rejected', 'Average Compliance Score'}
     */
    public function headings(): array
    {
        return [
            'Regulator',
            'Total Agents',
            'Verified',
            'Pending',
            'Pending Information',
            'Pending Compliance',
            'Rejected',
            'Average Compliance Score',
        ];
    }

    #[\Override]
    /**
     * @return (int|mixed|string)[]
     *
     * @psalm-return list{'Unknown'|mixed, int, int, int, int, int, int, string}
     */
    public function map($row): array
    {
        $average = $row->average_compliance_score !== null
            ? number_format((float) $row->average_compliance_score, 2)
            : '';

        return [
            $row->regulator ?? 'Unknown',
            (int) $row->total_agents,
            (int) $row->total_verified,
            (int) $row->total_pending,
            (int) $row->total_pending_information,
            (int) $row->total_pending_compliance,
            (int) $row->total_rejected,
            $average,
        ];
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'Regulator Summary'
     */
    public function title(): string
    {
        return 'Regulator Summary';
    }
}

