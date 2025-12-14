<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerIntentType;
use App\Enums\WomenRealEstate\PartnerIntentionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\WomenRealEstate\WomenListingPartnerIntentionStoreRequest;
use App\Http\Requests\WomenRealEstate\WomenListingPartnerIntentionUpdateRequest;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use App\Services\WomenRealEstate\WomenListingPartnerIntentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

final class WomenListingPartnerIntentionController extends Controller
{
    public function __construct(private readonly WomenListingPartnerIntentService $service)
    {
        $this->middleware('auth:sanctum');
    }

    public function index(WomenListing $listing): JsonResponse
    {
        $this->authorize('viewAny', [WomenListingPartnerIntention::class, $listing]);

        $intentions = $listing->partnerIntentions()->latest()->with(['initiator:id,name', 'invitee:id,name'])->get();

        return response()->json(
            $intentions->map(fn ($intention) => $this->transform($intention))->values()->all()
        );
    }

    public function store(WomenListingPartnerIntentionStoreRequest $request, WomenListing $listing): JsonResponse
    {
        $this->authorize('create', [WomenListingPartnerIntention::class, $listing]);

        $validated = $request->validated();
        $validated['intent'] = PartnerIntentType::from($validated['intent']);

        $intent = $this->service->create($listing, $request->user(), $validated);

        return response()->json($this->transform($intent->loadMissing(['initiator:id,name', 'invitee:id,name'])), 201);
    }

    public function update(
        WomenListingPartnerIntentionUpdateRequest $request,
        WomenListing $listing,
        WomenListingPartnerIntention $intention
    ): JsonResponse {
        $this->authorize('update', $intention);
        $this->assertListingIntent($listing, $intention);

        $payload = $request->validated();
        $status = PartnerIntentionStatus::from($payload['status']);

        $updated = $this->service->respond($intention, $status, $payload['message'] ?? null, $request->user());

        return response()->json($this->transform($updated->load(['initiator:id,name', 'invitee:id,name'])));
    }

    public function destroy(WomenListing $listing, WomenListingPartnerIntention $intention): Response
    {
        $this->authorize('delete', $intention);
        $this->assertListingIntent($listing, $intention);

        $this->service->cancel($intention);

        return response()->noContent();
    }

    /**
     * @return (PartnerIntentType|PartnerIntentionStatus|array|int|null|string)[]
     *
     * @psalm-return array{id: int, listing_id: int|null, initiator_id: int, invitee_id: int|null, status: PartnerIntentionStatus|string, intent: PartnerIntentType|string, preferences: array, message: null|string, expires_at: null|string, created_at: null|string, updated_at: null|string, initiator: array|null, invitee: array|null}
     */
    private function transform(WomenListingPartnerIntention $intention): array
    {
        return [
            'id' => $intention->id,
            'listing_id' => $intention->listing_id,
            'initiator_id' => $intention->initiator_id,
            'invitee_id' => $intention->invitee_id,
            'status' => $intention->status?->value ?? $intention->status,
            'intent' => $intention->intent?->value ?? $intention->intent,
            'preferences' => $intention->preferences ?? [],
            'message' => $intention->message,
            'expires_at' => optional($intention->expires_at)->toISOString(),
            'created_at' => optional($intention->created_at)->toISOString(),
            'updated_at' => optional($intention->updated_at)->toISOString(),
            'initiator' => $intention->relationLoaded('initiator') ? $intention->initiator?->only(['id', 'name']) : null,
            'invitee' => $intention->relationLoaded('invitee') ? $intention->invitee?->only(['id', 'name']) : null,
        ];
    }

    private function assertListingIntent(WomenListing $listing, WomenListingPartnerIntention $intention): void
    {
        if ($intention->listing_id !== $listing->id) {
            abort(404);
        }
    }
}

