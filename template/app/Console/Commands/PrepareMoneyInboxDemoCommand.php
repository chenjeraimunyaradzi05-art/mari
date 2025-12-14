<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Money\BundleConcierge\BundleConciergeService;
use App\Services\UserPrimaryPurposeService;
use Illuminate\Console\Command;

final class PrepareMoneyInboxDemoCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'demo:money-inbox
        {--email=bundle-pilot@example.com : Email of the demo member}
        {--name="Bundle Concierge Pilot" : Display name for the demo member}
        {--password=password : Password to assign when creating the member}
        {--primary-purpose=financial_literacy : Primary purpose to stamp on the profile}
        {--currency=AUD : Currency used for concierge projections}
        {--force : Always regenerate the bundle offer}
        {--skip-purpose : Do not update the primary purpose profile}
    ';

    /**
     * The console command description.
     */
    protected $description = 'Prepare a ready-to-demo Money Inbox user with a live bundle concierge offer.';

    /**
     * @return (int|mixed|null|string)[][]
     *
     * @psalm-return array<int, array{category: string, current_monthly_cost: 0|mixed, current_provider: string, preferred_provider: mixed|null}>
     */
    private function defaultCategoryPayload(): array
    {
        return collect(config('bundles.categories', []))
            ->map(function (array $category, string $key) {
                $provider = $category['providers'][0] ?? null;

                return [
                    'category' => $key,
                    'current_monthly_cost' => $category['default_monthly_cost'] ?? 0,
                    'current_provider' => ($category['label'] ?? 'Provider').' (current)',
                    'preferred_provider' => $provider,
                ];
            })
            ->values()
            ->all();
    }
}

