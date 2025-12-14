<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Services\Social\FeedMatcher;
use App\Support\SocialPostFormatter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

final class PersonalizedFeedController extends Controller
{
    public function __construct(private readonly FeedMatcher $feedMatcher)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'limit' => 'sometimes|integer|min:1|max:50',
            'include_self' => 'sometimes|boolean',
            'weights' => 'sometimes|array',
            'weights.*' => 'numeric',
            'focus' => 'sometimes|array',
            'focus.sectors' => 'sometimes|array',
            'focus.sectors.*' => 'string',
            'focus.skills' => 'sometimes|array',
            'focus.skills.*' => 'string',
            'focus.keywords' => 'sometimes|array',
            'focus.keywords.*' => 'string',
        ]);

        $limit = (int) ($validated['limit'] ?? 25);
        $options = [
            'include_self' => Arr::get($validated, 'include_self', true),
            'weights' => Arr::get($validated, 'weights', []),
            'focus' => Arr::get($validated, 'focus', []),
        ];

    $posts = $this->feedMatcher->forUser($user, $limit, $options);

    $data = $posts->map(fn (SocialPost $post) => SocialPostFormatter::make($post, $user));

        return response()->json([
            'data' => $data,
            'meta' => [
                'request_limit' => $limit,
                'actual' => $data->count(),
                'weights' => $this->feedMatcher->getLastWeights(),
                'profile' => $this->feedMatcher->getLastProfile(),
            ],
        ]);
    }

}

