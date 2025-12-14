<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class WomenVerificationAiSummaryService
{
    /**
     * @param array<string, mixed> $context
     *
     * @return (float|string|string[])[]
     *
     * @psalm-return array{overview: string, priority_flags: array<int, string>, recommendations: array<int, string>, fraud_score: float, regulator_status: string}
     */
    public function summarise(WomenVerifiedAgent $agent, array $context): array
    {
        $fraudScore = (float) Arr::get($context, 'fraud.score', 0.0);
        $regulatorStatus = (string) Arr::get($context, 'regulator.status', 'unknown');
        $riskFlags = array_values(array_unique(Arr::get($context, 'risk_flags', [])));

        $overview = sprintf(
            '%s (license %s) is currently %s at the %s stage.',
            $agent->user?->name ?? 'The agent',
            $agent->license_number ?? 'not provided',
            Str::headline($agent->status ?? 'pending'),
            Str::headline($agent->verification_stage?->value ?? 'initial')
        );

        $priorityFlags = collect($riskFlags)
            ->map(fn (string $flag) => Str::headline(str_replace('_', ' ', $flag)))
            ->values()
            ->all();

        $recommendations = $this->buildRecommendations($fraudScore, $regulatorStatus, $riskFlags);

        return [
            'overview' => $overview,
            'priority_flags' => $priorityFlags,
            'recommendations' => $recommendations,
            'fraud_score' => round($fraudScore, 2),
            'regulator_status' => $regulatorStatus,
        ];
    }

    /**
     * @param array<int, string> $riskFlags
     *
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: 'Contact the regulator to validate the license details supplied.'|'Escalate to compliance for enhanced fraud review.', 2?: 'Contact the regulator to validate the license details supplied.'}
     */
    private function buildRecommendations(float $fraudScore, string $regulatorStatus, array $riskFlags): array
    {
        $recommendations = [];

        if (in_array('missing_required_documents', $riskFlags, true)) {
            $recommendations[] = 'Request the missing documents before making a final decision.';
        }

        if ($fraudScore >= 0.6) {
            $recommendations[] = 'Escalate to compliance for enhanced fraud review.';
        }

        if ($regulatorStatus === 'mismatch' || $regulatorStatus === 'manual_review') {
            $recommendations[] = 'Contact the regulator to validate the license details supplied.';
        }

        if ($recommendations === []) {
            $recommendations[] = 'No blockers detected. Proceed with standard reviewer checklist.';
        }

        return $recommendations;
    }
}

