<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRealEstateOnboarded
{
	public function handle(Request $request, Closure $next): mixed
	{
		$user = $request->user();

		// If there's no authenticated user, let other middleware/auth handle it.
		if ($user === null) {
			return $next($request);
		}

		if ($user->real_estate_onboarded_at === null) {
			return response()->json([
				'message' => 'Complete WomenRise real estate onboarding to continue.',
			], Response::HTTP_CONFLICT);
		}

		return $next($request);
	}
}

