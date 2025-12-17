<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * RentalSocialNetworkController
 *
 * Enable social networking between renters, buyers, landlords
 * Create connections, share experiences, build community
 */
final class RentalSocialNetworkController extends Controller
{
    /**
     * Send connection request
     */
    public function sendConnectionRequest(Request $request, $userId): \Illuminate\Http\JsonResponse
    {
        try {
            $currentUser = Auth::user();

            if (!$currentUser) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            if ($currentUser->id === $userId) {
                return response()->json(['error' => 'Cannot connect with yourself'], 400);
            }

            // Validate user exists
            $targetUser = DB::table('users')
                ->where('id', $userId)
                ->first();

            if (!$targetUser) {
                return response()->json(['error' => 'User not found'], 404);
            }

            $data = $request->validate([
                'connection_type' => 'required|in:landlord_tenant,renter_renter,buyer_agent,connected',
                'message' => 'nullable|string|max:500',
            ]);

            // Check if already connected
            $existing = DB::table('rental_social_networks')
                ->where(function($query) use ($currentUser, $userId) {
                    $query->where([
                        ['user_id_1', '=', $currentUser->id],
                        ['user_id_2', '=', $userId],
                    ])->orWhere([
                        ['user_id_1', '=', $userId],
                        ['user_id_2', '=', $currentUser->id],
                    ]);
                })
                ->first();

            if ($existing) {
                return response()->json([
                    'error' => 'Connection already exists',
                    'status' => $existing->status,
                ], 409);
            }

            // Create connection
            $connectionId = DB::table('rental_social_networks')->insertGetId([
                'user_id_1' => $currentUser->id,
                'user_id_2' => $userId,
                'connection_type' => $data['connection_type'],
                'message' => $data['message'] ?? null,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Connection request sent',
                'connection_id' => $connectionId,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to send connection request',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Accept connection request
     */
    public function acceptConnection($connectionId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $connection = DB::table('rental_social_networks')
                ->where('id', $connectionId)
                ->where('user_id_2', $user->id)
                ->where('status', 'pending')
                ->first();

            if (!$connection) {
                return response()->json(['error' => 'Connection request not found'], 404);
            }

            DB::table('rental_social_networks')
                ->where('id', $connectionId)
                ->update([
                    'status' => 'connected',
                    'connected_at' => now(),
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Connection accepted',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to accept connection',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject connection request
     */
    public function rejectConnection($connectionId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $connection = DB::table('rental_social_networks')
                ->where('id', $connectionId)
                ->where('user_id_2', $user->id)
                ->where('status', 'pending')
                ->first();

            if (!$connection) {
                return response()->json(['error' => 'Connection request not found'], 404);
            }

            DB::table('rental_social_networks')
                ->where('id', $connectionId)
                ->update([
                    'status' => 'rejected',
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Connection rejected',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to reject connection',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get user's connections
     */
    public function getConnections(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $status = $request->get('status', 'connected');

            $connections = DB::table('rental_social_networks')
                ->where(function($query) use ($user) {
                    $query->where('user_id_1', $user->id)
                          ->orWhere('user_id_2', $user->id);
                })
                ->where('status', $status)
                ->get()
                ->map(function ($connection) use ($user) {
                    $otherUserId = $connection->user_id_1 === $user->id ?
                                   $connection->user_id_2 : $connection->user_id_1;

                    $otherUser = DB::table('users')
                        ->where('id', $otherUserId)
                        ->select('id', 'name', 'email', 'avatar')
                        ->first();

                    return [
                        'connection_id' => $connection->id,
                        'user' => $otherUser,
                        'connection_type' => $connection->connection_type,
                        'connected_at' => $connection->connected_at,
                        'initiated_by_me' => $connection->user_id_1 === $user->id,
                    ];
                });

            return response()->json([
                'success' => true,
                'count' => count($connections),
                'connections' => $connections,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch connections',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get pending connection requests
     */
    public function getPendingRequests(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $requests = DB::table('rental_social_networks')
                ->where('user_id_2', $user->id)
                ->where('status', 'pending')
                ->join('users', 'rental_social_networks.user_id_1', '=', 'users.id')
                ->select('rental_social_networks.*', 'users.name', 'users.email', 'users.avatar')
                ->orderByDesc('rental_social_networks.created_at')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'count' => $requests->total(),
                'data' => $requests->items(),
                'pagination' => [
                    'current_page' => $requests->currentPage(),
                    'per_page' => $requests->perPage(),
                    'last_page' => $requests->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch requests',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get network statistics
     */
    public function getNetworkStats(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $stats = [
                'total_connections' => DB::table('rental_social_networks')
                    ->where(function($query) use ($user) {
                        $query->where('user_id_1', $user->id)
                              ->orWhere('user_id_2', $user->id);
                    })
                    ->where('status', 'connected')
                    ->count(),

                'pending_requests' => DB::table('rental_social_networks')
                    ->where('user_id_2', $user->id)
                    ->where('status', 'pending')
                    ->count(),

                'connection_types' => DB::table('rental_social_networks')
                    ->where(function($query) use ($user) {
                        $query->where('user_id_1', $user->id)
                              ->orWhere('user_id_2', $user->id);
                    })
                    ->where('status', 'connected')
                    ->selectRaw('connection_type, COUNT(*) as count')
                    ->groupBy('connection_type')
                    ->get(),
            ];

            return response()->json([
                'success' => true,
                'statistics' => $stats,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch statistics',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Block user
     */
    public function blockUser($userId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $connection = DB::table('rental_social_networks')
                ->where(function($query) use ($user, $userId) {
                    $query->where([
                        ['user_id_1', '=', $user->id],
                        ['user_id_2', '=', $userId],
                    ])->orWhere([
                        ['user_id_1', '=', $userId],
                        ['user_id_2', '=', $user->id],
                    ]);
                })
                ->first();

            if ($connection) {
                DB::table('rental_social_networks')
                    ->where('id', $connection->id)
                    ->update([
                        'status' => 'blocked',
                        'updated_at' => now(),
                    ]);
            } else {
                // Create blocked connection
                DB::table('rental_social_networks')->insert([
                    'user_id_1' => $user->id,
                    'user_id_2' => $userId,
                    'connection_type' => 'connected',
                    'status' => 'blocked',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'User blocked',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to block user',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}

