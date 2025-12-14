<?php
/**
 * RedirectIfAuthenticated Middleware
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Middleware;

use App\Providers\RouteServiceProvider;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class RedirectIfAuthenticated
{
	/**
	 * Handle an incoming request.
	 * If the user is already authenticated we redirect them to the configured home.
	 * Supports multiple guards like the framework default.
	 *
	 * @param  \Illuminate\Http\Request  $request
	 * @param  \Closure  $next
	 * @param  mixed  ...$guards
	 */
	public function handle(Request $request, Closure $next, ...$guards): Response
	{
		$guards = empty($guards) ? [null] : $guards;

		foreach ($guards as $guard) {
			if (Auth::guard($guard)->check()) {
				return redirect(RouteServiceProvider::HOME);
			}
		}

		return $next($request);
	}
}

