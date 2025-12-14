<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MortgageRateSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class MortgageSnapshotIngestionService
{
    /**
     * @return (CarbonImmutable|int|string)[]
     *
     * @psalm-return array{region: string, total: int<0, max>, created: int<0, max>, updated: int<0, max>, captured_at: CarbonImmutable}
     */
    public function refreshForRegion(string $region = 'AU', ?int $targetRecords = null): array
    {
        $templates = Collection::make($this->baselineTemplates($region));

        if ($targetRecords !== null) {
            $templates = $templates->take($targetRecords);
        }

        $now = CarbonImmutable::now();
        $created = 0;
        $updated = 0;

        foreach ($templates as $template) {
            $payload = $this->applyMarketJitter($template, $now);

            $snapshot = MortgageRateSnapshot::query()->updateOrCreate(
                [
                    'provider' => $payload['provider'],
                    'product_name' => $payload['product_name'],
                    'market_region' => $payload['market_region'],
                ],
                $payload
            );

            $snapshot->wasRecentlyCreated ? $created++ : $updated++;
        }

        return [
            'region' => $region,
            'total' => $created + $updated,
            'created' => $created,
            'updated' => $updated,
            'captured_at' => $now,
        ];
    }

    /**
     * @return (float|int|string|string[])[][]
     *
     * @psalm-return list{0?: array{provider: 'Aurora Mutual', product_name: 'WomenRise Advantage Home Loan', rate_type: 'fixed', term_months: 300, interest_rate: float, comparison_rate: float, apr: float, max_lvr: 90, min_deposit_percent: 10, available_to: 'owner_occupier', market_region: 'AU', feature_flags: list{'women_led_service_team', 'fee_waiver_first_year'}, source: 'womenrise.marketplace.sync'}, 1?: array{provider: 'EquiHome Cooperative', product_name: 'Shared Equity Flexi Split', rate_type: 'split', term_months: 360, interest_rate: float, comparison_rate: float, apr: float, max_lvr: 85, min_deposit_percent: 15, available_to: 'owner_occupier', market_region: 'AU', feature_flags: list{'shared_equity_ready', 'lmi_waiver'}, source: 'womenrise.marketplace.sync'}, 2?: array{provider: 'Nova First Home', product_name: 'First Home Buyer Introductory', rate_type: 'introductory', term_months: 240, interest_rate: float, comparison_rate: float, apr: float, max_lvr: 95, min_deposit_percent: 5, available_to: 'first_home', market_region: 'AU', feature_flags: list{'mentoring_bundle', 'offset_account'}, source: 'womenrise.marketplace.sync'}, 3?: array{provider: 'InvestHer Capital', product_name: 'Women Investors Growth Variable', rate_type: 'variable', term_months: 300, interest_rate: float, comparison_rate: float, apr: float, max_lvr: 80, min_deposit_percent: 20, available_to: 'investor', market_region: 'AU', feature_flags: list{'portfolio_analyser', 'green_home_discount'}, source: 'womenrise.marketplace.sync'}}
     */
    private function baselineTemplates(string $region): array
    {
        if ($region !== 'AU') {
            return [];
        }

        return [
            [
                'provider' => 'Aurora Mutual',
                'product_name' => 'WomenRise Advantage Home Loan',
                'rate_type' => 'fixed',
                'term_months' => 300,
                'interest_rate' => 5.45,
                'comparison_rate' => 5.58,
                'apr' => 5.52,
                'max_lvr' => 90,
                'min_deposit_percent' => 10,
                'available_to' => 'owner_occupier',
                'market_region' => 'AU',
                'feature_flags' => ['women_led_service_team', 'fee_waiver_first_year'],
                'source' => 'womenrise.marketplace.sync',
            ],
            [
                'provider' => 'EquiHome Cooperative',
                'product_name' => 'Shared Equity Flexi Split',
                'rate_type' => 'split',
                'term_months' => 360,
                'interest_rate' => 5.82,
                'comparison_rate' => 5.97,
                'apr' => 5.90,
                'max_lvr' => 85,
                'min_deposit_percent' => 15,
                'available_to' => 'owner_occupier',
                'market_region' => 'AU',
                'feature_flags' => ['shared_equity_ready', 'lmi_waiver'],
                'source' => 'womenrise.marketplace.sync',
            ],
            [
                'provider' => 'Nova First Home',
                'product_name' => 'First Home Buyer Introductory',
                'rate_type' => 'introductory',
                'term_months' => 240,
                'interest_rate' => 4.95,
                'comparison_rate' => 5.31,
                'apr' => 5.13,
                'max_lvr' => 95,
                'min_deposit_percent' => 5,
                'available_to' => 'first_home',
                'market_region' => 'AU',
                'feature_flags' => ['mentoring_bundle', 'offset_account'],
                'source' => 'womenrise.marketplace.sync',
            ],
            [
                'provider' => 'InvestHer Capital',
                'product_name' => 'Women Investors Growth Variable',
                'rate_type' => 'variable',
                'term_months' => 300,
                'interest_rate' => 6.05,
                'comparison_rate' => 6.28,
                'apr' => 6.16,
                'max_lvr' => 80,
                'min_deposit_percent' => 20,
                'available_to' => 'investor',
                'market_region' => 'AU',
                'feature_flags' => ['portfolio_analyser', 'green_home_discount'],
                'source' => 'womenrise.marketplace.sync',
            ],
        ];
    }

    /**
     * @return (CarbonImmutable|float|mixed)[]
     *
     * @psalm-return array{interest_rate: float, comparison_rate: float, apr: float, captured_at: CarbonImmutable,...}
     */
    private function applyMarketJitter(array $template, CarbonImmutable $capturedAt): array
    {
        $interestRate = $this->jitter($template['interest_rate']);
        $comparisonRate = max($interestRate + 0.08, $this->jitter($template['comparison_rate'], 0.2));
        $apr = round(($interestRate + $comparisonRate) / 2, 3);

        return array_merge($template, [
            'interest_rate' => $interestRate,
            'comparison_rate' => round($comparisonRate, 3),
            'apr' => $apr,
            'captured_at' => $capturedAt,
        ]);
    }

    private function jitter(float $base, float $spread = 0.15): float
    {
        $delta = (random_int(-20, 20) / 20) * $spread;
        return round(max(0, $base + $delta), 3);
    }
}

