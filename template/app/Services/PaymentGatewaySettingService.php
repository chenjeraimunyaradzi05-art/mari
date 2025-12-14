<?php

namespace App\Services;

use App\Models\PaymentSetting;
use Cache;

final class PaymentGatewaySettingService {

    function getSettings() {
        return Cache::rememberForever('gatewaySettings', function() {
            return PaymentSetting::pluck('value', 'key')->toArray(); // ['key' => 'value']
        });
    }

    function setGlobalSettings(): void {
        $settings = $this->getSettings();
        config()->set('gatewaySettings', $settings);
    }

    function clearCachedSettings() : void {
        Cache::forget('gatewaySettings');
    }
}

