<?php

namespace App\Support;

use App\Models\Connection;
use App\Models\GroupMember;
use App\Models\Message;
use App\Models\Notification;
use App\Models\User;

final class SocialMetrics
{
    /**
     * Build cached social networking metrics for the authenticated user.
     */
    public static function forUser(?User $user): array
    {
        if (!$user) {
            return self::empty();
        }

        $userId = $user->getKey();

        $connectionsBase = Connection::query()
            ->where(function ($query) use ($userId) {
                $query->where('user_id', $userId)
                    ->orWhere('connected_user_id', $userId);
            });

        $acceptedConnectionsCount = (clone $connectionsBase)->accepted()->count();
        $recentConnections = (clone $connectionsBase)
            ->accepted()
            ->with(['user', 'connectedUser'])
            ->latest()
            ->take(5)
            ->get();

        $pendingInviteCount = Connection::query()
            ->where('connected_user_id', $userId)
            ->pending()
            ->count();

        $blockedCount = Connection::query()
            ->where('user_id', $userId)
            ->blocked()
            ->count();

        $groupMemberships = GroupMember::query()
            ->where('user_id', $userId)
            ->with('group');

        $groupCount = $groupMemberships->count();
        $recentGroups = (clone $groupMemberships)
            ->latest('joined_at')
            ->take(5)
            ->get();

        $unreadMessages = Message::query()
            ->where('receiver_id', $userId)
            ->where('is_read', false)
            ->count();

        $recentMessages = Message::query()
            ->forUser($userId)
            ->with(['sender', 'receiver'])
            ->latest()
            ->take(5)
            ->get();

        $unreadNotifications = Notification::query()
            ->where('user_id', $userId)
            ->unread()
            ->count();

        $recentNotifications = Notification::query()
            ->where('user_id', $userId)
            ->latest()
            ->take(5)
            ->get();

        return [
            'counts' => [
                'connections' => $acceptedConnectionsCount,
                'pendingInvites' => $pendingInviteCount,
                'blocked' => $blockedCount,
                'unreadMessages' => $unreadMessages,
                'groups' => $groupCount,
                'unreadNotifications' => $unreadNotifications,
            ],
            'recent' => [
                'connections' => $recentConnections,
                'groups' => $recentGroups,
                'messages' => $recentMessages,
                'notifications' => $recentNotifications,
            ],
        ];
    }

    /**
     * @return (\Illuminate\Support\Collection|int)[][]
     *
     * @psalm-return array{counts: array{connections: 0, pendingInvites: 0, blocked: 0, unreadMessages: 0, groups: 0, unreadNotifications: 0}, recent: array{connections: \Illuminate\Support\Collection<never, never>, groups: \Illuminate\Support\Collection<never, never>, messages: \Illuminate\Support\Collection<never, never>, notifications: \Illuminate\Support\Collection<never, never>}}
     */
    private static function empty(): array
    {
        return [
            'counts' => [
                'connections' => 0,
                'pendingInvites' => 0,
                'blocked' => 0,
                'unreadMessages' => 0,
                'groups' => 0,
                'unreadNotifications' => 0,
            ],
            'recent' => [
                'connections' => collect(),
                'groups' => collect(),
                'messages' => collect(),
                'notifications' => collect(),
            ],
        ];
    }
}

