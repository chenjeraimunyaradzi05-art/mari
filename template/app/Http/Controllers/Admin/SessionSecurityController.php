<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SessionExtended;
use App\Services\Security\SessionSecurityService;
use App\Services\SecurityAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
        $query = SessionExtended::query()->with('user');

        $search = trim((string) $request->input('search', ''));
        $search = $search !== '' ? $search : null;

        $userIdInput = $request->input('user_id');
        $userId = is_numeric($userIdInput) && (int) $userIdInput > 0
            ? (int) $userIdInput
            : null;

        if ($userId) {
            $query->where('user_id', $userId);
        }

        if ($search) {
            $query->where(function ($builder) use ($search) {
                $builder->where('ip_address', 'like', "%{$search}%")
                    ->orWhere('browser', 'like', "%{$search}%")
                    ->orWhere('device_name', 'like', "%{$search}%")
                    ->orWhere('device_type', 'like', "%{$search}%")
                    ->orWhere('platform', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($relation) use ($search) {
                        $relation->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $sessions = $query
            ->orderByDesc('last_activity')
            ->paginate(25)
            ->withQueryString();

        return view('admin.security.sessions', [
            'sessions' => $sessions,
            'filters' => [
                'search' => $search,
                'user_id' => $userId,
            ],
            'metrics' => [
                'active_sessions' => SessionExtended::count(),
                'unique_users' => SessionExtended::query()->distinct()->count('user_id'),
                'last_activity' => optional($sessions->first()?->last_activity)?->diffForHumans() ?? 'N/A',
            ],
        ]);
    }

    public function destroy(SessionExtended $session): RedirectResponse
    {
        $user = $session->user;

        if ($user) {
            $this->sessionSecurity->revokeSession($session->getKey(), $user);

            $this->auditService->log('session.revoked.admin', [
                'user' => $user,
                'severity' => 'warning',
                'resource_type' => 'session',
                'resource_id' => $session->getKey(),
                'metadata' => [
                    'acted_by_admin_id' => auth()->guard('admin')->id(),
                    'reason' => 'manual_revoke',
                ],
            ]);
        } else {
            $session->delete();
        }

        return back()->with('success', 'Session revoked successfully.');
    }
}

