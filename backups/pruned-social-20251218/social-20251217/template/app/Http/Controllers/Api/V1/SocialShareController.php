<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Services\Social\SocialShareService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

final class SocialShareController extends Controller
{
    public function __construct(
        protected SocialShareService $shareService
    ) {}

    /**
     * Share a post to external social networks.
     */
    public function store(Request $request, SocialPost $post): JsonResponse
    {
        $request->validate([
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['string', 'in:facebook,twitter,x,linkedin,instagram'],
            'message' => ['nullable', 'string', 'max:500'],
        ]);

        // Ensure user can view the post
        $this->authorize('view', $post);

        $results = $this->shareService->sharePost(
            $request->user(),
            $post,
            $request->input('channels'),
            $request->input('message')
        );

        return response()->json([
            'message' => 'Sharing process completed',
            'results' => $results,
        ]);
    }
}

