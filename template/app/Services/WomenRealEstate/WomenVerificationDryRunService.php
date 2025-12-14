<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Jobs\WomenRealEstate\ProcessAgentVerificationJob;
use App\Jobs\WomenRealEstate\ReverifyExpiredAgentJob;
use App\Jobs\WomenRealEstate\SendVerificationReminderJob;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Faker\Generator;
use Illuminate\Support\Arr;

final class WomenVerificationDryRunService
{
    private const REGULATOR_STATUSES = ['ok', 'mismatch'];

    /**
     * @return (array|int|mixed|null|string)[]
     *
     * @psalm-return array{agent_id: int, stage: null|string, risk_flags: array<never, never>|mixed, signals: array, reminders_count: int<0, max>, reverify_after: mixed, lead_days: int}
     */
    public function run(WomenVerifiedAgent $agent, array $options = []): array
    {
        $signals = $this->buildSignals($options);
        $leadDays = (int) ($options['lead_days'] ?? 30);

        ProcessAgentVerificationJob::dispatchSync($agent->id, $signals);
        $agent->refresh();

        $lastAssessment = Arr::get($agent->verification_payload, 'last_assessment', []);
        $stage = $agent->verification_stage?->value ?? null;
        $riskFlags = $lastAssessment['risk_flags'] ?? [];

        SendVerificationReminderJob::dispatchSync($agent->id, 'license_expiry', [
            'days_before_expiry' => $leadDays,
        ]);
        $agent->refresh();
        $reminders = Arr::get($agent->verification_payload, 'reminders', []);

        ReverifyExpiredAgentJob::dispatchSync($leadDays);
        $agent->refresh();
        $reverifyAfter = Arr::get($agent->verification_payload, 'reverify_after');

        return [
            'agent_id' => $agent->id,
            'stage' => $stage,
            'risk_flags' => $riskFlags,
            'signals' => $signals,
            'reminders_count' => count($reminders),
            'reverify_after' => $reverifyAfter,
            'lead_days' => $leadDays,
        ];
    }

    public function resolveAgent(?string $identifier = null, bool $fallbackToLatest = true): WomenVerifiedAgent|null
    {
        if ($identifier !== null) {
            $agent = WomenVerifiedAgent::query()
                ->with('user')
                ->whereKey($identifier)
                ->first();

            if ($agent !== null) {
                return $agent;
            }

            $agent = WomenVerifiedAgent::query()
                ->with('user')
                ->whereHas('user', fn ($query) => $query->where('email', $identifier))
                ->first();

            if ($agent !== null) {
                return $agent;
            }

            if (! $fallbackToLatest) {
                return null;
            }
        }

        if (! $fallbackToLatest) {
            return null;
        }

        return WomenVerifiedAgent::query()
            ->with('user')
            ->latest('id')
            ->first();
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'ok', 'mismatch'}
     */
    public function validRegulatorStatuses(): array
    {
        return self::REGULATOR_STATUSES;
    }

    /**
     * @return ((mixed|string)[]|float|int)[]
     *
     * @psalm-return array{fraud_score: 0|1|float, regulator: array{status: 'mismatch'|'ok'|mixed}}
     */
    private function buildSignals(array $options): array
    {
        $fraudScore = $options['fraud_score'] ?? null;
        $regulatorStatus = $options['regulator_status'] ?? null;

        if ($fraudScore !== null) {
            $fraudScore = max(0, min(1, (float) $fraudScore));
        }

        if ($regulatorStatus !== null && ! in_array($regulatorStatus, self::REGULATOR_STATUSES, true)) {
            $regulatorStatus = null;
        }

        return [
            'fraud_score' => $fraudScore ?? $this->faker->randomFloat(2, 0.1, 0.9),
            'regulator' => [
                'status' => $regulatorStatus ?? $this->faker->randomElement(self::REGULATOR_STATUSES),
            ],
        ];
    }
}

