<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class PropertySocialController extends Controller
{
    /**
     * Share a property to the social feed
     * Creates a new property social post record with engagement tracking
     */
    public function share(Request $request, $propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $data = $request->validate([
                'caption' => 'nullable|string|max:2000',
                'share_type' => 'nullable|in:original,repost,listing_promotion',
                'featured_image' => 'nullable|string',
            ]);

            // Create property social post record in database
            $propertySocialPost = DB::table('property_social_posts')->insertGetId([
                'property_id' => $propertyId,
                'user_id' => $user->id,
                'caption' => $data['caption'] ?? null,
                'share_type' => $data['share_type'] ?? 'original',
                'featured_image' => $data['featured_image'] ?? null,
                'is_active' => true,
                'views_count' => 0,
                'shares_count' => 0,
                'engagement_score' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Property shared successfully',
                'property_id' => $propertyId,
                'user_id' => $user->id,
                'share_type' => $data['share_type'] ?? 'original',
                'data' => [
                    'id' => $propertySocialPost,
                    'property_id' => $propertyId,
                    'user_id' => $user->id,
                    'caption' => $data['caption'] ?? null,
                    'share_type' => $data['share_type'] ?? 'original',
                    'views_count' => 0,
                    'shares_count' => 0,
                    'engagement_score' => 0,
                    'created_at' => now(),
                ]
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to share property',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a property's social posts
     */
    public function getPropertyPosts($propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $posts = DB::table('property_social_posts')
                ->where('property_id', $propertyId)
                ->where('is_active', true)
                ->orderByDesc('created_at')
                ->paginate(15);

            return response()->json([
                'success' => true,
                'property_id' => $propertyId,
                'data' => $posts->items(),
                'pagination' => [
                    'total' => $posts->total(),
                    'per_page' => $posts->perPage(),
                    'current_page' => $posts->currentPage(),
                    'last_page' => $posts->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch property posts',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Record a view on a property social post
     */
    public function recordView($postId): \Illuminate\Http\JsonResponse
    {
        try {
            $post = DB::table('property_social_posts')
                ->where('id', $postId)
                ->first();

            if (!$post) {
                return response()->json(['error' => 'Post not found'], 404);
            }

            // Increment view count
            $newViewCount = $post->views_count + 1;

            // Calculate engagement score (views are 10% weight, shares are 30% weight)
            $engagementScore = round(($newViewCount * 0.1) + ($post->shares_count * 0.3), 1);

            DB::table('property_social_posts')
                ->where('id', $postId)
                ->update([
                    'views_count' => $newViewCount,
                    'engagement_score' => $engagementScore,
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'post_id' => $postId,
                'views_count' => $newViewCount,
                'engagement_score' => $engagementScore,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to record view',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Record a share/engagement on a property social post
     */
    public function recordShare($postId): \Illuminate\Http\JsonResponse
    {
        try {
            $post = DB::table('property_social_posts')
                ->where('id', $postId)
                ->first();

            if (!$post) {
                return response()->json(['error' => 'Post not found'], 404);
            }

            // Increment share count
            $newShareCount = $post->shares_count + 1;

            // Calculate engagement score (views are 10% weight, shares are 30% weight)
            $engagementScore = round(($post->views_count * 0.1) + ($newShareCount * 0.3), 1);

            DB::table('property_social_posts')
                ->where('id', $postId)
                ->update([
                    'shares_count' => $newShareCount,
                    'engagement_score' => $engagementScore,
                    'updated_at' => now(),
                ]);

            $updatedPost = DB::table('property_social_posts')
                ->where('id', $postId)
                ->first();

            return response()->json([
                'success' => true,
                'post_id' => $postId,
                'shares_count' => $newShareCount,
                'engagement_score' => $engagementScore,
                'engagement_metrics' => [
                    'views' => $updatedPost->views_count,
                    'shares' => $newShareCount,
                    'impressions' => $updatedPost->views_count + $newShareCount,
                    'engagement_rate' => round(($newShareCount / max($updatedPost->views_count, 1)) * 100, 2),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to record share',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get trending property shares
     */
    public function getTrending(): \Illuminate\Http\JsonResponse
    {
        try {
            $trending = DB::table('property_social_posts')
                ->where('is_active', true)
                ->orderByDesc('engagement_score')
                ->take(10)
                ->get()
                ->map(function ($post) {
                    return array_merge(
                        (array)$post,
                        [
                            'engagement_metrics' => [
                                'views' => $post->views_count,
                                'shares' => $post->shares_count,
                                'impressions' => $post->views_count + $post->shares_count,
                                'engagement_rate' => round(($post->shares_count / max($post->views_count, 1)) * 100, 2),
                            ]
                        ]
                    );
                });

            return response()->json([
                'success' => true,
                'data' => $trending,
                'count' => count($trending),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch trending properties',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get user's property shares
     */
    public function getUserShares($userId): \Illuminate\Http\JsonResponse
    {
        try {
            $shares = DB::table('property_social_posts')
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'user_id' => $userId,
                'data' => $shares->items(),
                'pagination' => [
                    'total' => $shares->total(),
                    'per_page' => $shares->perPage(),
                    'current_page' => $shares->currentPage(),
                    'last_page' => $shares->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch user shares',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a property social post
     */
    public function destroy($postId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $post = DB::table('property_social_posts')
                ->where('id', $postId)
                ->first();

            if (!$post) {
                return response()->json(['error' => 'Post not found'], 404);
            }

            // Check authorization - only owner can delete
            if ($post->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized - you can only delete your own posts'], 403);
            }

            DB::table('property_social_posts')
                ->where('id', $postId)
                ->delete();

            return response()->json([
                'success' => true,
                'message' => 'Property share deleted successfully',
                'post_id' => $postId,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to delete share',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}

