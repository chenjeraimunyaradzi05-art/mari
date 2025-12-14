<?php

namespace App\Services\Security;

use App\Models\SessionExtended;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SessionSecurityService
{
    public function trackSession(Request $request, $user): SessionExtended|null
    {
        if (! ($user instanceof User)) {
            return null;
        }

        $sessionId = (string) $request->session()->getId();
        $agentDetails = $this->resolveAgentDetails($request);
        $location = $this->resolveLocation($request->ip());

        return SessionExtended::query()->updateOrCreate(
            ['id' => $sessionId],
            [
                'user_id' => $user->getKey(),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'device_name' => $agentDetails['device_name'] ?? null,
                'device_type' => $agentDetails['device_type'] ?? null,
                'browser' => $agentDetails['browser'] ?? null,
                'platform' => $agentDetails['platform'] ?? null,
                'location_city' => $location['city'] ?? null,
                'location_country' => $location['country'] ?? null,
                'last_activity' => now(),
            ]
        );
    }

    public function detectSuspiciousActivity($user, Request $request): string|null
    {
        $windowMinutes = (int) config('security.session_security.window_minutes', 60);
        $recentSessions = SessionExtended::query()
            ->where('user_id', $user->getKey())
            ->where('last_activity', '>=', now()->subMinutes(max(1, $windowMinutes)))
            ->orderByDesc('last_activity')
            ->get();

        if ($this->detectCountryDrift($recentSessions)) {
            return 'multiple_countries_detected';
        }

        if ($this->isUnrecognizedDevice($recentSessions, $request)) {
            return 'unrecognized_device';
        }

        return null;
    }

    public function revokeSession(string $sessionId, User $user): void
    {
        SessionExtended::query()
            ->where('id', $sessionId)
            ->where('user_id', $user->getKey())
            ->delete();

        try {
            DB::table('sessions')->where('id', $sessionId)->delete();
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    public function getDeviceFingerprint(Request $request): string
    {
        $details = $this->resolveAgentDetails($request);

        return $this->buildFingerprint(
            $details['device_name'] ?? '',
            $details['platform'] ?? '',
            $details['browser'] ?? ''
        );
    }

    private function detectCountryDrift(Collection $recentSessions): bool
    {
        if (! config('security.session_security.detect_country_hopping', true)) {
            return false;
        }

        $countries = $recentSessions
            ->pluck('location_country')
            ->filter()
            ->unique();

        return $countries->count() > 1;
    }

    private function isUnrecognizedDevice(Collection $sessions, Request $request): bool
    {
        if (! config('security.session_security.detect_new_devices', true)) {
            return false;
        }

        $lookbackDays = (int) config('security.session_security.known_device_days', 30);
        $currentFingerprint = $this->getDeviceFingerprint($request);

        if ($currentFingerprint === '') {
            return false;
        }

        $threshold = now()->subDays(max(1, $lookbackDays));

        $knownFingerprints = $sessions
            ->filter(fn (SessionExtended $session) => $session->last_activity && $session->last_activity->gte($threshold))
            ->map(fn (SessionExtended $session) => $this->buildFingerprint(
                (string) $session->device_name,
                (string) $session->platform,
                (string) $session->browser,
            ))
            ->filter()
            ->unique();

        return $knownFingerprints->isNotEmpty() && ! $knownFingerprints->contains($currentFingerprint);
    }

    /**
     * @return (mixed|null|string)[]
     *
     * @psalm-return array{device_name: mixed|string, device_type: string, browser: mixed|null|string, platform: mixed|null|string}
     */
    private function resolveAgentDetails(Request $request): array
    {
        $userAgent = (string) $request->userAgent();
        $details = [
            'device_name' => null,
            'device_type' => null,
            'browser' => null,
            'platform' => null,
        ];

        $agentClass = 'Jenssegers\\Agent\\Agent';

        if (class_exists($agentClass)) {
            $agent = new $agentClass();
            $agent->setUserAgent($userAgent);

            $details['device_name'] = $agent->device() ?: $agent->platform();
            $details['device_type'] = $agent->isTablet()
                ? 'tablet'
                : ($agent->isMobile() ? 'mobile' : 'desktop');
            $details['browser'] = $agent->browser();
            $details['platform'] = $agent->platform();

            return $details;
        }

        $details['device_type'] = $this->inferDeviceType($userAgent);
        $details['browser'] = $this->inferBrowser($userAgent);
        $details['platform'] = $this->inferPlatform($userAgent);
        $details['device_name'] = $details['platform'] ?: ($details['browser'] ?: 'browser-client');

        return $details;
    }

    /**
     * @return (mixed|null)[]
     *
     * @psalm-return array{city?: mixed|null, country?: mixed|null}
     */
    private function resolveLocation(?string $ip): array
    {
        if (! $ip) {
            return [];
        }

        try {
            if (function_exists('geoip')) {
                $location = geoip($ip);
            } elseif (app()->bound('geoip')) {
                $location = app('geoip')->getLocation($ip);
            } else {
                return [];
            }
        } catch (\Throwable $exception) {
            report($exception);

            return [];
        }

        return [
            'city' => $location->city ?? $location['city'] ?? null,
            'country' => $location->country ?? $location['country'] ?? ($location->iso_code ?? null),
        ];
    }

    private function buildFingerprint(string $deviceName, string $platform, string $browser): string
    {
        $payload = strtolower(trim($deviceName.'|'.$platform.'|'.$browser));

        return $payload === '||' ? '' : $payload;
    }

    private function inferDeviceType(string $userAgent): string
    {
        $ua = strtolower($userAgent);

        return match (true) {
            str_contains($ua, 'tablet') || str_contains($ua, 'ipad') => 'tablet',
            str_contains($ua, 'mobile') || str_contains($ua, 'iphone') || str_contains($ua, 'android') => 'mobile',
            default => 'desktop',
        };
    }

    private function inferBrowser(string $userAgent): string|null
    {
        $ua = strtolower($userAgent);

        return match (true) {
            str_contains($ua, 'edg') => 'edge',
            str_contains($ua, 'chrome') => 'chrome',
            str_contains($ua, 'firefox') => 'firefox',
            str_contains($ua, 'safari') && ! str_contains($ua, 'chrome') => 'safari',
            str_contains($ua, 'opera') || str_contains($ua, 'opr') => 'opera',
            default => null,
        };
    }

    private function inferPlatform(string $userAgent): string|null
    {
        $ua = strtolower($userAgent);

        return match (true) {
            str_contains($ua, 'windows') => 'windows',
            str_contains($ua, 'mac os') || str_contains($ua, 'macintosh') => 'macos',
            str_contains($ua, 'iphone') || str_contains($ua, 'ipad') => 'ios',
            str_contains($ua, 'android') => 'android',
            str_contains($ua, 'linux') => 'linux',
            default => null,
        };
    }
}

