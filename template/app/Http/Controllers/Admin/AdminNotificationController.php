<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdminNotificationController extends Controller
{
    public function index(Request $request): View
    {
        $notifications = $request->user('admin')
            ->notifications()
            ->latest()
            ->paginate(25);

        return view('admin.notifications.index', compact('notifications'));
    }

    public function markRead(Request $request, AdminNotification $notification): RedirectResponse
    {
        $this->ensureOwnership($request, $notification);

        $notification->markAsRead();

        return back()->with('status', 'Notification marked as read.');
    }

    public function destroy(Request $request, AdminNotification $notification): RedirectResponse
    {
        $this->ensureOwnership($request, $notification);

        $notification->delete();

        return back()->with('status', 'Notification removed.');
    }

    private function ensureOwnership(Request $request, AdminNotification $notification): void
    {
        abort_unless($notification->admin_id === $request->user('admin')?->id, 403);
    }
}

