<?php

namespace App\Services\Money\BundleConcierge;

use App\Models\AnalyticsEvent;
use App\Models\BundleOffer;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class BundleConciergeService
{
    public function generateOffer(User $user, array $payload): BundleOffer
    {
        $currency = strtoupper($payload['currency'] ?? 'AUD');
        $lineItems = $this->buildLineItems($payload['categories'] ?? []);
        $summary = $this->aggregate($lineItems);

        return DB::transaction(function () use ($user, $currency, $lineItems, $summary) {
            $offer = BundleOffer::create([
                'user_id' => $user->id,
                'bundle_code' => $this->bundleCode($user->id),
                'status' => $summary['projected_savings_monthly'] > 0 ? 'recommended' : 'draft',
                'currency' => $currency,
                'baseline_monthly_cost' => $summary['baseline'],
                'projected_monthly_cost' => $summary['projected'],
                'projected_savings_monthly' => $summary['projected_savings_monthly'],
                'projected_savings_annual' => $summary['projected_savings_annual'],
                'confidence' => $this->confidenceScore($lineItems->count(), $summary['projected_savings_monthly']),
                'recommendations' => $this->buildRecommendations($lineItems, $summary),
                'impact_projection' => $this->buildImpactProjection($summary),
                'success_tracking' => $this->buildSuccessTracking($lineItems, $summary),
                'negotiation_script' => $this->buildNegotiationScript($lineItems, $summary),
                'referral_code' => $this->primaryReferralCode($lineItems),
                'provider_payload' => $this->buildProviderPayload($lineItems),
            ]);

            $offer->lineItems()->createMany(
                $lineItems->map(fn (array $line) => [
                    'category' => $line['category'],
                    'current_provider' => $line['current_provider'],
                    'current_monthly_cost' => $line['current_monthly_cost'],
                    'suggested_provider' => $line['suggested_provider'],
                    'suggested_monthly_cost' => $line['suggested_monthly_cost'],
                    'projected_savings_monthly' => $line['projected_savings_monthly'],
                    'provider_connector' => $line['provider_connector'],
                    'metadata' => $line['metadata'],
                ])->all()
            );

            $this->recordAnalyticsEvent($offer, $lineItems);

            return $offer->load('lineItems');
        });
    }

    /**
     * @return ((array|mixed)[]|float|mixed|null|string)[]
     *
     * @psalm-return array{bundle_code: 'DEMO-BUNDLE'|null, status: 'draft'|'recommended', currency: string, baseline_monthly_cost: mixed, projected_monthly_cost: mixed, projected_savings_monthly: mixed, projected_savings_annual: mixed, confidence: float, recommendations: array, success_tracking: array, line_items: array<array>}
     */
    public function preview(array $payload, ?User $user = null): array
    {
        $lineItems = $this->buildLineItems($payload['categories'] ?? []);
        $summary = $this->aggregate($lineItems);

        return [
            'bundle_code' => $user ? null : 'DEMO-BUNDLE',
            'status' => $summary['projected_savings_monthly'] > 0 ? 'recommended' : 'draft',
            'currency' => strtoupper($payload['currency'] ?? 'AUD'),
            'baseline_monthly_cost' => $summary['baseline'],
            'projected_monthly_cost' => $summary['projected'],
            'projected_savings_monthly' => $summary['projected_savings_monthly'],
            'projected_savings_annual' => $summary['projected_savings_annual'],
            'confidence' => $this->confidenceScore($lineItems->count(), $summary['projected_savings_monthly']),
            'recommendations' => $this->buildRecommendations($lineItems, $summary),
            'success_tracking' => $this->buildSuccessTracking($lineItems, $summary),
            'line_items' => $lineItems->map(fn (array $line) => $this->formatLineItem($line))->all(),
        ];
    }

    private function buildLineItems(array $rawCategories): Collection
    {
        $categoryConfig = collect(config('bundles.categories', []));
        $providerConfig = config('bundles.providers', []);

        $categories = $this->normaliseCategoryPayload($rawCategories, $categoryConfig->keys());

        $lineItems = $categories->map(/**
         * @param array $item
         */
        function (array $item) use ($categoryConfig, $providerConfig) {
            $categoryKey = $item['category'];
            $descriptor = $categoryConfig->get($categoryKey);

            if (! $descriptor) {
                return null;
            }

            $currentCost = $this->normaliseAmount($item['current_monthly_cost'] ?? $descriptor['default_monthly_cost'] ?? 0);
            $preferredProvider = $item['preferred_provider'] ?? Arr::first($descriptor['providers'] ?? []);
            $providerMeta = $providerConfig[$preferredProvider] ?? null;
            $baseDiscount = (float) ($providerMeta['base_discount_percent'] ?? 0);
            $suggestedCost = $this->applyPercentDiscount($currentCost, $baseDiscount);

            return [
                'category' => $categoryKey,
                'label' => $descriptor['label'] ?? Str::title(str_replace('_', ' ', $categoryKey)),
                'priority' => $descriptor['priority'] ?? 'flex',
                'current_provider' => $item['current_provider'] ?? ($item['provider'] ?? 'Current provider'),
                'current_monthly_cost' => $currentCost,
                'suggested_provider' => $providerMeta['name'] ?? $preferredProvider ?? 'Athena partner',
                'suggested_monthly_cost' => $suggestedCost,
                'projected_savings_monthly' => max(0, round($currentCost - $suggestedCost, 2)),
                'provider_connector' => $preferredProvider,
                'metadata' => [
                    'label' => $descriptor['label'] ?? Str::title(str_replace('_', ' ', $categoryKey)),
                    'discount_percent' => $baseDiscount,
                    'preferred_provider' => $preferredProvider,
                    'negotiation_template' => $providerMeta['negotiation_template'] ?? null,
                ],
            ];
        })->filter()->values();

        return $this->applyStackingBonus($lineItems);
    }

    /**
     * @psalm-return Collection<array-key, array{category: string}>|Collection<int, array{category: mixed, current_monthly_cost: mixed|null, current_provider: mixed|null, preferred_provider: mixed|null}|null>
     */
    private function normaliseCategoryPayload(array $raw, Collection $validKeys): Collection
    {
        $payload = collect($raw)
            ->map(function ($item) use ($validKeys) {
                $category = is_array($item) ? ($item['category'] ?? null) : $item;
                if (! $category || ! $validKeys->contains($category)) {
                    return null;
                }

                return [
                    'category' => $category,
                    'current_monthly_cost' => $item['current_monthly_cost'] ?? null,
                    'current_provider' => $item['current_provider'] ?? null,
                    'preferred_provider' => $item['preferred_provider'] ?? null,
                ];
            })
            ->filter()
            ->values();

        if ($payload->isEmpty()) {
            return $validKeys->map(fn (string $category) => ['category' => $category]);
        }

        return $payload;
    }

    private function applyStackingBonus(Collection $lineItems): Collection
    {
        $threshold = (int) config('bundles.stacking.category_threshold', 3);
        $bonus = (float) config('bundles.stacking.multi_category_bonus_percent', 0);

        if ($lineItems->count() < $threshold || $bonus <= 0) {
            return $lineItems;
        }

        return $lineItems->map(function (array $line) use ($bonus) {
            $adjusted = $this->applyPercentDiscount($line['suggested_monthly_cost'], $bonus);
            $line['metadata']['stacking_bonus_percent'] = $bonus;
            $line['suggested_monthly_cost'] = $adjusted;
            $line['projected_savings_monthly'] = max(0, round($line['current_monthly_cost'] - $adjusted, 2));

            return $line;
        });
    }

    /**
     * @return (float|int)[]
     *
     * @psalm-return array{baseline: float, projected: float, projected_savings_monthly: 0|float, projected_savings_annual: float}
     */
    private function aggregate(Collection $lineItems): array
    {
        $baseline = round($lineItems->sum('current_monthly_cost'), 2);
        $projected = round($lineItems->sum('suggested_monthly_cost'), 2);
        $savingsMonthly = max(0, round($baseline - $projected, 2));

        return [
            'baseline' => $baseline,
            'projected' => $projected,
            'projected_savings_monthly' => $savingsMonthly,
            'projected_savings_annual' => round($savingsMonthly * 12, 2),
        ];
    }

    /**
     * @return ((array|int|string)[]|string)[]
     *
     * @psalm-return array{summary: string, categories: array<int, array{label: mixed, suggested_provider: mixed, savings: mixed}>, callouts: array{category_focus: string, bundle_size: int}}
     */
    private function buildRecommendations(Collection $lineItems, array $summary): array
    {
        $top = $lineItems->sortByDesc('projected_savings_monthly')->take(3);
        $categoryList = $top->pluck('label')->implode(', ');

        return [
            'summary' => sprintf('Rebundle %d services to free %s per month.', $lineItems->count(), $this->formatCurrency($summary['projected_savings_monthly'])),
            'categories' => $top->map(function (array $line) {
                return [
                    'label' => $line['label'],
                    'suggested_provider' => $line['suggested_provider'],
                    'savings' => $line['projected_savings_monthly'],
                ];
            })->values()->all(),
            'callouts' => [
                'category_focus' => $categoryList,
                'bundle_size' => $lineItems->count(),
            ],
        ];
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array{metric: 'bundle_savings_modelled', currency: 'AUD', value: mixed, narrative: 'Projected yearly savings if concierge bundle is activated.'}
     */
    private function buildImpactProjection(array $summary): array
    {
        return [
            'metric' => 'bundle_savings_modelled',
            'currency' => 'AUD',
            'value' => $summary['projected_savings_annual'],
            'narrative' => 'Projected yearly savings if concierge bundle is activated.',
        ];
    }

    /**
     * @return ((mixed|null|string)[][]|string)[]
     *
     * @psalm-return array{tier: 'baseline'|'good'|'great', target_activation_date: string, partner_referrals: array<int, array{provider: mixed, referral_url: mixed|null, referral_code: null|string, category: mixed}>}
     */
    private function buildSuccessTracking(Collection $lineItems, array $summary): array
    {
        $thresholds = config('bundles.success_thresholds');
        $tier = 'baseline';
        if ($summary['projected_savings_annual'] >= ($thresholds['great'] ?? 1200)) {
            $tier = 'great';
        } elseif ($summary['projected_savings_annual'] >= ($thresholds['good'] ?? 600)) {
            $tier = 'good';
        }

        $targetDate = Carbon::now()->addDays(10)->toDateString();

        return [
            'tier' => $tier,
            'target_activation_date' => $targetDate,
            'partner_referrals' => $lineItems->map(function (array $line) {
                $provider = config("bundles.providers.{$line['provider_connector']}");

                return [
                    'provider' => $line['suggested_provider'],
                    'referral_url' => $provider['referral_url'] ?? null,
                    'referral_code' => $this->referralCodeFor($line['provider_connector']),
                    'category' => $line['label'],
                ];
            })->values()->all(),
        ];
    }

    private function buildNegotiationScript(Collection $lineItems, array $summary): string
    {
        if ($lineItems->isEmpty()) {
            return '';
        }

        $top = $lineItems->sortByDesc('projected_savings_monthly')->first();
        $provider = config("bundles.providers.{$top['provider_connector']}", []);
        $template = $provider['negotiation_template'] ?? 'Reference Athena concierge bundle savings of {savings_per_year} per year across {bundle_span} categories.';

        $replacements = [
            '{provider_name}' => $provider['name'] ?? $top['suggested_provider'],
            '{savings_per_month}' => $this->formatCurrency($summary['projected_savings_monthly']),
            '{savings_per_year}' => $this->formatCurrency($summary['projected_savings_annual']),
            '{category_list}' => $lineItems->pluck('label')->implode(', '),
            '{bundle_span}' => $lineItems->count(),
        ];

        $script = str_replace(array_keys($replacements), array_values($replacements), $template);

        return trim($script).PHP_EOL.PHP_EOL.'Athena concierge reference available upon request to honour safety + hardship clauses.';
    }

    /**
     * @return (mixed|null)[][]
     *
     * @psalm-return array<int, array{category: mixed, provider_key: mixed, suggested_provider: mixed, referral_url: mixed|null, discount_percent: mixed|null}>
     */
    private function buildProviderPayload(Collection $lineItems): array
    {
        return $lineItems->map(function (array $line) {
            $provider = config("bundles.providers.{$line['provider_connector']}");

            return [
                'category' => $line['category'],
                'provider_key' => $line['provider_connector'],
                'suggested_provider' => $line['suggested_provider'],
                'referral_url' => $provider['referral_url'] ?? null,
                'discount_percent' => $line['metadata']['discount_percent'] ?? null,
            ];
        })->values()->all();
    }

    /**
     * @psalm-return array{category: mixed, label: mixed, current_provider: mixed, current_monthly_cost: mixed, suggested_provider: mixed, suggested_monthly_cost: mixed, projected_savings_monthly: mixed, metadata: mixed}
     */
    private function formatLineItem(array $line): array
    {
        return [
            'category' => $line['category'],
            'label' => $line['label'],
            'current_provider' => $line['current_provider'],
            'current_monthly_cost' => $line['current_monthly_cost'],
            'suggested_provider' => $line['suggested_provider'],
            'suggested_monthly_cost' => $line['suggested_monthly_cost'],
            'projected_savings_monthly' => $line['projected_savings_monthly'],
            'metadata' => $line['metadata'],
        ];
    }

    private function confidenceScore(int $categoryCount, float $savingsMonthly): float
    {
        $base = 0.45 + min(0.35, $categoryCount * 0.04);
        $savingsBoost = min(0.2, $savingsMonthly / 2000);

        return round(min(0.95, $base + $savingsBoost), 2);
    }

    private function bundleCode(int $userId): string
    {
        return sprintf('BND-%d-%s', $userId, Str::upper(Str::random(5)));
    }

    private function normaliseAmount(mixed $value): float
    {
        if (is_numeric($value)) {
            return round((float) $value, 2);
        }

        if (is_string($value)) {
            $clean = preg_replace('/[^0-9.\-]/', '', $value);

            return $clean === '' ? 0.0 : round((float) $clean, 2);
        }

        return 0.0;
    }

    private function applyPercentDiscount(float $amount, float $percent): float
    {
        return round(max(0, $amount * (1 - ($percent / 100))), 2);
    }

    private function formatCurrency(float $amount): string
    {
        return 'A$'.number_format($amount, 2);
    }

    private function primaryReferralCode(Collection $lineItems): ?string
    {
        $first = $lineItems->first();
        if (! $first || ! $first['provider_connector']) {
            return null;
        }

        return $this->referralCodeFor($first['provider_connector']);
    }

    private function referralCodeFor(?string $providerKey): string|null
    {
        if (! $providerKey) {
            return null;
        }

        $prefix = Arr::get(config("bundles.providers.{$providerKey}"), 'referral_code_prefix');
        if (! $prefix) {
            return null;
        }

        return sprintf('%s-%s', $prefix, Str::upper(Str::random(4)));
    }

    private function recordAnalyticsEvent(BundleOffer $offer, Collection $lineItems): void
    {
        try {
            AnalyticsEvent::create([
                'event' => 'bundle.offer.generated',
                'properties' => [
                    'bundle_id' => $offer->id,
                    'baseline_monthly_cost' => (float) $offer->baseline_monthly_cost,
                    'projected_savings_monthly' => (float) $offer->projected_savings_monthly,
                    'projected_savings_annual' => (float) $offer->projected_savings_annual,
                    'line_item_count' => $lineItems->count(),
                ],
                'metadata' => [
                    'user_id' => $offer->user_id,
                    'bundle_code' => $offer->bundle_code,
                ],
                'source' => 'bundle-concierge',
                'received_at' => now(),
            ]);
        } catch (Throwable) {
            // Intentionally swallow analytics errors so concierge flows do not break.
        }
    }
}

