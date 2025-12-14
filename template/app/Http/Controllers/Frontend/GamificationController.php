<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\GamificationService;
use App\Models\Badge;
use App\Models\Challenge;
use App\Models\CandidateBadge;
use App\Models\CandidateChallenge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

final class GamificationController extends Controller
{
    protected $gamificationService;

    public function __construct(GamificationService $gamificationService)
    {
        $this->middleware('auth');
        $this->gamificationService = $gamificationService;
    }

    /**
     * Display gamification dashboard
     */
    public function index(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $stats = $this->gamificationService->getCandidateStats($candidate);
        $recentActivity = $this->gamificationService->getRecentActivity($candidate, 5);
        $leaderboard = $this->gamificationService->getLeaderboard('all_time', 5);

        return view('frontend.candidate-dashboard.gamification.index', compact(
            'stats',
            'recentActivity',
            'leaderboard'
        ));
    }

    /**
     * Display leaderboard
     */
    public function leaderboard(Request $request): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $type = $request->input('type', 'all_time');
        $leaderboard = $this->gamificationService->getLeaderboard($type, 50);
        $myStats = $this->gamificationService->getCandidateStats($candidate);

        return view('frontend.candidate-dashboard.gamification.leaderboard', compact(
            'leaderboard',
            'myStats',
            'type'
        ));
    }

    /**
     * Display badges/achievements
     */
    public function achievements(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $earnedBadges = CandidateBadge::where('candidate_id', $candidate->id)
            ->with('badge')
            ->orderByDesc('earned_at')
            ->get();

        $earnedBadgeIds = $earnedBadges->pluck('badge_id')->toArray();

        $availableBadgesQuery = Badge::active()
            ->whereNotIn('id', $earnedBadgeIds);

        if (Schema::hasColumn('badges', 'rarity')) {
            $availableBadgesQuery->orderBy('rarity', 'desc');
        }

        if (Schema::hasColumn('badges', 'category')) {
            $availableBadgesQuery->orderBy('category');
        }

        $availableBadges = $availableBadgesQuery->get();

        return view('frontend.candidate-dashboard.gamification.achievements', compact(
            'earnedBadges',
            'availableBadges'
        ));
    }

    /**
     * Toggle badge showcase
     */
    public function toggleBadgeShowcase(CandidateBadge $badge): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $badge->candidate_id !== $candidate->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $badge->update(['is_showcased' => !$badge->is_showcased]);

        return response()->json([
            'success' => true,
            'showcased' => $badge->is_showcased,
        ]);
    }

    /**
     * Display challenges
     */
    public function challenges(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return redirect()->route('member.dashboard')->with('error', 'Candidate profile not found.');
        }

        $activeChallenges = CandidateChallenge::where('candidate_id', $candidate->id)
            ->where('status', 'in_progress')
            ->with('challenge')
            ->get();

        $completedChallenges = CandidateChallenge::where('candidate_id', $candidate->id)
            ->where('status', 'completed')
            ->with('challenge')
            ->orderByDesc('completed_at')
            ->take(10)
            ->get();

        $participatingChallengeIds = CandidateChallenge::where('candidate_id', $candidate->id)
            ->whereIn('status', ['in_progress', 'completed'])
            ->pluck('challenge_id')
            ->toArray();

        $availableChallenges = Challenge::active()
            ->whereNotIn('id', $participatingChallengeIds)
            ->orderBy('difficulty')
            ->orderBy('type')
            ->get();

        return view('frontend.candidate-dashboard.gamification.challenges', compact(
            'activeChallenges',
            'completedChallenges',
            'availableChallenges'
        ));
    }

    /**
     * Join a challenge
     */
    public function joinChallenge(Challenge $challenge): \Illuminate\Http\JsonResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            return response()->json(['error' => 'Candidate profile not found.'], 404);
        }

        if (!$challenge->isActiveNow()) {
            return response()->json(['error' => 'Challenge is not active.'], 400);
        }

        try {
            $candidateChallenge = $this->gamificationService->startChallenge($candidate, $challenge);

            return response()->json([
                'success' => true,
                'message' => 'Successfully joined the challenge!',
                'challenge' => $candidateChallenge,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to join challenge.'], 500);
        }
    }
}


