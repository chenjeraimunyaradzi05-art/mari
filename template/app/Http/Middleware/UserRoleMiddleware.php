<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class UserRoleMiddleware
{
	/**
	 * Handle an incoming request.
	 *
	 * Accepts comma-separated role names from the middleware parameter and
	 * allows the request to continue if the authenticated user's role,
	 * primary_role or secondary_roles contains any of the required roles.
	 */
	public function handle(Request $request, Closure $next, string ...$roles): Response
	{
		$user = $request->user();

		// If no user (should be behind auth middleware) or no roles specified, deny/allow conservatively
		if (! $user) {
			abort(403);
		}

		// Flatten supplied roles allowing comma-delimited parameter and variadic forms
		$raw = implode(',', $roles);
		$allowedRoles = collect(array_filter(array_map('trim', explode(',', $raw))))->values();

		if ($allowedRoles->isEmpty()) {
			// No specific role requirement — allow through
			return $next($request);
		}

		$userRole = $user->role ?? null;
		$primaryRole = $user->primary_role ?? null;
		$secondaryRoles = collect($user->secondary_roles ?? []);

		$allowed = $allowedRoles->contains(function (string $role) use ($userRole, $primaryRole, $secondaryRoles) {
			return $role === $userRole || $role === $primaryRole || $secondaryRoles->contains($role);
		});

		if ($allowed) {
			return $next($request);
		}

		abort(403);
	}
}

