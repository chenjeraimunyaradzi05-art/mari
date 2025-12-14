<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Services\MortgageRepaymentService;
use App\Services\WomenRealEstate\Ai\WomenMortgageAiService;
use App\Services\WomenRealEstate\WomenCohortTimelineService;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class MortgageGuidanceService
{
    public function __construct(
        private MortgageRepaymentService $repayments,
        private WomenMortgageAiService $mortgageAi,
        private WomenCohortTimelineService $timelineService
    ) {
    }

    /**
     * @return (array|float|string)[]
     *
     * @psalm-return array{target_price: float, current_savings: float, deposit_ratio: float, risk_rating: string, interest_rate: float, repayments: array{monthly: float|int, fortnightly: float|int}, grant_checklist: array, next_actions: array, notes: array{commentary: 'Stabilise your deposit contributions and gather supporting docs for pre-approval.'|mixed, sustainability_plan: mixed, ai_provider: mixed}, ai_guidance: array<string, mixed>}
     */
    public function insight(WomenCohortProfile $profile, array $goalSummary = []): array
    {
        $financial = $profile->financial_profile ?? [];

        $targetPrice = (float) ($financial['target_property_price'] ?? 550000);
        $currentSavings = (float) ($financial['savings_balance'] ?? Arr::get($goalSummary, 'primary_goal.current', 62000));
        $persona = $profile->persona ?? CohortPersona::FIRST_HOME_BUYER;

        $depositRatio = $targetPrice > 0 ? round($currentSavings / $targetPrice, 2) : 0.0;
        $riskRating = $this->repayments->estimateRiskRating($depositRatio);

        $principal = max($targetPrice - $currentSavings, 0.0);
        $rate = (float) ($financial['assumed_rate'] ?? 5.65);
        $termMonths = (int) ($financial['loan_term_months'] ?? 360);

        $monthlyRepaymentCents = $this->repayments->calculateRepaymentCents((int) round($principal * 100), $rate, $termMonths, 'monthly');
        $fortnightlyRepaymentCents = $this->repayments->calculateRepaymentCents((int) round($principal * 100), $rate, $termMonths, 'fortnightly');

        $aiGuidance = $this->mortgageAi->climatePositiveGuidance($profile, $goalSummary);

        $this->recordTimelineEvent($profile, $persona, $aiGuidance, $depositRatio);

        return [
            'target_price' => $targetPrice,
            'current_savings' => $currentSavings,
            'deposit_ratio' => $depositRatio,
            'risk_rating' => $riskRating,
            'interest_rate' => $rate,
            'repayments' => [
                'monthly' => $monthlyRepaymentCents / 100,
                'fortnightly' => $fortnightlyRepaymentCents / 100,
            ],
            'grant_checklist' => $this->grantChecklist($persona, $depositRatio),
            'next_actions' => $this->nextActions($persona, $riskRating),
            'notes' => [
                'commentary' => Arr::get($aiGuidance, 'headline')
                    ?? Arr::get($financial, 'ai_commentary')
                    ?? 'Stabilise your deposit contributions and gather supporting docs for pre-approval.',
                'sustainability_plan' => Arr::get($aiGuidance, 'sustainability_plan'),
                'ai_provider' => Arr::get($aiGuidance, 'provider'),
            ],
            'ai_guidance' => $aiGuidance,
        ];
    }

    private function recordTimelineEvent(WomenCohortProfile $profile, CohortPersona $persona, array $aiGuidance, float $depositRatio): void
    {
        $summary = (string) Arr::get($aiGuidance, 'headline', '');
        $activationSteps = $this->formatActivationSteps(Arr::get($aiGuidance, 'next_actions', []));

        $valuesAlignment = array_values(array_filter([
            Arr::get($aiGuidance, 'sustainability_plan.flora_fauna_support'),
            Arr::get($aiGuidance, 'sustainability_plan.community_equity'),
        ]));

        $this->timelineService->recordAiGuidanceEvent($profile, [
            'summary' => $summary,
            'activation_steps' => $activationSteps,
            'values_alignment' => $valuesAlignment,
            'provider' => Arr::get($aiGuidance, 'provider'),
        ], [
            'source' => 'mortgage_guidance',
            'subject' => sprintf('%s mortgage plan', $persona->label()),
            'event_type' => 'mortgage_guidance',
            'score' => round($depositRatio * 100, 1),
            'headline' => 'Mortgage guidance refreshed',
        ]);
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function formatActivationSteps(mixed $actions): array
    {
        return collect(Arr::wrap($actions))
            ->map(function ($action) {
                if (is_string($action)) {
                    return trim($action);
                }

                if (is_array($action)) {
                    $label = trim((string) Arr::get($action, 'label', ''));

                    if ($label === '') {
                        return null;
                    }

                    $urgency = (string) Arr::get($action, 'urgency', '');
                    $impact = (string) Arr::get($action, 'impact', '');
                    $meta = array_filter([
                        $urgency !== '' ? Str::upper($urgency) : null,
                        $impact !== '' ? Str::headline($impact) : null,
                    ]);

                    if ($meta === []) {
                        return $label;
                    }

                    return sprintf('%s (%s)', $label, implode(' · ', $meta));
                }

                return null;
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0: array{label: 'Verify your identification documents', status: 'complete'}, 1: array{label: 'Gather bank statements for the past 90 days', status: 'complete'|'in-progress'}, 2: array{label: 'Confirm borrowing capacity with broker', status: 'action-needed'}, 3?: array{label: 'Check student housing grants in your state'|'Upload partner expressions of interest', status: 'action-needed'}, 4?: array{label: 'Upload partner expressions of interest', status: 'action-needed'}}
     */
    private function grantChecklist(CohortPersona $persona, float $depositRatio): array
    {
        $base = [
            ['label' => 'Verify your identification documents', 'status' => 'complete'],
            ['label' => 'Gather bank statements for the past 90 days', 'status' => $depositRatio >= 0.1 ? 'complete' : 'in-progress'],
            ['label' => 'Confirm borrowing capacity with broker', 'status' => 'action-needed'],
        ];

        if ($persona === CohortPersona::LEARNER) {
            $base[] = ['label' => 'Check student housing grants in your state', 'status' => 'action-needed'];
        }

        if (in_array($persona, [CohortPersona::INVESTOR, CohortPersona::DEVELOPER], true)) {
            $base[] = ['label' => 'Upload partner expressions of interest', 'status' => 'action-needed'];
        }

        return $base;
    }

    /**
     * @return string[]
     *
     * @psalm-return array{book_strategy_session: 'Book a mortgage strategy session to confirm your borrowing range.', upload_documents: 'Scan and upload supporting documents via the secure checklist.', budget_coach?: 'Review the student budget coach to balance work-study commitments.', boost_deposit?: 'Increase deposit by $5,000 to improve risk profile.'}
     */
    private function nextActions(CohortPersona $persona, string $riskRating): array
    {
        $actions = [
            'book_strategy_session' => 'Book a mortgage strategy session to confirm your borrowing range.',
            'upload_documents' => 'Scan and upload supporting documents via the secure checklist.',
        ];

        if ($persona === CohortPersona::LEARNER) {
            $actions['budget_coach'] = 'Review the student budget coach to balance work-study commitments.';
        }

        if ($riskRating === 'high') {
            $actions['boost_deposit'] = 'Increase deposit by $5,000 to improve risk profile.';
        }

        return $actions;
    }
}

