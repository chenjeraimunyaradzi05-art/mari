<?php
/**
 * AuthenticatedSessionController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Providers\RouteServiceProvider;
use App\Services\Auth\UserLoginAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

final class AuthenticatedSessionController extends Controller
{
    public function __construct(private readonly UserLoginAuditService $loginAuditService)
    {
    }

    /**
     * Display the login view.
     */
    public function create(): View
    {
        return view('auth.login');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();

        if (! $user) {
            return redirect()->intended(RouteServiceProvider::HOME);
        }

        if (! $user->onboarding_completed) {
            return redirect()->route('role-selection.show');
        }

        $this->loginAuditService->record($user, $request, ['source' => 'web']);

        return redirect()->intended($user->preferredDashboardRoute());
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}

