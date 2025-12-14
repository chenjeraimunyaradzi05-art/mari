<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\AdvancedSearchService;
use Illuminate\Http\Request;

final class AdvancedSearchController extends Controller
{
    protected $searchService;

    public function __construct(AdvancedSearchService $searchService)
    {
        $this->searchService = $searchService;
    }

    /**
     * Display advanced search page
     *
     * @param Request $request
     * @return \Illuminate\View\View
     */
    public function index(Request $request)
    {
        $type = $request->input('type', 'jobs'); // jobs, candidates, companies

        return view('frontend.search.index', [
            'type' => $type,
            'filters' => $request->all()
        ]);
    }

    /**
     * Perform search and return results
     *
     * @param Request $request
     * @return \Illuminate\View\View|\Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        $type = $request->input('type', 'jobs');
        $filters = $request->except(['type', 'page']);

        // Perform search based on type
        switch ($type) {
            case 'jobs':
                $results = $this->searchService->searchJobs($filters);
                break;
            case 'candidates':
                $results = $this->searchService->searchCandidates($filters);
                break;
            case 'companies':
                $results = $this->searchService->searchCompanies($filters);
                break;
            default:
                $results = collect([]);
        }

        // Track search if there's a query
        if (!empty($filters['search'])) {
            $this->searchService->trackSearch(
                auth()->id(),
                $filters['search'],
                $type,
                $results->total()
            );
        }

        // Return JSON for AJAX requests
        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'results' => $results->items(),
                'pagination' => [
                    'total' => $results->total(),
                    'per_page' => $results->perPage(),
                    'current_page' => $results->currentPage(),
                    'last_page' => $results->lastPage(),
                    'from' => $results->firstItem(),
                    'to' => $results->lastItem(),
                ],
                'facets' => $this->searchService->getFacets($type, $filters)
            ]);
        }

        // Return view for regular requests
        return view('frontend.search.results', [
            'type' => $type,
            'results' => $results,
            'filters' => $filters,
            'facets' => $this->searchService->getFacets($type, $filters)
        ]);
    }

    /**
     * Get faceted search data (filter counts)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getFacets(Request $request)
    {
        $type = $request->input('type', 'jobs');
        $filters = $request->except(['type']);

        $facets = $this->searchService->getFacets($type, $filters);

        return response()->json([
            'success' => true,
            'facets' => $facets
        ]);
    }

    /**
     * Get autocomplete suggestions
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function autocomplete(Request $request)
    {
        $request->validate([
            'type' => 'required|in:jobs,skills,locations,companies',
            'term' => 'required|string|min:2'
        ]);

        $suggestions = $this->searchService->getAutocompleteSuggestions(
            $request->type,
            $request->term,
            $request->input('limit', 10)
        );

        return response()->json([
            'success' => true,
            'suggestions' => $suggestions
        ]);
    }

    /**
     * Save search for later
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function saveSearch(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'filters' => 'required|array'
        ]);

        $user = auth()->user();
        $userType = $user instanceof \App\Models\Candidate ? 'candidate' : 'company';

        $this->searchService->saveSearch(
            $user->id,
            $userType,
            $request->filters,
            $request->name
        );

        return response()->json([
            'success' => true,
            'message' => 'Search saved successfully!'
        ]);
    }

    /**
     * Get saved searches
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse|\Illuminate\View\View
     */
    public function getSavedSearches(Request $request)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $user = auth()->user();
        $userType = $user instanceof \App\Models\Candidate ? 'candidate' : 'company';

        $searches = $this->searchService->getSavedSearches($user->id, $userType);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'searches' => $searches
            ]);
        }

        return view('frontend.search.saved', [
            'searches' => $searches
        ]);
    }

    /**
     * Delete saved search
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteSavedSearch(Request $request, int $id)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $this->searchService->deleteSavedSearch($id, auth()->id());

        return response()->json([
            'success' => true,
            'message' => 'Search deleted successfully!'
        ]);
    }

    /**
     * Get search history
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSearchHistory(Request $request)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $history = $this->searchService->getSearchHistory(
            auth()->id(),
            $request->input('limit', 10)
        );

        return response()->json([
            'success' => true,
            'history' => $history
        ]);
    }

    /**
     * Get popular searches
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPopularSearches(Request $request)
    {
        $type = $request->input('type', 'jobs');

        $popular = $this->searchService->getPopularSearches(
            $type,
            $request->input('limit', 10)
        );

        return response()->json([
            'success' => true,
            'popular' => $popular
        ]);
    }

    /**
     * Clear search history
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function clearHistory(Request $request)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        \DB::table('search_history')
            ->where('user_id', auth()->id())
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Search history cleared!'
        ]);
    }
}

