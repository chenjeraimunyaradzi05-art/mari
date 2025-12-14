<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Models\WomenRealEstate\WomenRentalInquiry;
use App\Models\WomenRealEstate\WomenPropertySeeker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WomenRentalInquiryController
{
    public function sendInquiry(Request $request, $rentalPropertyId): JsonResponse
    {
        $validated = $request->validate([
            'inquiry_message' => 'required|string|min:10',
        ]);

        $seeker = WomenPropertySeeker::where('user_id', $request->user()->id)->firstOrFail();

        $inquiry = WomenRentalInquiry::create([
            'rental_property_id' => $rentalPropertyId,
            'property_seeker_id' => $seeker->id,
            'landlord_user_id' => $request->input('landlord_user_id'),
            'inquiry_message' => $validated['inquiry_message'],
            'status' => 'pending',
        ]);

        return response()->json(['data' => $inquiry], 201);
    }

    public function getLandlordInquiries(Request $request): JsonResponse
    {
        $inquiries = WomenRentalInquiry::where('landlord_user_id', $request->user()->id)
            ->with(['rentalProperty', 'seeker'])
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $inquiries->items(),
            'pagination' => [
                'total' => $inquiries->total(),
                'per_page' => $inquiries->perPage(),
            ],
        ]);
    }

    public function getSeekerInquiries(Request $request): JsonResponse
    {
        $seeker = WomenPropertySeeker::where('user_id', $request->user()->id)->firstOrFail();

        $inquiries = WomenRentalInquiry::where('property_seeker_id', $seeker->id)
            ->with(['rentalProperty', 'landlord'])
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $inquiries->items(),
            'pagination' => [
                'total' => $inquiries->total(),
                'per_page' => $inquiries->perPage(),
            ],
        ]);
    }

    public function getInquiryDetails($inquiryId): JsonResponse
    {
        $inquiry = WomenRentalInquiry::with(['rentalProperty', 'seeker', 'landlord'])->findOrFail($inquiryId);

        return response()->json(['data' => $inquiry]);
    }

    public function updateInquiryStatus(Request $request, $inquiryId): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,interested,rejected,scheduled,accepted',
            'landlord_response' => 'nullable|string',
            'scheduled_tour_at' => 'nullable|date_format:Y-m-d H:i:s',
        ]);

        $inquiry = WomenRentalInquiry::findOrFail($inquiryId);

        if ($inquiry->landlord_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $inquiry->update([
            'status' => $validated['status'],
            'landlord_response' => $validated['landlord_response'] ?? $inquiry->landlord_response,
            'scheduled_tour_at' => $validated['scheduled_tour_at'] ?? $inquiry->scheduled_tour_at,
            'responded_at' => now(),
        ]);

        return response()->json(['data' => $inquiry]);
    }
}

