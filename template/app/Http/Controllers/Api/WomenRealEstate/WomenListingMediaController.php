<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Http\Requests\WomenRealEstate\WomenListingMediaReorderRequest;
use App\Http\Requests\WomenRealEstate\WomenListingMediaStoreRequest;
use App\Http\Requests\WomenRealEstate\WomenListingMediaUpdateRequest;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingMedia;
use App\Services\WomenRealEstate\WomenListingMediaPipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

final class WomenListingMediaController extends Controller
{
    public function __construct(private readonly WomenListingMediaPipeline $pipeline)
    {
        $this->middleware('auth:sanctum');
    }

    public function store(WomenListingMediaStoreRequest $request, WomenListing $listing): JsonResponse
    {
        $this->authorize('update', $listing);

        $validated = $request->validated();
        $file = $request->file('file') ?? ($validated['file'] ?? null);

        $media = $this->pipeline->upload($listing, $file, $validated);

        return response()->json($this->transformMedia($media), 201);
    }

    public function update(
        WomenListingMediaUpdateRequest $request,
        WomenListing $listing,
        WomenListingMedia $media
    ): JsonResponse {
        $this->authorize('update', $listing);
        $this->assertListingMedia($listing, $media);

        $updated = $this->pipeline->updateMeta($media, $request->validated());

        return response()->json($this->transformMedia($updated));
    }

    public function destroy(WomenListing $listing, WomenListingMedia $media): Response
    {
        $this->authorize('update', $listing);
        $this->assertListingMedia($listing, $media);

        $this->pipeline->remove($media);

        return response()->noContent();
    }

    public function reorder(WomenListingMediaReorderRequest $request, WomenListing $listing): Response
    {
        $this->authorize('update', $listing);

        $orderedIds = $request->validated('ordered_ids');
        $listingMediaIds = $listing->media()->pluck('id')->all();

        $validIds = array_values(array_intersect($orderedIds, $listingMediaIds));

        if ($validIds !== []) {
            $this->pipeline->reorder($listing, $validIds);
        }

        return response()->noContent();
    }

    private function assertListingMedia(WomenListing $listing, WomenListingMedia $media): void
    {
        if ($media->listing_id !== $listing->id) {
            abort(404);
        }
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{id: int, type: string, path: string, caption: null|string, position: int, meta: array, created_at: null|string, updated_at: null|string}
     */
    private function transformMedia(WomenListingMedia $media): array
    {
        return [
            'id' => $media->id,
            'type' => $media->type,
            'path' => $media->path,
            'caption' => $media->caption,
            'position' => $media->position,
            'meta' => $media->meta ?? [],
            'created_at' => optional($media->created_at)->toISOString(),
            'updated_at' => optional($media->updated_at)->toISOString(),
        ];
    }
}

