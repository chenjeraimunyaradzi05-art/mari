<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenSocialNetworkConnection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenSocialNetworkController
{
    public function sendConnectionRequest(Request $request, $userId): JsonResponse
    {
        $validated = $request->validate([
            'connection_type' => 'required|in:landlord_tenant,renter_renter,buyer_agent,connected',
            'message' => 'nullable|string|max:500',
        ]);

        // Prevent self-connection
        if ($userId === $request->user()->id) {
            return response()->json(['message' => 'Cannot connect with yourself'], 422);
        }

        // Check if connection already exists
        $existing = WomenSocialNetworkConnection::where(function ($q) use ($userId, $request) {
            $q->where('user_id_1', $request->user()->id)->where('user_id_2', $userId);
        })->orWhere(function ($q) use ($userId, $request) {
            $q->where('user_id_1', $userId)->where('user_id_2', $request->user()->id);
        })->first();

        if ($existing) {
            return response()->json(['message' => 'Connection already exists'], 422);
        }

        $connection = WomenSocialNetworkConnection::create([
            'user_id_1' => $request->user()->id,
            'user_id_2' => $userId,
            'connection_type' => $validated['connection_type'],
            'status' => 'pending',
            'message' => $validated['message'] ?? null,
        ]);

        return response()->json(['data' => $connection], 201);
    }

    public function acceptConnection(Request $request, $connectionId): JsonResponse
    {
        $connection = WomenSocialNetworkConnection::findOrFail($connectionId);

        if ($connection->user_id_2 !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $connection->update([
            'status' => 'connected',
            'connected_at' => now(),
        ]);

        return response()->json(['data' => $connection]);
    }

    public function rejectConnection(Request $request, $connectionId): JsonResponse
    {
        $connection = WomenSocialNetworkConnection::findOrFail($connectionId);

        if ($connection->user_id_2 !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $connection->update(['status' => 'rejected']);

        return response()->json(['data' => $connection]);
    }

    public function getConnections(Request $request): JsonResponse
    {
        $connections = WomenSocialNetworkConnection::where(function ($q) use ($request) {
            $q->where('user_id_1', $request->user()->id)->where('status', 'connected');
        })->orWhere(function ($q) use ($request) {
            $q->where('user_id_2', $request->user()->id)->where('status', 'connected');
        })->with(['initiator', 'recipient'])->paginate(20);

        return response()->json([
            'data' => $connections->items(),
            'pagination' => [
                'total' => $connections->total(),
                'per_page' => $connections->perPage(),
            ],
        ]);
    }

    public function getPendingRequests(Request $request): JsonResponse
    {
        $requests = WomenSocialNetworkConnection::where('user_id_2', $request->user()->id)
            ->where('status', 'pending')
            ->with('initiator')
            ->paginate(10);

        return response()->json([
            'data' => $requests->items(),
            'pagination' => [
                'total' => $requests->total(),
                'per_page' => $requests->perPage(),
            ],
        ]);
    }

    public function getNetworkStats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $connected = WomenSocialNetworkConnection::where(function ($q) use ($userId) {
            $q->where('user_id_1', $userId)->where('status', 'connected');
        })->orWhere(function ($q) use ($userId) {
            $q->where('user_id_2', $userId)->where('status', 'connected');
        })->count();

        $pending = WomenSocialNetworkConnection::where('user_id_2', $userId)
            ->where('status', 'pending')
            ->count();

        $blocked = WomenSocialNetworkConnection::where(function ($q) use ($userId) {
            $q->where('user_id_1', $userId)->where('status', 'blocked');
        })->orWhere(function ($q) use ($userId) {
            $q->where('user_id_2', $userId)->where('status', 'blocked');
        })->count();

        return response()->json([
            'data' => [
                'total_connections' => $connected,
                'pending_requests' => $pending,
                'blocked_users' => $blocked,
            ],
        ]);
    }

    public function blockUser(Request $request, $userId): JsonResponse
    {
        $existing = WomenSocialNetworkConnection::where(function ($q) use ($userId, $request) {
            $q->where('user_id_1', $request->user()->id)->where('user_id_2', $userId);
        })->orWhere(function ($q) use ($userId, $request) {
            $q->where('user_id_1', $userId)->where('user_id_2', $request->user()->id);
        })->first();

        if ($existing) {
            $existing->update(['status' => 'blocked']);
            return response()->json(['data' => $existing]);
        }

        $connection = WomenSocialNetworkConnection::create([
            'user_id_1' => $request->user()->id,
            'user_id_2' => $userId,
            'status' => 'blocked',
        ]);

        return response()->json(['data' => $connection]);
    }
}

