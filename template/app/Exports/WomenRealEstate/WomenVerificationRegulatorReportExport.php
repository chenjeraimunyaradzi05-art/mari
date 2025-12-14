<?php

declare(strict_types=1);

namespace App\Exports\WomenRealEstate;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

final class WomenVerificationRegulatorReportExport implements WithMultipleSheets
{
    public function __construct(
        private readonly ?string $regulator = null,
        private readonly ?string $status = null,
        private readonly ?string $from = null,
        private readonly ?string $to = null,
    ) {
    }

    #[\Override]
    /**
     * @return (WomenVerificationRegulatorAgentsSheet|WomenVerificationRegulatorSummarySheet)[]
     *
     * @psalm-return list{WomenVerificationRegulatorSummarySheet, WomenVerificationRegulatorAgentsSheet}
     */
    public function sheets(): array
    {
        return [
            new WomenVerificationRegulatorSummarySheet($this->regulator, $this->status, $this->from, $this->to),
            new WomenVerificationRegulatorAgentsSheet($this->regulator, $this->status, $this->from, $this->to),
        ];
    }
}

