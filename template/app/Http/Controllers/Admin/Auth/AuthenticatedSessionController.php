<?php
/**
 * AuthenticatedSessionController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Admin\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Models\Admin;
use App\Providers\RouteServiceProvider;
use App\Services\Auth\Auth0AdminService;
use App\Services\Auth\UserLoginAuditService;
use App\Services\Auth\AdminLoginAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class AuthenticatedSessionController extends Controller
{
    public function __construct(
        private readonly UserLoginAuditService $loginAuditService,
        private readonly AdminLoginAuditService $adminLoginAuditService,
        private readonly Auth0AdminService $auth0AdminService
    )
    {
    }

    /**
     * Display the login view.
     */
    public function create(): View
    {
        return view('admin.auth.login');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {

        $request->authenticate('admin');

        $request->session()->regenerate();

        $adminUser = $request->user('admin');

        // Record sign-ins: we keep the existing user login audit for User models
        // and write an info log for Admins (admins use a separate model/table for
        // accounts). This prevents type mismatches while still giving visibility
        // into admin sign-ins for debugging.
        if ($adminUser instanceof User) {
            $this->loginAuditService->record($adminUser, $request, ['source' => 'admin']);
        } elseif ($adminUser instanceof Admin) {
            // Persist an admin login audit row so admin sign-ins are available in DB.
            $this->adminLoginAuditService->record($adminUser, $request, ['source' => 'admin']);
        }

        // Avoid honoring a non-admin intended URL (e.g. '/login') — if the
        // stored intended path isn't under '/admin' then clear it so we
        // fall back to the admin dashboard default.
        $intended = $request->session()->get('url.intended');

        if ($intended !== null) {
            $path = parse_url($intended, PHP_URL_PATH) ?: '';

            if (! Str::startsWith($path, '/admin')) {
                $request->session()->forget('url.intended');
            }
        }

        return redirect()->intended(RouteServiceProvider::ADMIN_DASHBOARD);

    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $logoutUrl = null;

        try {
            $logoutUrl = $this->auth0AdminService->logout($request);
        } catch (\Throwable) {
            // Swallow and fall back to local logout if Auth0 is not configured yet.
        }

        Auth::guard('admin')->logout();

        return $logoutUrl ? redirect()->away($logoutUrl) : redirect()->route('admin.mutiro.login');
    }
}

