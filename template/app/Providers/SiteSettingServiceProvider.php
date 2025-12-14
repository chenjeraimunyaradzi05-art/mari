<?php
/**
 * SiteSettingServiceProvider
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Providers;

use App\Services\SiteSettingService;
use Illuminate\Support\ServiceProvider;

final class SiteSettingServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    #[\Override]
    public function register(): void
    {
        $this->app->singleton(SiteSettingService::class, function(){
            return new SiteSettingService();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('site_settings')) {
            return;
        }

        $Setting = $this->app->make(SiteSettingService::class);
        $Setting->setGlobalSettings();
    }
}

