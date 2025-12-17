<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Services\SocialFeedService;
use App\Support\FeatureFlag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SocialFeedController extends Controller
{
    public function __construct(private SocialFeedService $feedService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        abort_unless($user !== null, 401);

        $request->validate([
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:50',
            'filter' => 'sometimes|string|in:all,latest,following,discovery,trending,sponsored,public,private,media',
            'type' => 'sometimes|string|max:40',
        ]);

        $filter = $request->input('filter', 'all');
        $filter = $filter === 'latest' ? 'all' : $filter;

        $availableFilters = \App\Support\Feed\FeedSettings::filtersByValue();

        if (! isset($availableFilters[$filter]) || ! ($availableFilters[$filter]['enabled'] ?? false)) {
            abort(404, 'This feed filter is currently disabled.');
        }

        if ($filter === 'public') {
            FeatureFlag::ensure('feed.filters.public');
        }

        if ($filter === 'private') {
            FeatureFlag::ensure('feed.filters.private');
        }

        if ($filter === 'media') {
            FeatureFlag::ensure('feed.filters.media');
        }

        $options = [
            'page' => (int) $request->input('page', 1),
            'per_page' => (int) $request->input('per_page', 20),
            'filter' => $filter,
            'type' => $request->input('type'),
        ];

        $items = $this->feedService->generateFeed($user, $options);

        $data = $items->map(function ($item) {
            /** @var SocialPost $post */
            $post = $item->get('post');

            $mediaItems = $post->relationLoaded('media')
                ? $post->getRelation('media')
                : collect($post->media ?? []);

            if (! $mediaItems instanceof \Illuminate\Support\Collection) {
                $mediaItems = collect($mediaItems);
            }

            $aiTags = $post->ai_tags;
            if (is_string($aiTags) && $aiTags !== '') {
                $aiTags = array_map('trim', explode(',', $aiTags));
            }

            if (! is_array($aiTags)) {
                $aiTags = [];
            }

            $aiTags = collect($aiTags)
                ->map(fn ($tag) => is_string($tag) ? ltrim(trim($tag), '#') : null)
                ->filter()
                ->unique()
                ->values()
                ->all();

            $aiScore = $post->ai_engagement_score !== null
                ? round((float) $post->ai_engagement_score, 1)
                : null;

            return [
                'post' => [
                    'id' => $post->id,
                    'user_id' => $post->user_id,
                    'type' => $post->type,
                    'content' => $post->content,
                    'meta' => $post->meta,
                    'visibility' => $post->visibility,
                    'published_at' => optional($post->published_at)->toIso8601String(),
                    'user' => [
                        'id' => $post->user?->id,
                        'name' => $post->user?->name,
                    ],
                    'profile' => $post->profile ? [
                        'id' => $post->profile->id,
                        'username' => $post->profile->username,
                        'display_name' => $post->profile->display_name,
                        'profile_type' => $post->profile->profile_type,
                        'is_verified' => (bool) $post->profile->is_verified,
                        'avatar_url' => $post->profile->avatar_url,
                        'cover_url' => $post->profile->cover_url,
                    ] : null,
                    'media' => $mediaItems->map(fn ($media) => [
                        'id' => $media->id,
                        'type' => $media->media_type,
                        'path' => $media->path,
                        'meta' => $media->meta,
                    ])->all(),
                    'counts' => [
                        'reactions' => $post->reactions_count ?? 0,
                        'comments' => $post->comments_count ?? 0,
                        'impressions' => $post->impressions_count ?? 0,
                    ],
                    'ai' => [
                        'tags' => $aiTags,
                        'engagement_score' => $aiScore,
                    ],
                ],
                'score' => $item->get('score'),
                'source' => $item->get('source'),
                'reasons' => $item->get('reasons'),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'page' => $options['page'],
                'per_page' => $options['per_page'],
                'count' => $data->count(),
                'has_more' => $data->count() === $options['per_page'],
                'filter' => $filter,
            ],
        ]);
    }

    public function recordImpression(Request $request): JsonResponse
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'post_id' => 'required|exists:social_posts,id',
            'source' => 'sometimes|string|max:40',
            'meta' => 'sometimes|array',
        ]);

        $post = SocialPost::with('user')->findOrFail($validated['post_id']);

        $impression = $this->feedService->recordImpression(
            $post,
            $user,
            $validated['source'] ?? 'feed',
            $validated['meta'] ?? []
        );

        return response()->json([
            'data' => [
                'id' => $impression->id,
                'post_id' => $impression->social_post_id,
                'viewed_at' => optional($impression->viewed_at)->toIso8601String(),
            ],
        ], 201);
    }
}

