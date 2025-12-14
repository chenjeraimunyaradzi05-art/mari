<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class EnsureTwoFactorConfirmed
{


    protected function challenge(Request $request, array $context): RedirectResponse
    {
        $request->session()->flash('auth0.mfa_required', true);
        $request->session()->flash('auth0.mfa_reason', $context['reason'] ?? null);
        $request->session()->flash('auth0.mfa_risk_code', $context['risk_code'] ?? null);

        return redirect()->route('admin.auth0.challenge');
    }

    /**
     * @return (bool|string)[]
     *
     * @psalm-return array{required: bool, reason?: 'global'|'route_policy'|'session_risk', risk_code?: string}
     */
    private function determineContext(Request $request): array
    {
        $config = (array) config('auth0.mfa', []);
        $riskReason = $this->sessionRiskReason($request);

        if ($riskReason && ($config['adaptive']['session_risk'] ?? true)) {
            return [
                'required' => true,
                'reason' => 'session_risk',
                'risk_code' => $riskReason,
            ];
        }

        $routeName = $request->route()?->getName();
        $routes = (array) ($config['routes'] ?? []);

        if ($routeName && $this->routeRequiresMfa($routeName, $routes)) {
            return [
                'required' => true,
                'reason' => 'route_policy',
            ];
        }

        if (! empty($config['enforced'])) {
            return [
                'required' => true,
                'reason' => 'global',
            ];
        }

        return ['required' => false];
    }

    private function hasSatisfiedFactor(Request $request): bool
    {
        $session = (array) $request->session()->get('auth0', []);
        $amr = (array) Arr::get($session, 'amr', []);
        if (in_array('mfa', $amr, true)) {
            return true;
        }

        $admin = $request->user('admin');

        return $admin && method_exists($admin, 'hasVerifiedMfa') && $admin->hasVerifiedMfa();
    }

    private function gracePeriodApplies(Request $request, array $context): bool
    {
        if (($context['reason'] ?? null) !== 'global') {
            return false;
        }

        $graceSeconds = (int) config('auth0.mfa.allowed_grace_seconds', 0);
        if ($graceSeconds <= 0) {
            return false;
        }

        $authTime = Arr::get($request->session()->get('auth0', []), 'auth_time');
        if (! $authTime) {
            return false;
        }

        return now()->lt(Carbon::createFromTimestamp((int) $authTime)->addSeconds($graceSeconds));
    }

    private function routeRequiresMfa(string $routeName, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if (Str::is($pattern, $routeName)) {
                return true;
            }
        }

        return false;
    }

    private function sessionRiskReason(Request $request): ?string
    {
        return $request->attributes->get('session_security.risk_reason')
            ?? $request->session()->get('session_security.risk.reason');
    }
}

