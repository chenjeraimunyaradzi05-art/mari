<?php

namespace App\Services\Business;

use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class FormationStudioService
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function entities(): array
    {
        return config('business_entities.entities', []);
    }

    /**
     * @return (mixed|string|string[])[][]
     *
     * @psalm-return array<int, array{slug: string, label: mixed|string, path: mixed|string, jurisdiction: 'AU'|mixed, complexity: 'Medium'|mixed, updated_at: string, timeframes: list{'weekly', 'monthly', 'quarterly', 'yearly'}|mixed, entities: array<never, never>|mixed, prerequisites: array<never, never>|mixed}>
     */
    public function templates(): array
    {
        $disk = Storage::disk('local');
        $directory = 'templates/business';

        $configTemplates = collect(config('business_entities.templates', []))
            ->mapWithKeys(/**
             * @return (mixed|string)[][]
             *
             * @psalm-return array<array{path: mixed|string,...}>
             */
            function (array $template) use ($directory): array {
                $slug = $template['slug']
                    ?? pathinfo($template['path'] ?? '', PATHINFO_FILENAME)
                    ?? Str::slug($template['label'] ?? 'template');

                $template['path'] = $template['path'] ?? $directory.'/'.$slug.'.md';

                return [$slug => $template];
            });

        $diskTemplates = collect();

        if (config('business_entities.scan_disk_templates', true)) {
            $diskTemplates = collect($disk->files($directory))
                ->filter(fn (string $path) => Str::endsWith($path, ['.md', '.docx', '.pdf', '.txt']))
                ->mapWithKeys(/**
                 * @return (string|string[])[][]
                 *
                 * @psalm-return array<string, array{slug: string, label: string, path: string, jurisdiction: 'AU', complexity: 'Medium', updated_at: string, timeframes: list{'weekly', 'monthly', 'quarterly', 'yearly'}, entities: array<never, never>, prerequisites: array<never, never>}>
                 */
                function (string $path) use ($disk, $configTemplates): array {
                    $slug = pathinfo($path, PATHINFO_FILENAME);

                    if ($configTemplates->has($slug)) {
                        return [];
                    }

                    $timestamp = Carbon::createFromTimestamp($disk->lastModified($path));

                    return [$slug => [
                        'slug' => $slug,
                        'label' => Str::headline(str_replace('-', ' ', $slug)),
                        'path' => $path,
                        'jurisdiction' => 'AU',
                        'complexity' => 'Medium',
                        'updated_at' => $timestamp->toDateString(),
                        'timeframes' => ['weekly', 'monthly', 'quarterly', 'yearly'],
                        'entities' => [],
                        'prerequisites' => [],
                    ]];
                });
        }

        $normalizedConfigs = $configTemplates->map(/**
         * @return (mixed|string|string[])[]
         *
         * @psalm-return array{slug: string, label: mixed|string, path: mixed|string, jurisdiction: 'AU'|mixed, complexity: 'Medium'|mixed, updated_at: string, timeframes: list{'weekly', 'monthly', 'quarterly', 'yearly'}|mixed, entities: array<never, never>|mixed, prerequisites: array<never, never>|mixed}
         */
        function (array $template, string $slug) use ($disk): array {
            $path = $template['path'];
            $updatedAt = data_get($template, 'updated_at');
            $timestamp = $updatedAt
                ? Carbon::parse($updatedAt)
                : ($disk->exists($path)
                    ? Carbon::createFromTimestamp($disk->lastModified($path))
                    : now());

            return [
                'slug' => $slug,
                'label' => $template['label'] ?? Str::headline(str_replace('-', ' ', $slug)),
                'path' => $path,
                'jurisdiction' => $template['jurisdiction'] ?? 'AU',
                'complexity' => $template['complexity'] ?? 'Medium',
                'updated_at' => $timestamp->toDateString(),
                'timeframes' => $template['timeframes'] ?? ['weekly', 'monthly', 'quarterly', 'yearly'],
                'entities' => $template['entities'] ?? [],
                'prerequisites' => $template['prerequisites'] ?? [],
            ];
        });

        return $normalizedConfigs
            ->merge($diskTemplates)
            ->values()
            ->all();
    }

    public function disclaimer(): string
    {
        return (string) config('business_entities.disclaimer');
    }

    /**
     * Count available templates per timeframe, optionally scoped to an entity key.
     *
     * Returns an associative array with keys weekly, monthly, quarterly, yearly.
     *
     * @return array<string,int>
     */
    public function templateAvailability(?string $entity = null): array
    {
        $timeframes = ['weekly', 'monthly', 'quarterly', 'yearly'];

        $counts = array_fill_keys($timeframes, 0);

        foreach ($this->templates() as $template) {
            $entities = $template['entities'] ?? [];

            // If the template declares entities, only include if the requested
            // entity is present. If no entity is requested, include all templates.
            if ($entity !== null && ! empty($entities) && ! in_array($entity, $entities, true)) {
                continue;
            }

            $templateTimeframes = $template['timeframes'] ?? [];

            foreach ($timeframes as $tf) {
                if (in_array($tf, $templateTimeframes, true)) {
                    $counts[$tf]++;
                }
            }
        }

        return $counts;
    }

    /**
     * @param array<string, mixed> $answers
     *
     * @return (int|string[][])[]
     *
     * @psalm-return array{score: int<0, 100>, signals: list{0?: array{label: string, detail: string},...}}
     */
    private function scoreEntity(string $entityKey, array $answers): array
    {
        $score = 50;
        $signals = [];
        $hiring = filter_var($answers['hiring'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $investment = filter_var($answers['external_investment'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $revenue = (float) ($answers['annual_revenue'] ?? 0);

        $entityAdjustments = [
            'sole_trader' => function () use (&$score, &$signals, $hiring, $investment, $revenue): void {
                if ($revenue > 200000) {
                    $score -= 15;
                    $signals[] = ['label' => 'Revenue pressure', 'detail' => 'Consider a company to cap tax once profits surge.'];
                }
                if ($hiring || $investment) {
                    $score -= 20;
                    $signals[] = ['label' => 'Team ready', 'detail' => 'Hiring or raising capital is easier via a company structure.'];
                }
            },
            'company' => function () use (&$score, &$signals, $hiring, $investment): void {
                if ($hiring || $investment) {
                    $score += 15;
                    $signals[] = ['label' => 'Investor friendly', 'detail' => 'Company limited shares make onboarding investors straightforward.'];
                }
            },
            'partnership' => function () use (&$score, &$signals, $answers): void {
                $partners = (int) ($answers['partner_count'] ?? 2);
                if ($partners < 2) {
                    $score -= 10;
                    $signals[] = ['label' => 'Missing partner', 'detail' => 'Partnership needs at least two active partners.'];
                }
            },
            'trust' => function () use (&$score, &$signals, $answers): void {
                $family = filter_var($answers['family_owned'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if ($family) {
                    $score += 10;
                    $signals[] = ['label' => 'Family leverage', 'detail' => 'Trusts shine when distributing income across family members.'];
                }
            },
        ];

        if (isset($entityAdjustments[$entityKey])) {
            $entityAdjustments[$entityKey]();
        }

        $score = (int) max(0, min(100, $score));

        return [
            'score' => $score,
            'signals' => $signals,
        ];
    }

    /**
     * @param array<string, mixed> $entity
     * @param array<string, mixed> $answers
     * @return array<string, string>
     */
    private function buildGstGuidance(array $entity, array $answers): array
    {
        $gstRegistered = filter_var($answers['gst_registered'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $method = $answers['accounting_method'] ?? 'cash';

        return [
            'treatment' => Arr::get($entity, 'gst.treatment', 'Register once turnover exceeds $75k.'),
            'reporting' => Arr::get($entity, 'gst.reporting', 'Quarterly BAS.'),
            'method' => Arr::get($entity, 'gst.method'),
            'status' => $gstRegistered ? 'Currently registered for GST.' : 'Not yet registered – monitor turnover for the $75k threshold.',
            'clearing_entry' => $this->gstClearingNarrative($method),
        ];
    }

    private function gstClearingNarrative(string $method): string
    {
        $mode = $method === 'accrual'
            ? 'accrual basis (recognise GST when invoices are issued)'
            : 'cash basis (recognise GST when money settles)';

        return sprintf(
            'Use a GST clearing account on %s. Each BAS lodgement closes the clearing account (Dr/Cr GST Clearing, offset to Bank or ATO).',
            $mode
        );
    }

    /**
     * Analyze an entity against a set of questionnaire answers and return
     * a compact advice payload used by the UI.
     *
     * @return array<string, mixed>
     */
    public function analyse(string $entityKey, array $answers): array
    {
        $scoreResult = $this->scoreEntity($entityKey, $answers);

        // Derive a human-friendly recommended structure name based on answers
        $recommended = 'Sole Trader';

        $hiring = filter_var($answers['hiring'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $externalInvestment = filter_var($answers['external_investment'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $annualRevenue = (float) ($answers['annual_revenue'] ?? 0);
        $assetProtection = $answers['asset_protection'] ?? null;
        $teamSize = (int) ($answers['team_size'] ?? 1);
        $partnerCount = (int) ($answers['partner_count'] ?? 1);

        if ($hiring || $externalInvestment || $annualRevenue > 200000) {
            $recommended = 'Company (Pty Ltd)';
        } elseif ($assetProtection === 'high') {
            $recommended = 'Discretionary Trust';
        } elseif ($teamSize >= 2 && $partnerCount >= 2) {
            $recommended = 'Partnership';
        }

        $signals = $scoreResult['signals'] ?? [];

        return [
            'recommended_structure' => $recommended,
            'confidence_score' => $scoreResult['score'] ?? 50,
            'summary' => sprintf('Suggested: %s (score %d)', $recommended, $scoreResult['score'] ?? 50),
            'setup_cost' => '$0',
            'tax_implications' => 'Informational only – consult your accountant.',
            'structure_deck' => [
                ['label' => 'When it shines', 'content' => $signals[0]['detail'] ?? 'Strong for small teams.'],
                ['label' => 'Watch-outs', 'content' => $signals[0]['label'] ?? 'Consider liabilities.'],
                ['label' => 'Best for: Freelancers', 'content' => 'Quick to set up and minimal admin.'],
            ],
        ];
    }

    /**
     * Return a map of AI draft prompts used by the formation studio UI.
     * Each entry contains a human-friendly label and a template prompt string.
     *
     * @return array<string, array<string,string>>
     */
    public function aiPrompts(): array
    {
        // Provide a small set of prompts sufficient for tests and UI rendering.
        return [
            'founders_agreement' => [
                'label' => 'Founders agreement',
                'prompt' => 'Draft a short founders agreement suitable for Company (Pty Ltd) focusing on equity split, roles and dispute resolution.',
            ],
            'bas_summary' => [
                'label' => 'BAS summary',
                'prompt' => 'Provide an informational BAS summary for Company (Pty Ltd). Informational only – confirm with your accountant.',
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{label: string, detail: string}, 1?: array{label: 'Superannuation', detail: 'Voluntary super payments keep retirement savings on track.'}}
     */
    private function buildRiskNotes(string $entityKey, array $answers): array
    {
        $notes = [
            'sole_trader' => [
                ['label' => 'Personal liability', 'detail' => 'Insurance + proper contracts are essential.'],
                ['label' => 'Superannuation', 'detail' => 'Voluntary super payments keep retirement savings on track.'],
            ],
            'company' => [
                ['label' => 'Director duties', 'detail' => 'Keep minutes + solvency resolutions to avoid breaches.'],
            ],
            'partnership' => [
                ['label' => 'Joint liability', 'detail' => 'One partner’s debt can affect all partners.'],
            ],
            'trust' => [
                ['label' => 'Distribution minutes', 'detail' => 'Minutes must be signed before 30 June.'],
            ],
        ];

        return $notes[$entityKey] ?? [];
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: string, 2?: string}
     */
    private function suggestNextSteps(string $entityKey): array
    {
        return match ($entityKey) {
            'sole_trader' => [
                'Apply for an ABN + register a business name.',
                'Connect bank feeds + GST-ready bookkeeping software.',
                'Track deductible expenses and update quarterly cashflow goals.',
            ],
            'company' => [
                'Prepare ASIC Form 201 + choose directors/shareholders.',
                'Draft constitution + shareholders agreement (lawyer review).',
                'Register for GST/PAYG and set up a GST clearing journal template.',
            ],
            'partnership' => [
                'Write (and update) a partnership agreement covering exit clauses.',
                'Nominate a partner to lodge BAS + common ledger codes.',
                'Document drawings policy + dispute mediation steps.',
            ],
            'trust' => [
                'Sign a tailored trust deed + consider a corporate trustee.',
                'Open trust bank accounts + obtain TFN/ABN.',
                'Plan beneficiary distributions + keep minutes each year.',
            ],
            default => ['Capture advice from an accountant or business lawyer.'],
        };
    }
}

