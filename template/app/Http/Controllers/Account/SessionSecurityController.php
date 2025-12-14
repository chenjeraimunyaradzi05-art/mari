<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\SessionExtended;
use App\Services\Security\SessionSecurityService;
use App\Services\SecurityAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

final class SessionSecurityController extends Controller
{
    public function __construct(
        private readonly SessionSecurityService $sessionSecurity,
        private readonly SecurityAuditService $auditService,
    ) {
    }

    public function index(Request $request): View
    {
        $user = $request->user();
        $currentSessionId = (string) $request->session()->getId();

        $baseQuery = SessionExtended::query()
            ->where('user_id', $user->getKey());

        $sessions = (clone $baseQuery)
            ->orderByDesc('last_activity')
            ->paginate(10);

        $stats = [
            'total' => (clone $baseQuery)->count(),
            'countries' => (clone $baseQuery)
                ->whereNotNull('location_country')
                ->distinct()
                ->count('location_country'),
            'last_activity' => optional($sessions->first()?->last_activity),
        ];

        $riskState = $request->session()->get('session_security.risk');
        $riskDetectedAt = $riskState['detected_at'] ?? null;

        if ($riskDetectedAt && ! $riskDetectedAt instanceof Carbon) {
            $riskDetectedAt = Carbon::parse($riskDetectedAt);
        }

        $risk = [
            'reason' => $riskState['reason'] ?? null,
            'detected_at' => $riskDetectedAt,
            'label' => $this->describeRisk($riskState['reason'] ?? null),
        ];

        return view('account.security.sessions', [
            'sessions' => $sessions,
            'stats' => $stats,
            'risk' => $risk,
            'currentSessionId' => $currentSessionId,
        ]);
    }

    public function destroy(Request $request, SessionExtended $sessionExtended): RedirectResponse
    {
        $user = $request->user();

        abort_unless($sessionExtended->user_id === $user->getKey(), 403);

        $isCurrentSession = $sessionExtended->getKey() === $request->session()->getId();

        $this->sessionSecurity->revokeSession($sessionExtended->getKey(), $user);

        $this->auditService->log('session.revoked.self', [
            'user' => $user,
            'severity' => $isCurrentSession ? 'warning' : 'info',
            'resource_type' => 'session',
            'resource_id' => $sessionExtended->getKey(),
            'metadata' => [
                'self_initiated' => true,
                'current_device' => $isCurrentSession,
            ],
        ]);

        if ($isCurrentSession) {
            auth()->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('status', 'You signed out of this device. Please sign in again.');
        }

        return back()->with('success', 'Session revoked successfully.');
    }

    private function describeRisk(?string $reason): string|null
    {
        return match ($reason) {
            'multiple_countries_detected' => 'We noticed active sessions from multiple countries within your recent activity window.',
            'unrecognized_device' => 'A new or unrecognized device signed into your account recently.',
            default => null,
        };
    }
}

