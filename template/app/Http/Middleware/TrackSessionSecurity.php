<?php

namespace App\Http\Middleware;

use App\Services\Security\SessionSecurityService;
use App\Services\SecurityAuditService;
use Closure;
use Illuminate\Http\Request;

final class TrackSessionSecurity
{
	/**
	 * Track session activity and raise an audit event for suspicious activity.
	 */
	public function handle(Request $request, Closure $next)
	{
		try {
			$user = $request->user();
			$sessionService = app(SessionSecurityService::class);
			$audit = app(SecurityAuditService::class);

			// Record/refresh session details
			$session = $sessionService->trackSession($request, $user);

			// Check for suspicious session patterns and log if found
			if ($user && $reason = $sessionService->detectSuspiciousActivity($user, $request)) {
				$audit->log('session.suspicious', [
					'user' => $user,
					'request' => $request,
					'severity' => 'warning',
					'metadata' => ['reason' => $reason],
				]);

				// Provide a lightweight flag in session for UI or tests
				if ($request->hasSession()) {
					$request->session()->put('session_security.suspicious', $reason);
				}
			}
		} catch (\Throwable $e) {
			report($e);
		}

		return $next($request);
	}
}

