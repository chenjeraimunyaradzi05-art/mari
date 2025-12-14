<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CandidateMessagesController extends Controller
{
    /**
     * Display messages (both sent and received).
     */
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        /** @var User $user */
        $user = auth()->user();
        $candidate = $user->candidate;

        $messages = Message::forUser(auth()->id())
            ->with(['sender', 'receiver'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        $unreadCount = $candidate->getUnreadMessagesCount();

        return view('frontend.candidate-dashboard.social.messages', [
            'candidate' => $candidate,
            'messages' => $messages,
            'unreadCount' => $unreadCount,
        ]);
    }

    /**
     * Send a message.
     */
    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $validated = $request->validate([
                'receiver_id' => 'required|exists:users,id|different:sender_id',
                'content' => 'required|string|min:1|max:10000',
                'media' => 'nullable|string|url',
            ]);

            $message = Message::create([
                'sender_id' => auth()->id(),
                'receiver_id' => $validated['receiver_id'],
                'content' => $validated['content'],
                'media' => $validated['media'] ?? null,
                'is_read' => false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Message sent successfully',
                'data' => $message->load(['sender', 'receiver']),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark message as read.
     */
    public function markAsRead(Message $message): \Illuminate\Http\JsonResponse
    {
        try {
            if ($message->receiver_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $message->markAsRead();

            return response()->json([
                'success' => true,
                'message' => 'Message marked as read',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a message.
     */
    public function destroy(Message $message): \Illuminate\Http\JsonResponse
    {
        try {
            if ($message->sender_id !== auth()->id() && $message->receiver_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $message->delete();

            return response()->json([
                'success' => true,
                'message' => 'Message deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }
}

