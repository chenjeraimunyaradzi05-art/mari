<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

final class CandidateNotificationsController extends Controller
{
    /**
     * Display all notifications.
     */
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $candidate = auth()->user()->candidate;

        $notifications = Notification::where('user_id', auth()->id())
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        $unreadCount = $notifications->count() > 0
            ? Notification::where('user_id', auth()->id())->unread()->count()
            : 0;

        return view('frontend.candidate-dashboard.social.notifications', [
            'candidate' => $candidate,
            'notifications' => $notifications,
            'unreadCount' => $unreadCount,
        ]);
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead(Notification $notification): \Illuminate\Http\JsonResponse
    {
        try {
            if ($notification->user_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $notification->markAsRead();

            return response()->json([
                'success' => true,
                'message' => 'Notification marked as read',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(): \Illuminate\Http\JsonResponse
    {
        try {
            Notification::where('user_id', auth()->id())
                ->unread()
                ->update(['read_at' => now()]);

            return response()->json([
                'success' => true,
                'message' => 'All notifications marked as read',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a notification.
     */
    public function destroy(Notification $notification): \Illuminate\Http\JsonResponse
    {
        try {
            if ($notification->user_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $notification->delete();

            return response()->json([
                'success' => true,
                'message' => 'Notification deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
}

