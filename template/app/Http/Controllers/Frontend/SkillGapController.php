<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\SkillGapService;
use App\Models\SkillGapAnalysis;
use App\Models\LearningResource;
use App\Models\CandidateLearningProgress;
use App\Models\Skill;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class SkillGapController extends Controller
{
    protected $skillGapService;

    public function __construct(SkillGapService $skillGapService)
    {
        $this->middleware('auth');
        $this->skillGapService = $skillGapService;
    }

    /**
     * Display skill gap analysis dashboard
     */
    public function index(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        // Get latest analysis
        $latestAnalysis = SkillGapAnalysis::forCandidate($candidate->id)
            ->orderByDesc('analysis_date')
            ->first();

        // Get learning stats
        $learningStats = $this->skillGapService->getLearningStats($candidate);

        // Get recommended resources
        $recommendedResources = $this->skillGapService->getRecommendedResources($candidate, 6);

        // Get recent progress
        $recentProgress = CandidateLearningProgress::forCandidate($candidate->id)
            ->with(['learningResource.skill', 'skill'])
            ->orderByDesc('updated_at')
            ->take(5)
            ->get();

        return view('frontend.candidate-dashboard.skill-gap.index', compact(
            'latestAnalysis',
            'learningStats',
            'recommendedResources',
            'recentProgress'
        ));
    }

    /**
     * Perform new skill gap analysis
     */
    public function analyze(): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        try {
            $this->skillGapService->analyzeSkillGaps($candidate);

            return redirect()->route('member.skill-gap.index')
                ->with('success', 'Skill gap analysis completed successfully!');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to analyze skill gaps. Please try again.');
        }
    }

    /**
     * Display learning paths
     */
    public function learningPaths(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $analysis = SkillGapAnalysis::forCandidate($candidate->id)
            ->orderByDesc('analysis_date')
            ->first();

        if (!$analysis) {
            return redirect()->route('member.skill-gap.index')
                ->with('info', 'Please run a skill gap analysis first.');
        }

        return view('frontend.candidate-dashboard.skill-gap.learning-paths', compact('analysis'));
    }

    /**
     * Display learning resources for a skill
     */
    public function resources(Request $request, $skillId): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $skill = Skill::findOrFail($skillId);

        // Get filters from request
        $filters = [
            'type' => $request->input('type'),
            'difficulty' => $request->input('difficulty'),
            'free' => $request->boolean('free'),
            'certified' => $request->boolean('certified'),
        ];

        $resources = $this->skillGapService->getLearningResources($skillId, array_filter($filters));

        // Get candidate's progress for these resources
        $progressData = CandidateLearningProgress::forCandidate($candidate->id)
            ->whereIn('learning_resource_id', $resources->pluck('id'))
            ->get()
            ->keyBy('learning_resource_id');

        return view('frontend.candidate-dashboard.skill-gap.resources', compact(
            'skill',
            'resources',
            'progressData',
            'filters'
        ));
    }

    /**
     * Start learning a resource
     */
    public function startLearning(LearningResource $resource): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return response()->json(['error' => 'Candidate profile not found.'], 404);
        }

        try {
            $progress = $this->skillGapService->startLearning($candidate, $resource);

            return response()->json([
                'success' => true,
                'message' => 'Learning started successfully!',
                'progress' => $progress,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to start learning.'], 500);
        }
    }

    /**
     * Update learning progress
     */
    public function updateProgress(Request $request, CandidateLearningProgress $progress): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $progress->candidate_id !== $candidate->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'progress_percentage' => 'required|integer|min:0|max:100',
            'time_spent' => 'nullable|integer|min:0',
        ]);

        try {
            $progress->updateProgress(
                $request->input('progress_percentage'),
                $request->input('time_spent', 0)
            );

            return response()->json([
                'success' => true,
                'message' => 'Progress updated successfully!',
                'progress' => $progress->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to update progress.'], 500);
        }
    }

    /**
     * Mark resource as completed
     */
    public function completeResource(CandidateLearningProgress $progress): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $progress->candidate_id !== $candidate->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            $progress->markAsCompleted();

            return response()->json([
                'success' => true,
                'message' => 'Congratulations on completing this resource!',
                'progress' => $progress->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to complete resource.'], 500);
        }
    }

    /**
     * Rate a learning resource
     */
    public function rateResource(Request $request, CandidateLearningProgress $progress): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $progress->candidate_id !== $candidate->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'rating' => 'required|numeric|min:1|max:5',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $progress->update([
                'rating' => $request->input('rating'),
                'notes' => $request->input('notes'),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Thank you for your feedback!',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to save rating.'], 500);
        }
    }

    /**
     * Display progress tracking
     */
    public function progress(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $allProgress = CandidateLearningProgress::forCandidate($candidate->id)
            ->with(['learningResource.skill', 'skill'])
            ->orderByDesc('updated_at')
            ->paginate(10);

        $stats = $this->skillGapService->getLearningStats($candidate);

        return view('frontend.candidate-dashboard.skill-gap.progress', compact('allProgress', 'stats'));
    }
}


