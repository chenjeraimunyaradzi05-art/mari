<?php
/**
 * PaymentGatewaySettingServiceProvider
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Providers;

use App\Services\PaymentGatewaySettingService;
use Illuminate\Support\ServiceProvider;

final class PaymentGatewaySettingServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    #[\Override]
    public function register(): void
    {
        $this->app->singleton(PaymentGatewaySettingService::class, function(){
            return new PaymentGatewaySettingService();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        try {
            if (! \Illuminate\Support\Facades\Schema::hasTable('payment_settings')) {
                return;
            }

            $paymentGatewaySetting = $this->app->make(PaymentGatewaySettingService::class);
            $paymentGatewaySetting->setGlobalSettings();
        } catch (\Throwable $e) {
            // Don't let missing DB / schema or other bootstrap DB errors break tests or app startup
            // Log at debug level so maintainers can inspect in environments expecting the table.
            if (app()->bound('log')) {
                try {
                    app('log')->debug('PaymentGatewaySettingServiceProvider skipped during boot: ' . $e->getMessage());
                } catch (\Throwable $_) {
                    // ignore logging failures
                }
            }
            return;
        }
    }
}

