<?php

declare(strict_types=1);

namespace App\Exports\WomenRealEstate;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

final class WomenVerificationRegulatorAgentsSheet implements FromQuery, WithHeadings, WithMapping, WithTitle
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
     * @return Builder
     *
     * @psalm-return Builder<WomenVerifiedAgent>
     */
    public function query(): Builder
    {
        $query = WomenVerifiedAgent::query()
            ->with('user')
            ->orderBy('regulator')
            ->orderBy('user_id');

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

        return $query;
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return list{'Regulator', 'Agent ID', 'Agent Name', 'Agent Email', 'Status', 'Verification Stage', 'License Number', 'License Expires At (AEST)', 'Verified At (AEST)', 'Last Reviewed At (AEST)', 'Compliance Score', 'Trust Badge Level'}
     */
    public function headings(): array
    {
        return [
            'Regulator',
            'Agent ID',
            'Agent Name',
            'Agent Email',
            'Status',
            'Verification Stage',
            'License Number',
            'License Expires At (AEST)',
            'Verified At (AEST)',
            'Last Reviewed At (AEST)',
            'Compliance Score',
            'Trust Badge Level',
        ];
    }

    /**
     * @param WomenVerifiedAgent $agent
     *
     * @return (int|string)[]
     *
     * @psalm-return list{string, int, string, string, string, string, string, string, string, string, string, int}
     */
    #[\Override]
    public function map($agent): array
    {
        $licenseExpiry = CarbonImmutable::make($agent->license_expires_at)?->timezone('Australia/Sydney');
        $verifiedAt = CarbonImmutable::make($agent->verified_at)?->timezone('Australia/Sydney');
        $lastReviewed = CarbonImmutable::make($agent->last_reviewed_at)?->timezone('Australia/Sydney');

        $stage = $agent->verification_stage instanceof VerificationStage
            ? $agent->verification_stage->value
            : (string) $agent->verification_stage;

        return [
            $agent->regulator ?? 'Unknown',
            $agent->id,
            $agent->user?->name ?? '',
            $agent->user?->email ?? '',
            $agent->status,
            $stage,
            $agent->license_number,
            $licenseExpiry?->format('Y-m-d') ?? '',
            $verifiedAt?->format('Y-m-d H:i:s') ?? '',
            $lastReviewed?->format('Y-m-d H:i:s') ?? '',
            $agent->compliance_score !== null ? number_format((float) $agent->compliance_score, 2) : '',
            $agent->trust_badge_level,
        ];
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'Regulator Agents'
     */
    public function title(): string
    {
        return 'Regulator Agents';
    }
}

