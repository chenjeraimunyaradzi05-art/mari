<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureOnboardingCompleted
{

    /**
     * Enforce the onboarding flow for authenticated web users.
     * - If primary purpose hasn't been completed -> redirect to primary-purpose.show
     * - If primary purpose completed but onboarding not finished -> redirect to role-selection.show
     * - Allow certain routes through (login/verification/password/mfa/etc.)
     * For JSON/API requests we return a 409 response when onboarding is required.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Skip the onboarding checks for admin routes (admins have separate flows)
        // and only apply this middleware to authenticated web users.
        if ($request->is('admin/*')) {
            return $next($request);
        }

        // Only apply for authenticated users — other middleware/auth handlers will handle unauth requests
        if (! $user) {
            return $next($request);
        }

        // Allow a small set of public / onboarding routes through
        if ($this->isAllowedRoute($request)) {
            return $next($request);
        }

        // If the user hasn't completed the primary-purpose step, force them there first
        if (! $user->hasCompletedPrimaryPurpose()) {
            // Allow the primary-purpose routes themselves
            if ($this->isPrimaryPurposeRoute($request)) {
                return $next($request);
            }

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Primary purpose required'], 409);
            }

            return redirect()->route('primary-purpose.show');
        }

        // Primary purpose is complete — ensure the user finished the role-selection onboarding
        if (! $user->onboarding_completed) {
            // If we're already on a role-selection route allow it
            if ($request->route()?->getName() === 'role-selection.show' || $request->routeIs('profile.roles.*')) {
                return $next($request);
            }

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Onboarding required'], 409);
            }

            return redirect()->route('role-selection.show');
        }

        return $next($request);
    }


    private function isAllowedRoute(Request $request): bool
    {
        $route = $request->route();
        $name = $route?->getName();

        $allowList = [
            'role-selection.show',
            'role-selection.store',
            'profile.roles.update',
            'logout',
            'verification.notice',
            'verification.verify',
            'verification.send',
            'password.confirm',
        ];

        if ($name && in_array($name, $allowList, true)) {
            return true;
        }

        if ($request->routeIs('verification.*')) {
            return true;
        }

        if ($request->routeIs('password.*')) {
            return true;
        }

        return false;
    }

    private function isPrimaryPurposeRoute(Request $request): bool
    {
        $name = $request->route()?->getName();

        if (! $name) {
            return false;
        }

        return in_array($name, ['primary-purpose.show', 'primary-purpose.store', 'primary-purpose.telemetry'], true);
    }
}



