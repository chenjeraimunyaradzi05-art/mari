<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * RentalListingController
 *
 * Manage rental property listings, inquiries, and tenant interactions
 */
final class RentalListingController extends Controller
{
    /**
     * Create a rental listing for a property
     */
    public function createRentalListing(Request $request, $propertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            // Validate property exists and belongs to user
            $property = DB::table('properties')
                ->where('id', $propertyId)
                ->where('user_id', $user->id)
                ->first();

            if (!$property) {
                return response()->json(['error' => 'Property not found or unauthorized'], 404);
            }

            $data = $request->validate([
                'monthly_rent' => 'required|numeric|min:0',
                'security_deposit' => 'nullable|numeric|min:0',
                'furnishing' => 'required|in:unfurnished,partially_furnished,furnished',
                'lease_term' => 'required|in:monthly,quarterly,semi-annual,annual,flexible',
                'min_lease_months' => 'integer|min:1|default:12',
                'max_lease_months' => 'nullable|integer|min:1',
                'available_from' => 'required|date',
                'available_until' => 'nullable|date|after:available_from',
                'house_rules' => 'nullable|string|max:2000',
                'allows_pets' => 'boolean|default:false',
                'allows_smoking' => 'boolean|default:false',
                'allows_visitors' => 'boolean|default:true',
                'max_occupants' => 'nullable|integer|min:1',
                'utilities_included' => 'nullable|json',
            ]);

            // Check if rental already exists
            $existing = DB::table('rental_properties')
                ->where('property_id', $propertyId)
                ->first();

            if ($existing) {
                // Update existing
                DB::table('rental_properties')
                    ->where('id', $existing->id)
                    ->update(array_merge($data, ['updated_at' => now()]));

                $rentalId = $existing->id;
            } else {
                // Create new
                $rentalId = DB::table('rental_properties')->insertGetId(array_merge($data, [
                    'property_id' => $propertyId,
                    'landlord_user_id' => $user->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }

            return response()->json([
                'success' => true,
                'message' => 'Rental listing created/updated successfully',
                'rental_property_id' => $rentalId,
                'property_id' => $propertyId,
                'rental_data' => $data,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to create rental listing',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get rental listing details
     */
    public function getRentalListing($rentalPropertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $rental = DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->where('is_active', true)
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->select('rental_properties.*', 'properties.title', 'properties.thumbnail_image',
                         'properties.number_of_bedroom', 'properties.number_of_bathroom', 'properties.area')
                ->first();

            if (!$rental) {
                return response()->json(['error' => 'Rental not found'], 404);
            }

            // Get landlord info
            $landlord = DB::table('users')
                ->where('id', $rental->landlord_user_id)
                ->select('id', 'name', 'email', 'avatar')
                ->first();

            // Get recent inquiries count
            $inquiries = DB::table('rental_inquiries')
                ->where('rental_property_id', $rentalPropertyId)
                ->where('status', 'pending')
                ->count();

            return response()->json([
                'success' => true,
                'rental' => $rental,
                'landlord' => $landlord,
                'pending_inquiries' => $inquiries,
                'ai_preferences' => $rental->ai_preferences ? json_decode($rental->ai_preferences) : null,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch rental listing',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all rental listings for landlord
     */
    public function getLandlordListings(): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $rentals = DB::table('rental_properties')
                ->where('landlord_user_id', $user->id)
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->select('rental_properties.*', 'properties.title', 'properties.thumbnail_image')
                ->orderByDesc('rental_properties.created_at')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'count' => $rentals->total(),
                'data' => $rentals->items(),
                'pagination' => [
                    'current_page' => $rentals->currentPage(),
                    'per_page' => $rentals->perPage(),
                    'last_page' => $rentals->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch listings',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Search rental properties
     */
    public function searchRentals(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $data = $request->validate([
                'min_price' => 'nullable|numeric|min:0',
                'max_price' => 'nullable|numeric|min:0',
                'furnishing' => 'nullable|in:unfurnished,partially_furnished,furnished',
                'min_bedrooms' => 'nullable|integer|min:0',
                'max_bedrooms' => 'nullable|integer|min:0',
                'allows_pets' => 'nullable|boolean',
                'city_id' => 'nullable|integer',
                'available_from' => 'nullable|date',
                'lease_term' => 'nullable|in:monthly,quarterly,semi-annual,annual,flexible',
            ]);

            $query = DB::table('rental_properties')
                ->where('is_active', true)
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id');

            if ($data['min_price'] ?? false) {
                $query->where('monthly_rent', '>=', $data['min_price']);
            }

            if ($data['max_price'] ?? false) {
                $query->where('monthly_rent', '<=', $data['max_price']);
            }

            if ($data['furnishing'] ?? false) {
                $query->where('furnishing', $data['furnishing']);
            }

            if ($data['min_bedrooms'] ?? false) {
                $query->where('properties.number_of_bedroom', '>=', $data['min_bedrooms']);
            }

            if ($data['allows_pets'] ?? false) {
                $query->where('allows_pets', true);
            }

            if ($data['city_id'] ?? false) {
                $query->where('properties.city_id', $data['city_id']);
            }

            if ($data['available_from'] ?? false) {
                $query->where('available_from', '<=', $data['available_from']);
            }

            $results = $query
                ->select('rental_properties.*', 'properties.title', 'properties.thumbnail_image')
                ->orderByDesc('rental_properties.views_count')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'count' => $results->total(),
                'data' => $results->items(),
                'pagination' => [
                    'current_page' => $results->currentPage(),
                    'per_page' => $results->perPage(),
                    'last_page' => $results->lastPage(),
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Search failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get trending rental properties
     */
    public function getTrendingRentals(): \Illuminate\Http\JsonResponse
    {
        try {
            $trending = DB::table('rental_properties')
                ->where('is_active', true)
                ->join('properties', 'rental_properties.property_id', '=', 'properties.id')
                ->select('rental_properties.*', 'properties.title', 'properties.thumbnail_image')
                ->orderByDesc('rental_properties.views_count')
                ->limit(20)
                ->get();

            return response()->json([
                'success' => true,
                'count' => count($trending),
                'data' => $trending,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to fetch trending rentals',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Record view on rental property
     */
    public function recordRentalView($rentalPropertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $rental = DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->first();

            if (!$rental) {
                return response()->json(['error' => 'Rental not found'], 404);
            }

            DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->increment('views_count');

            return response()->json([
                'success' => true,
                'views' => $rental->views_count + 1,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to record view',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete rental listing
     */
    public function deleteRentalListing($rentalPropertyId): \Illuminate\Http\JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $rental = DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->where('landlord_user_id', $user->id)
                ->first();

            if (!$rental) {
                return response()->json(['error' => 'Rental not found or unauthorized'], 404);
            }

            DB::table('rental_properties')
                ->where('id', $rentalPropertyId)
                ->delete();

            return response()->json([
                'success' => true,
                'message' => 'Rental listing deleted',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to delete rental',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
