<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Services\Social\EntertainmentService;
use App\Services\Social\SocialShareService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EntertainmentController extends Controller
{
    protected EntertainmentService $entertainmentService;

    public function __construct(EntertainmentService $entertainmentService)
    {
        $this->entertainmentService = $entertainmentService;
    }

    /**
     * Get the "TikTok" style short video feed.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function feed(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 20);
        $excludeIds = $request->input('exclude_ids', []);

        // Validate exclude_ids is an array
        if (!is_array($excludeIds)) {
            $excludeIds = [];
        }

        $posts = $this->entertainmentService->getShortVideoFeed($request->user(), $limit, $excludeIds);

        return response()->json([
            'data' => $this->transformPosts($posts),
            'meta' => [
                'description' => 'Infinite scroll feed for short-form videos',
                'count' => $posts->count(),
            ]
        ]);
    }

    /**
     * Get the main "Cinema" dashboard feed.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function dashboard(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);
        $posts = $this->entertainmentService->getCinemaFeed($request->user(), $limit);

        return response()->json([
            'data' => $this->transformPosts($posts),
            'meta' => [
                'description' => 'Curated feed of movies, documentaries, and educational content',
            ]
        ]);
    }

    /**
     * Browse long-form entertainment content (Movies, Docs, etc.).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function browse(Request $request): JsonResponse
    {
        $category = $request->input('category', 'all');
        $perPage = $request->integer('per_page', 15);

        $paginator = $this->entertainmentService->browse($category, $perPage);

        return response()->json([
            'data' => $this->transformPosts(collect($paginator->items())),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'category' => $category,
            ]
        ]);
    }

    /**
     * Get trending entertainment.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function trending(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);
        $posts = $this->entertainmentService->getTrending($limit);

        return response()->json([
            'data' => $this->transformPosts($posts),
        ]);
    }

    /**
     * Show a specific entertainment item.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        $post = SocialPost::with(['user', 'profile', 'media'])
            ->whereIn('post_type', ['documentary', 'movie', 'educational', 'success_story', 'short_video'])
            ->findOrFail($id);

        // Increment view count
        $post->incrementViews();

        return response()->json([
            'data' => $this->transformPost($post),
        ]);
    }

    /**
     * Create a new entertainment post.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request, SocialShareService $shareService): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|string|in:short_video,movie,documentary,educational,success_story',
            'title' => 'nullable|string|max:255',
            'caption' => 'nullable|string|max:2000',
            'description' => 'nullable|string',
            'media_ids' => 'required|array',
            'media_ids.*' => 'exists:social_media,id',
            'details' => 'nullable|array',
            'visibility' => 'in:public,connections,private',
            'share_to' => 'nullable|array',
            'share_to.*' => 'string|in:facebook,twitter,linkedin,instagram',
        ]);

        $post = $this->entertainmentService->createEntertainmentPost($request->user(), $validated);

        if ($request->has('share_to')) {
            $shareService->sharePost($request->user(), $post, $request->share_to);
        }

        return response()->json([
            'message' => 'Content created successfully',
            'data' => $this->transformPost($post),
        ], 201);
    }

    /**
     * Update watch progress.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateProgress(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'seconds' => 'required|integer|min:0',
            'total_duration' => 'required|integer|min:1',
            'completed' => 'boolean',
        ]);

        $this->entertainmentService->updateProgress(
            $request->user(),
            $id,
            $request->integer('seconds'),
            $request->integer('total_duration'),
            $request->boolean('completed', false)
        );

        return response()->json(['message' => 'Progress updated']);
    }

    /**
     * Get "Continue Watching" list.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function continueWatching(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);
        $items = $this->entertainmentService->getContinueWatching($request->user(), $limit);

        return response()->json([
            'data' => $this->transformPosts($items),
        ]);
    }

    /**
     * Toggle like on a post.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function like(Request $request, int $id): JsonResponse
    {
        $post = SocialPost::findOrFail($id);
        $user = $request->user();
        $profile = $user->socialProfile; // Assuming user has a profile

        if (!$profile) {
            return response()->json(['message' => 'User profile not found'], 404);
        }

        // Check if already liked
        $existingLike = $post->likes()
            ->where('user_id', $user->id) // Or profile_id depending on implementation
            ->first();

        if ($existingLike) {
            $existingLike->delete();
            $post->decrement('likes_count');
            $liked = false;
        } else {
            $post->likes()->create([
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'reaction' => 'like',
            ]);
            $post->increment('likes_count');
            $liked = true;
        }

        return response()->json([
            'liked' => $liked,
            'likes_count' => $post->likes_count,
        ]);
    }

    /**
     * Toggle follow on a creator.
     *
     * @param Request $request
     * @param int $creatorId
     * @return JsonResponse
     */
    public function follow(Request $request, int $creatorId): JsonResponse
    {
        $user = $request->user();
        $followerProfile = $user->socialProfile;

        // Creator is a User ID in the post object, but we follow Profiles usually.
        // Let's assume creatorId passed is the User ID of the creator.
        $creatorUser = \App\Models\User::with('socialProfile')->findOrFail($creatorId);
        $creatorProfile = $creatorUser->socialProfile;

        if (!$followerProfile || !$creatorProfile) {
            return response()->json(['message' => 'Profile not found'], 404);
        }

        if ($followerProfile->id === $creatorProfile->id) {
             return response()->json(['message' => 'Cannot follow yourself'], 400);
        }

        // Check if already following
        // Assuming a 'following' relationship on SocialProfile or a SocialFollow model
        $isFollowing = $followerProfile->following()->where('following_id', $creatorProfile->id)->exists();

        if ($isFollowing) {
            $followerProfile->following()->detach($creatorProfile->id);
            $following = false;
        } else {
            $followerProfile->following()->attach($creatorProfile->id, ['created_at' => now()]);
            $following = true;
        }

        return response()->json([
            'following' => $following,
        ]);
    }

    /**
     * Transform a collection of posts.
     */
    private function transformPosts(\Illuminate\Support\Collection $posts): array
    {
        return $posts->map(fn($post) => $this->transformPost($post))->toArray();
    }

    /**
     * Transform a single post.
     *
     * @return (\Illuminate\Support\Carbon|array|false|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, type: null|string, title: null|string, description: null|string, thumbnail_url: null|string, video_url: null|string, duration: int|null, views: int, likes: int|null, is_liked: false|mixed, creator: array{id: int, name: null|string, avatar: null|string, is_following: false|mixed}, tags: array|null, details: array|null, published_at: \Illuminate\Support\Carbon|null}
     */
    private function transformPost(SocialPost $post): array
    {
        $user = request()->user();
        $isLiked = false;
        $isFollowing = false;

        if ($user) {
            // Check like
            $isLiked = $post->likes()->where('user_id', $user->id)->exists();

            // Check follow
            if ($post->user && $post->user->socialProfile && $user->socialProfile) {
                 $isFollowing = $user->socialProfile->following()
                    ->where('following_id', $post->user->socialProfile->id)
                    ->exists();
            }
        }

        return [
            'id' => $post->id,
            'type' => $post->post_type, // 'short_video', 'movie', etc.
            'title' => $post->caption, // Using caption as title for now
            'description' => $post->content,
            'thumbnail_url' => $post->media->first()?->thumbnail_url,
            'video_url' => $post->media->first()?->url,
            'duration' => $post->media->first()?->duration,
            'views' => $post->views_count,
            'likes' => $post->likes_count,
            'is_liked' => $isLiked,
            'creator' => [
                'id' => $post->user_id,
                'name' => $post->user?->name,
                'avatar' => $post->user?->avatar_url,
                'is_following' => $isFollowing,
            ],
            'tags' => $post->tags,
            'details' => $post->meta, // Expose specific details (director, cast, music, etc.)
            'published_at' => $post->published_at,
        ];
    }
}

