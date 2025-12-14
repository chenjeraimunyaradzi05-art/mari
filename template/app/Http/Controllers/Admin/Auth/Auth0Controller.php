<?php

namespace App\Http\Controllers\Admin\Auth;

use App\Http\Controllers\Controller;
use App\Providers\RouteServiceProvider;
use App\Services\Auth\Auth0AdminService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class Auth0Controller extends Controller
{
    public function __construct(private readonly Auth0AdminService $auth0)
    {
    }

    public function redirect(Request $request): RedirectResponse
    {
        return $this->auth0->startLogin($request);
    }

    public function challenge(Request $request): RedirectResponse
    {
        return $this->auth0->startMfaChallenge($request);
    }

    public function callback(Request $request): RedirectResponse
    {
        $admin = $this->auth0->handleCallback($request);

        Auth::guard('admin')->login($admin);

        return redirect()->intended(RouteServiceProvider::ADMIN_DASHBOARD);
    }

    public function logout(Request $request): RedirectResponse
    {
        $logoutUrl = $this->auth0->logout($request);

        Auth::guard('admin')->logout();

        return redirect()->away($logoutUrl);
    }
}

