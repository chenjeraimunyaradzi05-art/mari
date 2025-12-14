<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * RentalInquiryController
 *
 * Handle rental property inquiries, communication between renters and landlords
 */
final class RentalInquiryController extends Controller
{
    /**
     * Send inquiry for rental property
     */
    public function sendInquiry(Request $request, $rentalPropertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            // Validate property exists
            $rental = DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->first();

            if (!$rental) {
                return response()->json(['error' => 'Rental property not found'], 404);
            }

            // Get or create property seeker profile
            $seeker = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if (!$seeker) {
                // Auto-create basic profile
                $seekerId = DB::table('property_seekers')->insertGetId([
                    'user_id' => $user->id,
                    'seeker_type' => 'renter',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $seekerId = $seeker->id;
            }

            $data = $request->validate([
                'inquiry_message' => 'required|string|max:1000',
            ]);

            // Calculate priority score based on seeker profile
            $priorityScore = $this->calculatePriorityScore($seekerId);

            // Create inquiry
            $inquiryId = DB::table('rental_inquiries')->insertGetId([
                'rental_property_id' => $rentalPropertyId,
                'property_seeker_id' => $seekerId,
                'landlord_user_id' => $rental->landlord_user_id,
                'inquiry_message' => $data['inquiry_message'],
                'priority_score' => $priorityScore,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Increment inquiry count on rental
            DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->increment('inquiry_count');

            // Track in matches
            DB::table('ai_property_matches')
                ->where('property_seeker_id', $seekerId)
                ->where('rental_property_id', $rentalPropertyId)
                ->update([
                    'match_status' => 'inquired',
                    'inquired_at' => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Inquiry sent successfully',
                'inquiry_id' => $inquiryId,
                'priority_score' => $priorityScore,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to send inquiry',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all inquiries for landlord's properties
     */
    public function getLandlordInquiries(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $status = $request->get('status', null);

            $query = DB::table('rental_inquiries')
                ->where('landlord_user_id', $user->id)
                ->join('property_seekers', 'rental_inquiries.property_seeker_id', '=', 'property_seekers.id')
                ->join('users', 'property_seekers.user_id', '=', 'users.id')
                ->select('rental_inquiries.*', 'users.name', 'users.email', 'users.avatar', 'property_seekers.seeker_type');

            if ($status) {
                $query->where('rental_inquiries.status', $status);
            }

            $inquiries = $query
                ->orderByDesc('rental_inquiries.priority_score')
                ->orderByDesc('rental_inquiries.created_at')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'count' => $inquiries->total(),
                'data' => $inquiries->items(),
                'pagination' => [
                    'current_page' => $inquiries->currentPage(),
                    'per_page' => $inquiries->perPage(),
                    'last_page' => $inquiries->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch inquiries',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get inquiries sent by a seeker
     */
    public function getSeekerInquiries(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $seeker = DB::table('property_seekers')
                ->where('user_id', $user->id)
                ->first();

            if (!$seeker) {
                return response()->json(['error' => 'Seeker profile not found'], 404);
            }

            $inquiries = DB::table('rental_inquiries')
                ->where('property_seeker_id', $seeker->id)
                ->join('rental_properties', 'rental_inquiries.rental_property_id', '=', 'rental_properties.id')
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->select('rental_inquiries.*', 'properties.title', 'properties.thumbnail_image', 'rental_properties.monthly_rent')
                ->orderByDesc('rental_inquiries.created_at')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'count' => $inquiries->total(),
                'data' => $inquiries->items(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch inquiries',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update inquiry status
     */
    public function updateInquiryStatus(Request $request, $inquiryId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $inquiry = DB::table('rental_inquiries')
                ->where('id', $inquiryId)
                ->first();

            if (!$inquiry || $inquiry->landlord_user_id !== $user->id) {
                return response()->json(['error' => 'Inquiry not found or unauthorized'], 404);
            }

            $data = $request->validate([
                'status' => 'required|in:pending,interested,rejected,scheduled,accepted',
                'landlord_response' => 'nullable|string|max:2000',
                'scheduled_tour_at' => 'nullable|date',
            ]);

            $update = [
                'status' => $data['status'],
                'responded_at' => now(),
                'updated_at' => now(),
            ];

            if ($data['landlord_response'] ?? false) {
                $update['landlord_response'] = $data['landlord_response'];
            }

            if ($data['scheduled_tour_at'] ?? false) {
                $update['scheduled_tour_at'] = $data['scheduled_tour_at'];
            }

            DB::table('rental_inquiries')
                ->where('id', $inquiryId)
                ->update($update);

            return response()->json([
                'success' => true,
                'message' => 'Inquiry status updated',
                'status' => $data['status'],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to update inquiry',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get inquiry details
     */
    public function getInquiryDetails($inquiryId): \Illuminate\Http\JsonResponse
    {
        try {
            $inquiry = DB::table('rental_inquiries')
                ->where('id', $inquiryId)
                ->join('property_seekers', 'rental_inquiries.property_seeker_id', '=', 'property_seekers.id')
                ->join('rental_properties', 'rental_inquiries.rental_property_id', '=', 'rental_properties.id')
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->join('users', 'rental_inquiries.landlord_user_id', '=', 'users.id')
                ->select(
                    'rental_inquiries.*',
                    'properties.title',
                    'properties.thumbnail_image',
                    'rental_properties.monthly_rent',
                    'users.name as landlord_name',
                    'users.email as landlord_email'
                )
                ->first();

            if (!$inquiry) {
                return response()->json(['error' => 'Inquiry not found'], 404);
            }

            return response()->json([
                'success' => true,
                'inquiry' => $inquiry,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch inquiry',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calculate priority score for inquiry
     * Based on seeker profile completeness and history
     */
    private function calculatePriorityScore($seekerId): int
    {
        $seeker = DB::table('property_seekers')
            ->where('id', $seekerId)
            ->first();

        if (!$seeker) {
            return 0;
        }

        $score = 50; // Base score

        // Add points for profile completion
        $score += ($seeker->profile_completion_percentage ?? 0) / 2;

        // Add points for history
        $matchHistory = DB::table('ai_property_matches')
            ->where('property_seeker_id', $seekerId)
            ->count();

        $score += min(25, $matchHistory * 2);

        return intval(min(100, $score));
    }
}
