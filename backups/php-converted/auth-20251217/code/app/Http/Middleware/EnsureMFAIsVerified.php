<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class EnsureMFAIsVerified
{

	/**
	 * Enforce MFA for users that have a verified MFA method but haven't yet verified in-session.
	 * - Allows dedicated MFA routes through (setup, challenge, backup codes)
	 * - Redirects web requests to the challenge route when MFA is required
	 * - Returns 409 for JSON/API clients
	 */
	public function handle(Request $request, Closure $next): Response
	{
		$user = $request->user();

		if (! $user) {
			return $next($request);
		}

		// Allow some routes while performing signin/verification
		$allowList = [
			'auth.mfa.setup',
			'auth.mfa.setup.store',
			'auth.mfa.backup-codes',
			'auth.mfa.challenge',
			'auth.mfa.challenge.verify',
			'logout',
			'password.confirm',
			'verification.*',
		];

		$routeName = $request->route()?->getName();
		if ($routeName && in_array($routeName, $allowList, true)) {
			return $next($request);
		}

		// Also allow verification/password patterns
		if ($request->routeIs('verification.*') || $request->routeIs('password.*')) {
			return $next($request);
		}

		// If the user model doesn't support MFA methods (e.g., Admins) or
		// the user has no verified MFA methods we don't enforce MFA here.
		if (! method_exists($user, 'mfaMethods') || ! $user->mfaMethods()->where('is_verified', true)->exists()) {
			return $next($request);
		}

		// If the user already passed an MFA check in this session, allow
		if ((bool) $request->session()->get('mfa_verified', false)) {
			return $next($request);
		}

		// Not verified in session — require challenge
		if ($request->expectsJson()) {
			return response()->json(['message' => 'Multi-factor authentication required'], 409);
		}

		return redirect()->route('auth.mfa.challenge');
	}

}

