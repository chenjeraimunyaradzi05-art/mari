<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Http\Requests\WomenRealEstate\WomenListingSocialShareStoreRequest;
use App\Models\WomenRealEstate\WomenListing;
use App\Services\WomenRealEstate\WomenListingSocialShareService;
use Illuminate\Http\JsonResponse;

final class WomenListingSocialShareController extends Controller
{
    public function __construct(private readonly WomenListingSocialShareService $shares)
    {
        $this->middleware('auth:sanctum');
    }

    public function store(WomenListingSocialShareStoreRequest $request, WomenListing $listing): JsonResponse
    {
        $this->authorize('update', $listing);

        $payload = $request->validated();

        $share = $this->shares->recordShare($listing, $payload, $request->user());

        return response()->json([
            'id' => $share->id,
            'listing_id' => $share->listing_id,
            'user_id' => $share->user_id,
            'platform' => $share->platform,
            'share_url' => $share->share_url,
            'shared_at' => optional($share->shared_at)->toISOString(),
            'meta' => $share->meta ?? [],
        ], 201);
    }
}

