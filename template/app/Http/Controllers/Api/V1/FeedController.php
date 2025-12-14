<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Support\FeatureFlag;
use App\Support\Feed\FeedSettings;
use App\Support\SocialMediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FeedController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        FeatureFlag::ensure('feed.enabled');

        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:50',
            'filter' => 'sometimes|string',
            'visibility' => 'sometimes|string|in:public,private',
            'type' => 'sometimes|string|max:50',
        ]);

        $filters = FeedSettings::filtersByValue();
        $filtersList = FeedSettings::filters();
        $filter = $validated['filter'] ?? 'latest';

        if (! isset($filters[$filter]) || ! $filters[$filter]['enabled']) {
            abort(404, 'This feed filter is currently disabled.');
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 10);
        $perPage = max(1, min(50, $perPage));

        $query = Post::query()
            ->with('user')
            ->latest();

        if (! empty($validated['visibility'])) {
            $query->where('visibility', $validated['visibility']);
        }

        if (! empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        if ($filter === 'public') {
            $query->where('visibility', 'public');
        }

        if ($filter === 'private') {
            $query->where('visibility', 'private');
        }

        if ($filter === 'media') {
            $query->whereNotNull('media')->where('media', '!=', '');
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $collection = $paginator->getCollection()->map(function (Post $post) {
            $mediaUrl = null;

            if (! empty($post->media)) {
                $mediaUrl = self::resolveMediaUrl($post->media);
            }

            return [
                'id' => $post->id,
                'content' => $post->content,
                'type' => $post->type,
                'visibility' => $post->visibility,
                'media' => $mediaUrl ? [
                    'type' => 'image',
                    'url' => $mediaUrl,
                ] : null,
                'published_at' => optional($post->created_at)->toIso8601String(),
                'author' => [
                    'id' => $post->user?->id,
                    'name' => $post->user?->name,
                ],
            ];
        });

        return response()->json([
            'data' => $collection,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'has_more' => $paginator->hasMorePages(),
                'filter' => $filter,
                'filters' => $filtersList,
            ],
            'links' => [
                'next' => $paginator->nextPageUrl(),
                'prev' => $paginator->previousPageUrl(),
            ],
        ]);
    }

    protected static function resolveMediaUrl(string $path): ?string
    {
        return SocialMediaStorage::url($path);
    }
}

