<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use Illuminate\Http\Request;
use App\Models\CandidateLanguage;
use App\Models\CandidateSkill;
use Illuminate\Support\Facades\Validator;

final class CandidateController extends Controller
{
    /**
     * List all candidates with filters
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $query = Candidate::with([
            'user:id,name,email',
            'profession:id,name',
            'experience:id,name',
            'skills:id,name',
            'languages:id,name',
            'country:id,name',
            'state:id,name',
            'city:id,name'
        ])->where('status', 1);

        // Apply filters
        if ($request->has('profession_id')) {
            $query->where('profession_id', $request->profession_id);
        }

        if ($request->has('experience_id')) {
            $query->where('experience_id', $request->experience_id);
        }

        if ($request->has('country_id')) {
            $query->where('country_id', $request->country_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->whereHas('user', function($uq) use ($search) {
                    $uq->where('name', 'like', "%{$search}%");
                })
                ->orWhere('title', 'like', "%{$search}%")
                ->orWhere('bio', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('per_page', 15);
        $candidates = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $candidates
        ], 200);
    }

    /**
     * Get candidate profile
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $candidate = Candidate::with([
            'user:id,name,email',
            'profession:id,name',
            'experience:id,name',
            'skills:id,name',
            'languages:id,name',
            'educations',
            'experiences',
            'country:id,name',
            'state:id,name',
            'city:id,name'
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $candidate
        ], 200);
    }

    /**
     * Update candidate profile (own profile only)
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);

        // Check authorization
        // Allow both canonical 'member' and legacy 'candidate' role values to manage candidate profiles.
        if (! in_array($request->user()->role, ['candidate', 'member'], true) || $candidate->user_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'string|max:255',
            'profession_id' => 'exists:professions,id',
            'experience_id' => 'exists:experiences,id',
            'website' => 'nullable|url|max:255',
            'bio' => 'nullable|string',
            'marital_status' => 'nullable|in:single,married',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'country_id' => 'exists:countries,id',
            'state_id' => 'nullable|exists:states,id',
            'city_id' => 'nullable|exists:cities,id',
            'address' => 'nullable|string|max:500',
            'skills' => 'array',
            'skills.*' => 'exists:skills,id',
            'languages' => 'array',
            'languages.*' => 'exists:languages,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $candidate->update($request->only([
                'title', 'profession_id', 'experience_id', 'website', 'bio',
                'marital_status', 'birth_date', 'gender', 'country_id',
                'state_id', 'city_id', 'address'
            ]));

            // Update relationships (skills & languages are stored as hasMany CandidateSkill/CandidateLanguage)
            if ($request->has('skills')) {
                CandidateSkill::where('candidate_id', $candidate->id)->delete();
                foreach ((array) $request->input('skills') as $skillId) {
                    CandidateSkill::create([ 'candidate_id' => $candidate->id, 'skill_id' => $skillId ]);
                }
            }

            if ($request->has('languages')) {
                CandidateLanguage::where('candidate_id', $candidate->id)->delete();
                foreach ((array) $request->input('languages') as $languageId) {
                    CandidateLanguage::create([ 'candidate_id' => $candidate->id, 'language_id' => $languageId ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'data' => $candidate->load(['profession', 'experience', 'skills', 'languages'])
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Profile update failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}

