<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\InterviewQuestion;
use App\Models\InterviewSession;
use App\Models\InterviewQuestionTopic;
use App\Models\JobCategory;
use App\Models\JobRole;
use App\Services\InterviewCoachService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class InterviewCoachController extends Controller
{
    public function __construct(
        protected InterviewCoachService $coachService
    ) {
        $this->middleware('auth');
    }

    /**
     * Show interview coach dashboard
     */
    public function index(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $stats = $this->coachService->getCandidateStats($candidate);
        $recentSessions = InterviewSession::where('candidate_id', $candidate->id)
            ->latest()
            ->limit(5)
            ->get();

        return view('frontend.candidate-dashboard.interview-coach.index', compact('stats', 'recentSessions'));
    }

    /**
     * Show new session setup
     */
    public function create(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $categories = JobCategory::active()->get();
        $roles = JobRole::active()->get();
        $topics = InterviewQuestionTopic::active()->get();

        return view('frontend.candidate-dashboard.interview-coach.create', compact('categories', 'roles', 'topics'));
    }

    /**
     * Start new practice session
     */
    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $validated = $request->validate([
            'session_type' => 'required|in:quick_practice,full_mock,focused_topic,custom',
            'difficulty' => 'required|in:entry,mid,senior,executive',
            'job_category_id' => 'nullable|exists:job_categories,id',
            'job_role_id' => 'nullable|exists:job_roles,id',
            'topics' => 'nullable|array',
            'topics.*' => 'exists:interview_question_topics,id',
            'question_count' => 'nullable|integer|min:1|max:20',
            'question_types' => 'nullable|array',
        ]);

        // Create session
        $session = $this->coachService->createSession(
            $candidate,
            $validated['session_type'],
            $validated['difficulty'],
            $validated['job_category_id'] ?? null,
            $validated['job_role_id'] ?? null,
            $validated['topics'] ?? null,
            $validated['question_count'] ?? 5
        );

        return redirect()->route('member.interview-coach.practice', $session->id);
    }

    /**
     * Show practice session
     */
    public function practice(InterviewSession $session): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $session->candidate_id !== $candidate->id) {
            abort(403);
        }

        // Get questions for this session
        $questions = $this->coachService->getQuestionsForSession($session);

        // Get current question index
        $currentIndex = $session->answered_questions;

        if ($currentIndex >= $questions->count()) {
            // All questions answered, complete session
            $this->coachService->completeSession($session);
            return redirect()->route('member.interview-coach.feedback', $session->id);
        }

        $currentQuestion = $questions[$currentIndex];

        return view('frontend.candidate-dashboard.interview-coach.practice', compact(
            'session',
            'questions',
            'currentQuestion',
            'currentIndex'
        ));
    }

    /**
     * Submit answer for current question
     */
    public function submitAnswer(Request $request, InterviewSession $session): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $session->candidate_id !== $candidate->id) {
            abort(403);
        }

        $validated = $request->validate([
            'question_id' => 'required|exists:interview_questions,id',
            'answer' => 'required|string|min:10',
            'time_taken' => 'required|integer|min:1',
        ]);

        $question = InterviewQuestion::findOrFail($validated['question_id']);

        // Submit answer and get feedback
        $answer = $this->coachService->submitAnswer(
            $session,
            $question,
            $validated['answer'],
            $validated['time_taken']
        );

        return response()->json([
            'success' => true,
            'answer_id' => $answer->id,
            'score' => $answer->score,
            'feedback' => [
                'score' => $answer->score,
                'score_badge' => $answer->score_badge,
                'strengths' => $answer->strengths,
                'weaknesses' => $answer->weaknesses,
                'improvement_tip' => $answer->improvement_tip,
                'metrics' => $answer->performance_metrics,
            ],
            'progress' => [
                'answered' => $session->fresh()->answered_questions,
                'total' => $session->total_questions,
                'percentage' => $session->fresh()->completion_percentage,
            ],
        ]);
    }

    /**
     * Show session feedback
     */
    public function feedback(InterviewSession $session): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $session->candidate_id !== $candidate->id) {
            abort(403);
        }

        if ($session->status !== 'completed') {
            return redirect()->route('member.interview-coach.practice', $session->id);
        }

        $answers = $session->answers()->with('question')->get();

        return view('frontend.candidate-dashboard.interview-coach.feedback', compact('session', 'answers'));
    }

    /**
     * Show session history
     */
    public function history(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $sessions = InterviewSession::where('candidate_id', $candidate->id)
            ->with(['jobCategory', 'jobRole'])
            ->latest()
            ->paginate(10);

        return view('frontend.candidate-dashboard.interview-coach.history', compact('sessions'));
    }

    /**
     * Delete session
     */
    public function destroy(InterviewSession $session): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $session->candidate_id !== $candidate->id) {
            abort(403);
        }

        $session->delete();

        return redirect()->route('member.interview-coach.history')
            ->with('success', 'Practice session deleted successfully!');
    }
}

