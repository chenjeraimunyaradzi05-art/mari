<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Http\Resources\BundleOfferResource;
use App\Models\BundleOffer;
use App\Services\Money\BundleConcierge\BundleConciergeService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final class BundleOfferController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        abort_unless($user, 403);

        $offers = $user->bundleOffers()
            ->with('lineItems')
            ->latest()
            ->take((int) $request->query('limit', 5))
            ->get();

        return BundleOfferResource::collection($offers);
    }

    public function store(Request $request, BundleConciergeService $bundleConciergeService): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $data = $request->validate([
            'currency' => ['nullable', 'string', 'size:3'],
            'categories' => ['nullable', 'array', 'max:10'],
            'categories.*.category' => ['required_with:categories', Rule::in(array_keys(config('bundles.categories', [])))],
            'categories.*.current_monthly_cost' => ['nullable', 'numeric', 'min:0'],
            'categories.*.current_provider' => ['nullable', 'string', 'max:120'],
            'categories.*.preferred_provider' => ['nullable', Rule::in(array_keys(config('bundles.providers', [])))],
        ]);

        $offer = $bundleConciergeService->generateOffer($user, $data);

        return (new BundleOfferResource($offer))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, BundleOffer $bundleOffer): BundleOfferResource
    {
        $user = $request->user();
        abort_unless($user && $bundleOffer->user_id === $user->id, 403);

        return new BundleOfferResource($bundleOffer->load('lineItems'));
    }
}

