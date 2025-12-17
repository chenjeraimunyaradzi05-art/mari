<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Services\SocialInteractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class SocialPostController extends Controller
{
    public function __construct(private SocialInteractionService $interactionService)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $maxMedia = (int) config('social.feed.composer.max_media', 5);
        $mediaRules = ['sometimes', 'array'];

        if ($maxMedia > 0) {
            $mediaRules[] = 'max:'.$maxMedia;
        }

        $validated = $request->validate([
            'type' => ['sometimes', 'string', 'max:30'],
            'content' => ['nullable', 'string', 'max:2000'],
            'meta' => ['sometimes', 'array'],
            'visibility' => ['sometimes', Rule::in(['public', 'connections', 'private'])],
            'is_sponsored' => ['sometimes', 'boolean'],
            'published_at' => ['sometimes', 'date'],
            'media' => $mediaRules,
            'media.*.path' => ['sometimes', 'string', 'max:500'],
            'media.*.type' => ['sometimes', 'string', 'max:30'],
            'media.*.meta' => ['sometimes', 'array'],
            'media.*.thumbnail_path' => ['sometimes', 'string', 'max:500'],
            'media.*.upload_session_id' => ['sometimes', 'integer'],
            'media.*.upload_session_uuid' => ['sometimes', 'string', 'max:36'],
        ]);

        $post = $this->interactionService->createPost($user, $validated);

        return response()->json([
            'data' => $this->formatPost($post),
        ], 201);
    }

    public function destroy(Request $request, SocialPost $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $this->interactionService->deletePost($user, $post);

        return response()->json(null, 204);
    }

    public function react(Request $request, SocialPost $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'reaction' => ['required', 'string', 'max:30'],
        ]);

        $this->authorize('interact', $post);

        $reaction = $this->interactionService->addReaction($user, $post, $validated['reaction']);

        return response()->json([
            'data' => [
                'id' => $reaction->id,
                'reaction' => $reaction->reaction,
            ],
        ], 201);
    }

    public function unreact(Request $request, SocialPost $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'reaction' => ['sometimes', 'string', 'max:30'],
        ]);

        $this->authorize('interact', $post);

        $this->interactionService->removeReaction($user, $post, $validated['reaction'] ?? null);

        return response()->json(null, 204);
    }

    public function comment(Request $request, SocialPost $post): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1000'],
            'parent_id' => ['sometimes', 'integer'],
            'meta' => ['sometimes', 'array'],
        ]);

        $this->authorize('comment', $post);

        $comment = $this->interactionService->addComment(
            $user,
            $post,
            $validated['content'],
            $validated
        );

        return response()->json([
            'data' => [
                'id' => $comment->id,
                'content' => $comment->content,
                'parent_id' => $comment->parent_id,
                'created_at' => optional($comment->created_at)->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * @return ((int|null|string)[][]|int|null|string)[]
     *
     * @psalm-return array{id: int, user_id: int, type: string, content: null|string, visibility: string, published_at: string, media: array<int, array{id: int, type: string, file_path: string, url: null|string, thumbnail_url: null|string, mime_type: string}>}
     */
    private function formatPost(SocialPost $post): array
    {
        return [
            'id' => $post->id,
            'user_id' => $post->user_id,
            'type' => $post->type,
            'content' => $post->content,
            'visibility' => $post->visibility,
            'published_at' => optional($post->published_at)->toIso8601String(),
            'media' => $post->media->map(fn ($media) => [
                'id' => $media->id,
                'type' => $media->media_type,
                'file_path' => $media->file_path,
                'url' => $media->url,
                'thumbnail_url' => $media->thumbnail_url,
                'mime_type' => $media->mime_type,
            ])->all(),
        ];
    }
}

