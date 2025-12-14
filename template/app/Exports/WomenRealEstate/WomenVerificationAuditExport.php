<?php

declare(strict_types=1);

namespace App\Exports\WomenRealEstate;

use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

final class WomenVerificationAuditExport implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    private ?CarbonImmutable $from;

    private ?CarbonImmutable $to;

    public function __construct(?string $from = null, ?string $to = null)
    {
        $this->from = $from ? CarbonImmutable::parse($from) : null;
        $this->to = $to ? CarbonImmutable::parse($to) : null;
    }

    #[\Override]
    /**
     * @return \Illuminate\Database\Eloquent\Collection
     *
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, WomenAgentVerificationAudit>
     */
    public function collection(): Collection
    {
        $query = WomenAgentVerificationAudit::query()
            ->with(['agent.user', 'reviewer'])
            ->latest('created_at');

        if ($this->from) {
            $query->where('created_at', '>=', $this->from->startOfDay());
        }

        if ($this->to) {
            $query->where('created_at', '<=', $this->to->endOfDay());
        }

        return $query->get();
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return list{'Audit ID', 'Recorded At (AEST)', 'Agent ID', 'Agent Name', 'Agent Email', 'Status Before', 'Status After', 'Reviewer', 'Stage', 'Notes', 'AI Summary'}
     */
    public function headings(): array
    {
        return [
            'Audit ID',
            'Recorded At (AEST)',
            'Agent ID',
            'Agent Name',
            'Agent Email',
            'Status Before',
            'Status After',
            'Reviewer',
            'Stage',
            'Notes',
            'AI Summary',
        ];
    }

    /**
     * @param WomenAgentVerificationAudit $audit
     *
     * @return (int|null|string)[]
     *
     * @psalm-return list{int, string, ''|int, string, string, null|string, string, string, string, string, string}
     */
    #[\Override]
    public function map($audit): array
    {
        $recordedAt = CarbonImmutable::make($audit->created_at)?->timezone('Australia/Sydney');
        $agent = $audit->agent;
        $user = $agent?->user;
        $stage = $agent?->verification_stage;

        $notes = $audit->notes ?? [];
        if (is_array($notes) && $notes !== []) {
            $notes = json_encode($notes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $aiSummary = $audit->ai_summary ?? [];
        if (is_array($aiSummary) && $aiSummary !== []) {
            $aiSummary = json_encode($aiSummary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return [
            $audit->id,
            $recordedAt?->format('Y-m-d H:i:s') ?? '',
            $agent?->id ?? '',
            $user?->name ?? '',
            $user?->email ?? '',
            $audit->status_before,
            $audit->status_after,
            $audit->reviewer?->name ?? '',
            $stage instanceof \App\Enums\WomenRealEstate\VerificationStage ? $stage->value : ($stage ?? ''),
            is_string($notes) ? $notes : '',
            is_string($aiSummary) ? $aiSummary : '',
        ];
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'Verification Audits'
     */
    public function title(): string
    {
        return 'Verification Audits';
    }
}

