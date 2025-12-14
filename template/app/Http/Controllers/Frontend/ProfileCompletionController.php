<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\ProfileCompletionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class ProfileCompletionController extends Controller
{
    public function __construct(
        protected ProfileCompletionService $completionService
    ) {
        $this->middleware('auth');
    }

    /**
     * Get profile completion data
     */
    public function index(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $completion = $this->completionService->getCompletionPercentage($candidate);
        $suggestions = $this->completionService->getSuggestions($candidate);
        $benefits = $this->completionService->getCompletionBenefits($completion['percentage']);

        return view('frontend.candidate-dashboard.profile-completion.index', compact(
            'completion',
            'suggestions',
            'benefits'
        ));
    }

    /**
     * Get completion status as JSON (for widgets)
     */
    public function status(): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return response()->json(['error' => 'Candidate not found'], 404);
        }

        $completion = $this->completionService->getCompletionPercentage($candidate);
        $suggestions = $this->completionService->getSuggestions($candidate);

        return response()->json([
            'percentage' => $completion['percentage'],
            'level' => $completion['level'],
            'suggestions' => array_slice($suggestions, 0, 3), // Top 3 for widget
        ]);
    }

    /**
     * Get AI skill suggestions
     */
    public function suggestSkills(Request $request): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return response()->json(['error' => 'Candidate not found'], 404);
        }

        $limit = $request->input('limit', 10);
        $skills = $this->completionService->suggestSkills($candidate, $limit);

        return response()->json(['skills' => $skills]);
    }

    /**
     * Get AI bio suggestions
     */
    public function suggestBio(): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return response()->json(['error' => 'Candidate not found'], 404);
        }

        $suggestions = $this->completionService->suggestBio($candidate);

        return response()->json(['suggestions' => $suggestions]);
    }
}

