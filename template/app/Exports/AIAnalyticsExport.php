<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

final class AIAnalyticsExport implements FromArray, WithHeadings, WithStyles, WithTitle
{
    protected $data;
    protected $title;

    public function __construct(array $data, string $title = 'AI Analytics')
    {
        $this->data = $data;
        $this->title = $title;
    }

    public function array(): array
    {
        return $this->data;
    }


    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    public function headings(): array
    {
        if (empty($this->data)) {
            return [];
        }

        return array_keys($this->data[0]);
    }

    public function title(): string
    {
        return substr($this->title, 0, 31); // Excel limit
    }

    /**
     * @return (string|string[]|true)[][][]
     *
     * @psalm-return array{1: array{font: array{bold: true, color: array{rgb: 'FFFFFF'}}, fill: array{fillType: 'solid', startColor: array{rgb: 'E91E8C'}}}}
     */

    /**
     * @return (string|string[]|true)[][][]
     *
     * @psalm-return array{1: array{font: array{bold: true, color: array{rgb: 'FFFFFF'}}, fill: array{fillType: 'solid', startColor: array{rgb: 'E91E8C'}}}}
     */
    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'E91E8C'],
                ],
            ],
        ];
    }
}

