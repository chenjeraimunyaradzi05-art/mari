<?php

namespace App\Services;

final class BusinessStructureWizardService
{
    /**
     * Analyse questionnaire responses and return structure guidance.
     *
     * @param array<string, mixed>  $responses
     *
     * @return ((array|string)[]|mixed|string)[]
     *
     * @psalm-return array{recommended_structure: mixed, confidence_score: mixed, pros: mixed, cons: mixed, tax_implications: mixed, setup_cost: mixed, next_steps: array<int, string>, benefits: array<int, array{label: string, detail: string}>, structure_deck: array<int, array<string, mixed>>, disclaimer: 'Educational information only. Confirm decisions with your accountant, tax agent, and lawyer.'}
     */
    public function analyze(array $responses): array
    {
        $structure = $this->determineBestStructure($responses);

        return [
            'recommended_structure' => $structure['type'],
            'confidence_score' => $structure['confidence'],
            'pros' => $structure['pros'],
            'cons' => $structure['cons'],
            'tax_implications' => $structure['tax'],
            'setup_cost' => $structure['cost'],
            'next_steps' => $this->getNextSteps($structure['type']),
            'benefits' => $this->benefitCallouts($structure['type'], $responses),
            'structure_deck' => $this->buildStructureDeck(),
            'disclaimer' => 'Educational information only. Confirm decisions with your accountant, tax agent, and lawyer.',
        ];
    }

    /**
     * @param  array<string, mixed>  $responses
     * @return array<string, mixed>
     */
    private function determineBestStructure(array $responses): array
    {
        $hiring = (bool) ($responses['hiring'] ?? false);
        $investment = (bool) ($responses['external_investment'] ?? false);
        $revenue = (int) ($responses['annual_revenue'] ?? 0);
        $complexity = $responses['complexity'] ?? 'low';
        $teamSize = max(0, (int) ($responses['team_size'] ?? 0));
        $partnerCount = max(1, (int) ($responses['partner_count'] ?? 1));
        $assetProtection = $responses['asset_protection'] ?? 'medium';
        $familyOwned = (bool) ($responses['family_owned'] ?? false);
        $international = (bool) ($responses['international_trade'] ?? false);
        $ipStrategy = (bool) ($responses['ip_strategy'] ?? false);

        if ($assetProtection === 'high' || $familyOwned) {
            return $this->trustStructure();
        }

        if (
            $teamSize >= 5
            || $hiring
            || $investment
            || $revenue >= 200000
            || $complexity === 'high'
            || $international
            || $ipStrategy
        ) {
            return $this->companyStructure();
        }

        if (
            $partnerCount >= 2
            && ! $investment
            && ! $international
            && $teamSize <= 4
            && $revenue < 200000
        ) {
            return $this->partnershipStructure();
        }

        if (! $hiring && ! $investment && $revenue < 75000 && $teamSize <= 2) {
            return $this->soleTraderStructure();
        }

        return $this->companyStructure();
    }

    /**
     * @return (int|string|string[])[]
     *
     * @psalm-return array{type: 'Sole Trader', confidence: 92, pros: list{'Simplest structure with minimal registrations', 'Fast to start trading and testing offers', 'All profits flow directly to the founder', 'Straightforward record keeping and BAS lodgements'}, cons: list{'Unlimited personal liability for debts', 'Harder to raise external capital', 'Higher marginal tax rates at scale', 'Limited pathways to add co-founders'}, tax: 'Income taxed at your personal marginal rates up to 45%', cost: '$0 – $500 (ABN + business name)'}
     */
    private function soleTraderStructure(): array
    {
        return [
            'type' => 'Sole Trader',
            'confidence' => 92,
            'pros' => [
                'Simplest structure with minimal registrations',
                'Fast to start trading and testing offers',
                'All profits flow directly to the founder',
                'Straightforward record keeping and BAS lodgements',
            ],
            'cons' => [
                'Unlimited personal liability for debts',
                'Harder to raise external capital',
                'Higher marginal tax rates at scale',
                'Limited pathways to add co-founders',
            ],
            'tax' => 'Income taxed at your personal marginal rates up to 45%',
            'cost' => '$0 – $500 (ABN + business name)',
        ];
    }

    /**
     * @return (int|string|string[])[]
     *
     * @psalm-return array{type: 'Partnership', confidence: 78, pros: list{'Shared workload and complementary founder skills', 'Each partner pays tax based on their marginal rate', 'Low cost setup with flexible profit splits'}, cons: list{'Joint liability exposes all partners to risk', 'Requires strong partnership agreement updates', 'More complex when introducing or exiting partners'}, tax: 'Profits distributed to partners and taxed individually', cost: '$300 – $900 (agreements + registrations)'}
     */
    private function partnershipStructure(): array
    {
        return [
            'type' => 'Partnership',
            'confidence' => 78,
            'pros' => [
                'Shared workload and complementary founder skills',
                'Each partner pays tax based on their marginal rate',
                'Low cost setup with flexible profit splits',
            ],
            'cons' => [
                'Joint liability exposes all partners to risk',
                'Requires strong partnership agreement updates',
                'More complex when introducing or exiting partners',
            ],
            'tax' => 'Profits distributed to partners and taxed individually',
            'cost' => '$300 – $900 (agreements + registrations)',
        ];
    }

    /**
     * @return (int|string|string[])[]
     *
     * @psalm-return array{type: 'Company (Pty Ltd)', confidence: 88, pros: list{'Limited liability when directors follow duties', 'Attractive to investors and grant programs', 'Company tax rate (25% for base-rate entities)', 'Supports multiple share classes and ESOPs'}, cons: list{'Higher setup + ongoing ASIC compliance costs', 'Requires payroll, minutes, and director governance', 'Profits trapped unless paid via wages or dividends'}, tax: 'Company tax rate: 25% (base rate) or 30% standard', cost: '$1k – $3k setup + ASIC annual review'}
     */
    private function companyStructure(): array
    {
        return [
            'type' => 'Company (Pty Ltd)',
            'confidence' => 88,
            'pros' => [
                'Limited liability when directors follow duties',
                'Attractive to investors and grant programs',
                'Company tax rate (25% for base-rate entities)',
                'Supports multiple share classes and ESOPs',
            ],
            'cons' => [
                'Higher setup + ongoing ASIC compliance costs',
                'Requires payroll, minutes, and director governance',
                'Profits trapped unless paid via wages or dividends',
            ],
            'tax' => 'Company tax rate: 25% (base rate) or 30% standard',
            'cost' => '$1k – $3k setup + ASIC annual review',
        ];
    }

    /**
     * @return (int|string|string[])[]
     *
     * @psalm-return array{type: 'Discretionary Trust', confidence: 70, pros: list{'Income streaming flexibility across beneficiaries', 'Strong asset protection when using a corporate trustee', 'Common for holding IP, real estate, or franchise assets'}, cons: list{'High setup and advisory overheads', 'Complex record keeping and annual distribution minutes', 'Banks often require personal guarantees regardless'}, tax: 'Beneficiaries taxed at marginal rates; undistributed income at top rate + penalty', cost: '$1.5k – $4k including corporate trustee'}
     */
    private function trustStructure(): array
    {
        return [
            'type' => 'Discretionary Trust',
            'confidence' => 70,
            'pros' => [
                'Income streaming flexibility across beneficiaries',
                'Strong asset protection when using a corporate trustee',
                'Common for holding IP, real estate, or franchise assets',
            ],
            'cons' => [
                'High setup and advisory overheads',
                'Complex record keeping and annual distribution minutes',
                'Banks often require personal guarantees regardless',
            ],
            'tax' => 'Beneficiaries taxed at marginal rates; undistributed income at top rate + penalty',
            'cost' => '$1.5k – $4k including corporate trustee',
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: string, 2?: string, 3?: string}
     */
    private function getNextSteps(string $structure): array
    {
        return match ($structure) {
            'Sole Trader' => [
                'Apply for an ABN and register a business name',
                'Open a dedicated business bank account',
                'Track GST turnover and register once above $75k',
                'Ring-fence deductible expenses inside your cashbook',
            ],
            'Partnership' => [
                'Draft and sign a detailed partnership agreement',
                'Apply for a partnership TFN and ABN',
                'Agree on drawings, capital contributions, and dispute steps',
                'Align bookkeeping categories for each partner share',
            ],
            'Company (Pty Ltd)' => [
                'Incorporate with ASIC and obtain an ACN',
                'Adopt a constitution + shareholder agreement',
                'Set up payroll, super, and director meeting cadence',
                'Register for GST, PAYG, and business bank accounts',
            ],
            'Discretionary Trust' => [
                'Engage a lawyer to draft or review the trust deed',
                'Appoint a corporate trustee and open trust bank accounts',
                'Document distribution minutes before 30 June each year',
                'Confirm GST and BAS responsibilities for the trustee',
            ],
            default => ['Consult with a licensed accountant and commercial lawyer'],
        };
    }

    /**
     * @param array<string, mixed>  $responses
     *
     * @return string[][]
     *
     * @psalm-return list{0: array{label: string, detail: string}, 1: array{label: string, detail: string}, 2?: array{label: 'Registration fee rebates', detail: 'NSW, VIC, and QLD small business programs routinely refund ASIC formation + name fees once you lodge receipts with payroll data.'}}
     */
    private function benefitCallouts(string $structure, array $responses): array
    {
        return match ($structure) {
            'Company (Pty Ltd)' => [
                [
                    'label' => 'Limited liability shield',
                    'detail' => 'Company assets stay ring-fenced from personal property when directors minute solvency tests and follow ASIC duties.',
                ],
                [
                    'label' => 'Safe harbour runway',
                    'detail' => 'Voluntary administration and safe harbour laws create a buffer before bankruptcy so you can restructure payroll and debt plans.',
                ],
                [
                    'label' => 'Registration fee rebates',
                    'detail' => 'NSW, VIC, and QLD small business programs routinely refund ASIC formation + name fees once you lodge receipts with payroll data.',
                ],
            ],
            'Discretionary Trust' => [
                [
                    'label' => 'Income streaming',
                    'detail' => 'Flexibly distribute profits across family members to lower the household tax bill within ATO rules.',
                ],
                [
                    'label' => 'Asset silo',
                    'detail' => 'Holding IP or property in the trust keeps trading risk away from the family balance sheet.',
                ],
            ],
            'Partnership' => [
                [
                    'label' => 'Shared compliance',
                    'detail' => 'Partners can split BAS, banking, and client management so no single founder carries the full load.',
                ],
                [
                    'label' => 'Custom drawings',
                    'detail' => 'Partnership agreements let you adjust drawings or sweat-equity credits without ASIC paperwork.',
                ],
            ],
            default => [
                [
                    'label' => 'Fast to launch',
                    'detail' => 'Use your ABN and bank account immediately while keeping software + licensing costs low.',
                ],
                [
                    'label' => 'Minimal shutdown risk',
                    'detail' => 'If things change you can pivot or wind down without corporate deregistration fees.',
                ],
            ],
        };
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array<int, array{key: string, label: mixed, when_it_shines: mixed, watch_outs: mixed, best_for: mixed}>
     */
    private function buildStructureDeck(): array
    {
        $entities = [
            'sole_trader' => $this->soleTraderStructure(),
            'company' => $this->companyStructure(),
            'partnership' => $this->partnershipStructure(),
            'trust' => $this->trustStructure(),
        ];

        $configEntities = config('business_entities.entities', []);

        return collect($entities)
            ->map(function (array $structure, string $key) use ($configEntities) {
                $bestFor = data_get($configEntities, $key.'.best_for', []);

                return [
                    'key' => $key,
                    'label' => $structure['type'],
                    'when_it_shines' => $structure['pros'],
                    'watch_outs' => $structure['cons'],
                    'best_for' => $bestFor,
                ];
            })
            ->values()
            ->all();
    }
}

