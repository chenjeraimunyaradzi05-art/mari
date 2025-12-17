<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Security\MFAService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

final class MFAController extends Controller
{
    protected $mfaService;

    public function __construct(MFAService $mfaService)
    {
        $this->mfaService = $mfaService;
    }

    public function showSetup(): \Illuminate\Contracts\View\View
    {
        $user = Auth::user();

        // If already verified, show status or backup codes
        if ($user->mfaMethods()->where('method_type', 'totp')->where('is_verified', true)->exists()) {
            return view('auth.mfa.status');
        }

        $data = $this->mfaService->setupTOTP($user);

        return view('auth.mfa.setup', [
            'qrCode' => $data['qr_code'],
            'secret' => $data['secret'],
        ]);
    }

    public function storeSetup(Request $request): \Illuminate\Contracts\View\View
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $valid = $this->mfaService->verifyTOTP(Auth::user(), $request->code);

        if (!$valid) {
            throw ValidationException::withMessages([
                'code' => ['The provided code is invalid.'],
            ]);
        }

        // Generate and show backup codes
        $codes = $this->mfaService->generateBackupCodes(Auth::user());

        return view('auth.mfa.backup-codes', compact('codes'));
    }

    public function showBackupCodes(): \Illuminate\Http\RedirectResponse
    {
        // This route might not be needed if we only show them once.
        // Or we can have a "Regenerate Backup Codes" feature.
        return redirect()->route('dashboard');
    }

    // Challenge methods will be used by middleware redirection
    public function showChallenge(): \Illuminate\Contracts\View\View
    {
        return view('auth.mfa.challenge');
    }

    public function verifyChallenge(Request $request): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $user = Auth::user(); // User is partially authenticated or we use session to track user id?
        // Usually MFA is done after password login. Laravel session is active.
        // We just need to set a flag in session that MFA is verified.

        if ($this->mfaService->verifyTOTP($user, $request->code)) {
            $request->session()->put('mfa_verified', true);
            return redirect()->intended(route('dashboard'));
        }

        if ($this->mfaService->verifyBackupCode($user, $request->code)) {
            $request->session()->put('mfa_verified', true);
            return redirect()->intended(route('dashboard'));
        }

        throw ValidationException::withMessages([
            'code' => ['The provided code is invalid.'],
        ]);
    }
}

