<?php
namespace App\Http\Controllers;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class NotificationController extends Controller {
    public function index(): \Illuminate\Contracts\View\View {
        $notifications = Notification::where('user_id', Auth::id())->latest()->get();
        return view('notifications.index', compact('notifications'));
    }

    public function markRead($id): \Illuminate\Http\RedirectResponse {
        $notification = Notification::findOrFail($id);
        abort_if($notification->user_id !== Auth::id(), 403);

        $notification->update(['read_at' => now()]);

        return redirect()->back()->with('success', 'Notification marked as read!');
    }

    public function destroy($id): \Illuminate\Http\RedirectResponse {
        $notification = Notification::findOrFail($id);
        abort_if($notification->user_id !== Auth::id(), 403);

        $notification->delete();

        return redirect()->back()->with('success', 'Notification deleted!');
    }
}

