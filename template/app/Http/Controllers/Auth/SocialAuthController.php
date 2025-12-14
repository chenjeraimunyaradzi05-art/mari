<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Providers\RouteServiceProvider;
use App\Services\Auth\UserLoginAuditService;
use App\Services\SocialAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class SocialAuthController extends Controller
{
	public function __construct(
		private readonly SocialAuthService $socialAuth,
		private readonly UserLoginAuditService $loginAuditService
	) {
	}

	public function redirect(string $provider): RedirectResponse
	{
		return $this->socialAuth->redirectToProvider($provider);
	}

	public function callback(Request $request, string $provider): RedirectResponse|JsonResponse
	{
		try {
			$user = $this->socialAuth->handleCallback($provider);
		} catch (\Throwable $exception) {
			report($exception);

			return redirect()
				->route('login')
				->withErrors(['social' => 'Unable to sign you in with '.$provider.'. Please try again.']);
		}

		Auth::login($user);
		$request->session()->regenerate();

		$this->loginAuditService->record($user, $request, [
			'source' => 'sso-'.$provider,
			'timezone' => $request->input('timezone'),
			'offset_minutes' => $request->input('offset_minutes'),
			'meta' => [
				'provider' => $provider,
				'is_mobile' => $request->boolean('mobile'),
			],
		]);

		if ($request->expectsJson()) {
			$token = $user->createToken('api-token')->plainTextToken;

			return response()->json([
				'success' => true,
				'token' => $token,
				'token_type' => 'Bearer',
				'user' => $user->fresh(),
			]);
		}

		return redirect()->intended(RouteServiceProvider::HOME);
	}
}

