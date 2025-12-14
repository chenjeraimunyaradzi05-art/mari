<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class CandidateController extends Controller
{
    /**
     * Display a listing of candidates with optional filters
     */
    public function index(Request $request): View
    {
        $query = Candidate::with(['user', 'profession', 'experience', 'pronoun', 'country', 'state', 'city'])
            ->orderBy('created_at', 'DESC');

        // Apply filters based on request parameters
        if ($request->has('filter')) {
            switch ($request->filter) {
                case 'with_videos':
                    $query->where(function($q) {
                        $q->whereNotNull('profile_video_url')
                          ->orWhereNotNull('personality_video_url');
                    });
                    $filterTitle = 'Candidates with Videos';
                    break;

                case 'complete_videos':
                    $query->whereNotNull('profile_video_url')
                          ->whereNotNull('personality_video_url');
                    $filterTitle = 'Candidates with Complete Video Profiles';
                    break;

                case 'with_cv':
                    // Check if the relationship exists, otherwise use direct query
                    if (method_exists(Candidate::class, 'cvs')) {
                        $query->whereHas('cvs');
                    } else {
                        $query->whereNotNull('cv');
                    }
                    $filterTitle = 'Candidates with AI-Generated CVs';
                    break;

                case 'profile_analyzed':
                    $query->whereNotNull('profile_video_analysis');
                    $filterTitle = 'Candidates with Professional Video Analysis';
                    break;

                case 'personality_analyzed':
                    $query->whereNotNull('personality_video_analysis');
                    $filterTitle = 'Candidates with Personality Video Analysis';
                    break;

                default:
                    $filterTitle = 'All Candidates';
            }
        } else {
            $filterTitle = 'All Candidates';
        }

        // Apply sorting
        if ($request->has('sort')) {
            switch ($request->sort) {
                case 'profile_score':
                    // Sort by profile completeness (calculated on the fly)
                    $candidates = $query->get()->sortByDesc(function($candidate) {
                        return $candidate->getComprehensiveProfileScore();
                    });
                    $filterTitle = 'Candidates by Profile Completeness';
                    break;
            }
        }

        // Apply search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone_one', 'like', "%{$search}%")
                  ->orWhere('mobile', 'like', "%{$search}%");
            });
        }

        // Paginate results
        if (!isset($candidates)) {
            $candidates = $query->paginate(20);
        } else {
            // For sorted results, manually paginate
            $page = $request->get('page', 1);
            $perPage = 20;
            $offset = ($page - 1) * $perPage;
            $paginatedCandidates = $candidates->slice($offset, $perPage);

            $candidates = new \Illuminate\Pagination\LengthAwarePaginator(
                $paginatedCandidates,
                $candidates->count(),
                $perPage,
                $page,
                ['path' => $request->url(), 'query' => $request->query()]
            );
        }

        // Calculate statistics for the filtered set
        $stats = [
            'total' => $candidates->total(),
            'with_videos' => Candidate::where(function($q) {
                $q->whereNotNull('profile_video_url')
                  ->orWhereNotNull('personality_video_url');
            })->count(),
            'complete_profiles' => Candidate::where('profile_complete', 1)->count(),
            'avg_score' => round(Candidate::all()->avg(function($candidate) {
                return $candidate->getComprehensiveProfileScore();
            }), 1),
        ];

        return view('admin.candidate.index', compact('candidates', 'filterTitle', 'stats'));
    }

    /**
     * Display the specified candidate
     */
    public function show(Candidate $candidate): View
    {
        $candidate->load([
            'user',
            'profession',
            'experience',
            'pronoun',
            'ethnicity',
            'driverLicenseType',
            'maritalStatus',
            'religion',
            'country',
            'state',
            'city',
            'skills',
            'languages',
            'experiences',
            'educations',
            'cvs'
        ]);

        // Calculate profile score
        $profileScore = $candidate->getComprehensiveProfileScore();

        // Get AI insights if available
        $professionalInsights = $candidate->getProfessionalInsights();
        $personalityInsights = $candidate->getPersonalityInsights();

        return view('admin.candidate.show', compact(
            'candidate',
            'profileScore',
            'professionalInsights',
            'personalityInsights'
        ));
    }

    /**
     * Export candidates data (CSV/Excel)
     */
    public function export(Request $request): \Illuminate\Http\JsonResponse
    {
        // TODO: Implement export functionality
        return response()->json(['message' => 'Export functionality coming soon']);
    }

    /**
     * Toggle candidate visibility
     */
    public function toggleVisibility(Candidate $candidate): \Illuminate\Http\JsonResponse
    {
        $candidate->visibility = !$candidate->visibility;
        $candidate->save();

        return response()->json([
            'success' => true,
            'visibility' => $candidate->visibility
        ]);
    }

    /**
     * Delete candidate
     */
    public function destroy(Candidate $candidate): \Illuminate\Http\RedirectResponse
    {
        $candidate->user()->delete(); // Cascade delete user

        return redirect()->route('admin.candidates.index')
            ->with('success', 'Candidate deleted successfully');
    }
}

