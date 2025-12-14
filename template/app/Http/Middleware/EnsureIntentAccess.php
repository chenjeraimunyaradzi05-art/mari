<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\IntentEvaluator;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureIntentAccess
{

	/**
	 * Ensure the current user satisfies at least one of the provided intent requirements.
	 * Requirements are passed as middleware parameters and may be comma-separated.
	 * Examples:
	 *  - intent:career_growth
	 *  - portal:real_estate
	 *  - intent:wealth_building|community_support,portal:financial_wellbeing
	 */
	public function handle(Request $request, Closure $next, ...$params): Response
	{
		$user = $request->user();

		if (! $user) {
			abort(403);
		}

		$evaluator = IntentEvaluator::for($user);

		if ($evaluator->bypassesChecks()) {
			return $next($request);
		}

		// Merge all middleware params then split on commas to support combined requirements
		$raw = implode(',', $params);

		$requirements = collect(array_filter(array_map('trim', explode(',', $raw))));

		// If no requirements specified, allow through
		if ($requirements->isEmpty()) {
			return $next($request);
		}

		$allowed = $requirements->contains(fn (string $requirement) => $evaluator->allowsRequirement($requirement));

		if ($allowed) {
			return $next($request);
		}

		abort(403);
	}

}

