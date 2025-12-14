<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\WomenRealEstate\WomenRentalProperty;
use App\Models\WomenRealEstate\WomenPropertySeeker;
use App\Models\WomenRealEstate\WomenPropertyMatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenRentalListingController
{
    public function getLandlordListings(Request $request): JsonResponse
    {
        $listings = WomenRentalProperty::where('landlord_user_id', $request->user()->id)
            ->with('listing')
            ->paginate(15);

        return response()->json([
            'data' => $listings->items(),
            'pagination' => [
                'total' => $listings->total(),
                'count' => $listings->count(),
                'per_page' => $listings->perPage(),
                'current_page' => $listings->currentPage(),
            ],
        ]);
    }

    public function createRentalListing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'listing_id' => 'required|exists:women_listings,id',
            'monthly_rent' => 'required|numeric|min:0',
            'security_deposit' => 'nullable|numeric|min:0',
            'furnishing' => 'required|in:unfurnished,partially_furnished,furnished',
            'lease_term' => 'required|in:monthly,quarterly,semi-annual,annual,flexible',
            'min_lease_months' => 'required|integer|min:1',
            'available_from' => 'required|date',
            'available_until' => 'nullable|date',
            'house_rules' => 'nullable|string',
            'allows_pets' => 'boolean',
            'allows_smoking' => 'boolean',
            'max_occupants' => 'nullable|integer|min:1',
        ]);

        $rental = WomenRentalProperty::create([
            ...$validated,
            'landlord_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $rental], 201);
    }

    public function searchRentals(Request $request): JsonResponse
    {
        $query = WomenRentalProperty::where('is_active', true);

        if ($request->has('min_rent')) {
            $query->where('monthly_rent', '>=', $request->input('min_rent'));
        }

        if ($request->has('max_rent')) {
            $query->where('monthly_rent', '<=', $request->input('max_rent'));
        }

        if ($request->has('furnishing')) {
            $query->where('furnishing', $request->input('furnishing'));
        }

        if ($request->has('allows_pets')) {
            $query->where('allows_pets', $request->boolean('allows_pets'));
        }

        $rentals = $query->orderByDesc('created_at')->paginate(20);

        return response()->json([
            'data' => $rentals->items(),
            'pagination' => [
                'total' => $rentals->total(),
                'count' => $rentals->count(),
                'per_page' => $rentals->perPage(),
            ],
        ]);
    }

    public function getTrendingRentals(): JsonResponse
    {
        $trending = WomenRentalProperty::where('is_active', true)
            ->orderByDesc('views_count')
            ->limit(10)
            ->with('listing')
            ->get();

        return response()->json(['data' => $trending]);
    }

    public function getRentalListing($rentalPropertyId): JsonResponse
    {
        $rental = WomenRentalProperty::with(['listing', 'landlord', 'inquiries'])->findOrFail($rentalPropertyId);

        return response()->json(['data' => $rental]);
    }

    public function deleteRentalListing(Request $request, $rentalPropertyId): JsonResponse
    {
        $rental = WomenRentalProperty::findOrFail($rentalPropertyId);

        if ($rental->landlord_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $rental->delete();

        return response()->json(['message' => 'Rental listing deleted'], 200);
    }

    public function recordRentalView($rentalPropertyId): JsonResponse
    {
        $rental = WomenRentalProperty::findOrFail($rentalPropertyId);
        $rental->increment('views_count');

        return response()->json(['data' => ['views_count' => $rental->views_count]]);
    }
}

