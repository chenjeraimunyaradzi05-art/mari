<?php

namespace App\Services\Growth;

use App\Models\MarketingAttribution;
use App\Models\User;
use Illuminate\Http\Request;

final class MarketingAttributionService
{
    public function captureAttribution(Request $request, $user = null): void
    {
        // Capture Referral Code
        if ($request->has('ref')) {
            session()->put('referral_code', $request->get('ref'));
        }

        // Only capture if UTM parameters are present to avoid spamming DB/Session with internal navigation
        if (!$request->hasAny(['utm_source', 'utm_medium', 'utm_campaign'])) {
            return;
        }

        $data = [
            'utm_source' => $request->get('utm_source'),
            'utm_medium' => $request->get('utm_medium'),
            'utm_campaign' => $request->get('utm_campaign'),
            'utm_term' => $request->get('utm_term'),
            'utm_content' => $request->get('utm_content'),
            'referrer_url' => $request->header('referer'),
            'landing_page' => $request->url(),
            'device_type' => $this->getDeviceType($request),
            'browser' => $this->getBrowser($request),
            'country_code' => $this->getCountryCode($request),
            'first_visit_at' => now(),
        ];

        if ($user instanceof User) {
            $data['user_id'] = $user->id;
            $data['conversion_at'] = now();
        }

        // Store in session for later attribution on signup
        session()->put('marketing_attribution', $data);

        // If user is authenticated, save immediately
        if ($user instanceof User) {
            MarketingAttribution::create($data);
        }
    }

    public function attributeConversion(User $user): void
    {
        $attribution = session()->get('marketing_attribution');

        if ($attribution) {
            MarketingAttribution::create(array_merge($attribution, [
                'user_id' => $user->id,
                'conversion_at' => now(),
            ]));

            session()->forget('marketing_attribution');
        }
    }

    private function getDeviceType(Request $request): string
    {
        $userAgent = strtolower($request->userAgent());
        if (str_contains($userAgent, 'mobile')) return 'mobile';
        if (str_contains($userAgent, 'tablet')) return 'tablet';
        return 'desktop';
    }

    private function getBrowser(Request $request): string
    {
        $userAgent = $request->userAgent();
        if (str_contains($userAgent, 'Chrome')) return 'Chrome';
        if (str_contains($userAgent, 'Firefox')) return 'Firefox';
        if (str_contains($userAgent, 'Safari')) return 'Safari';
        if (str_contains($userAgent, 'Edge')) return 'Edge';
        return 'Unknown';
    }

    /**
     * @return null
     */
    private function getCountryCode(Request $request)
    {
        return null;
    }
}

