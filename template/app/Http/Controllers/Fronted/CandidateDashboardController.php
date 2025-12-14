<?php

namespace App\Http\Controllers\Fronted;

use App\Http\Controllers\Controller;
use App\Models\AppliedJob;
use App\Models\CareerInterest;
use App\Models\JobBookmark;
use App\Models\User;
use App\Services\SocialDataBackboneService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Throwable;

final class CandidateDashboardController extends Controller
{


    function index() : View {
        $user = Auth::user();

        if (! $user instanceof User) {
            abort(403);
        }

        $jobAppliedCount = AppliedJob::where('candidate_id', $user->id)->count();
        $userBookmarksCount = JobBookmark::where('candidate_id', $user->candidateProfile?->id)->count();
        $appliedJobs = AppliedJob::with('job')->where('candidate_id', $user->id)->orderBy('id', 'DESC')->take(10)->get();

        // Fetch onboarding progress and badges
        $progress = \App\Models\Progress::where('user_id', $user->id)->get();
        $badges = \App\Models\Badge::where('user_id', $user->id)->get();

        // AI-powered job matching and career insights
        $aiJobMatches = [];
        $careerInsights = [];
        if ($user->candidateProfile) {
            $candidate = $user->candidateProfile;
            try {
                $aiJobMatches = app(\App\Services\JobMatchingService::class)->findMatchingJobs($candidate, 5, 60.0);
                $careerInsights = app(\App\Services\CareerInsightsService::class)->generateInsights($candidate);
            } catch (\Exception $e) {
                // Log error, but don't break dashboard
                Log::error('AI suggestion error: ' . $e->getMessage());
            }
        }

        $socialBackbone = null;
        $socialBackboneMeta = null;

        try {
            if ($user->socialProfile) {
                $socialBackbone = $this->socialDataBackbone->build($user);
                $socialBackboneMeta = $this->socialDataBackbone->getCacheMeta();
            }
        } catch (Throwable $throwable) {
            Log::warning('Failed to hydrate social backbone for dashboard', [
                'user_id' => $user->getKey(),
                'error' => $throwable->getMessage(),
            ]);
        }

        $dreamTelemetry = $this->buildDreamTelemetry($user);

        return view('frontend.candidate-dashboard.dashboard', compact(
            'jobAppliedCount',
            'userBookmarksCount',
            'appliedJobs',
            'progress',
            'badges',
            'aiJobMatches',
            'careerInsights',
            'socialBackbone',
            'socialBackboneMeta',
            'dreamTelemetry'
        ));
    }

    /**
     * @return (array|int|mixed|null|string)[]
     *
     * @psalm-return array{total: 0|mixed, active: 0|mixed, headline: string, match_count: int, last_ping: mixed|null, entries: array<never, never>|mixed}
     */
    private function buildDreamTelemetry(User $user): array
    {
        $interests = $user->careerInterests()
            ->orderByDesc('updated_at')
            ->get([
                'id',
                'title',
                'pathway_type',
                'preferred_location',
                'status',
                'match_count',
                'last_matched_at',
                'notify_in_app',
                'notify_email',
            ]);

        if ($interests->isEmpty()) {
            return [
                'total' => 0,
                'active' => 0,
                'headline' => 'Add a dream to begin',
                'match_count' => 0,
                'last_ping' => null,
                'entries' => [],
            ];
        }

        $active = $interests->where('status', 'active')->count();


        if ($active === 0) {
            $headline = 'All dreams are paused';
        } elseif ($active === 1) {
            $headline = '1 dream is waitlist-ready';
        } else {
            $headline = sprintf('%d dreams are waitlist-ready', $active);
        }

        $entries = $interests->take(3)
            ->map(function (CareerInterest $interest) {
                return [
                    'id' => $interest->id,
                    'title' => $interest->title ?: Str::headline(str_replace('_', ' ', $interest->pathway_type)),
                    'pathway_type' => $interest->pathway_type,
                    'status' => $interest->status,
                    'match_count' => (int) $interest->match_count,
                    'last_matched_at' => $interest->last_matched_at,
                    'preferred_location' => $interest->preferred_location,
                    'notify_in_app' => (bool) $interest->notify_in_app,
                    'notify_email' => (bool) $interest->notify_email,
                ];
            })
            ->values()
            ->all();

        return [
            'total' => $interests->count(),
            'active' => $active,
            'headline' => $headline,
            'match_count' => (int) $interests->sum('match_count'),
            'last_ping' => $interests->max('last_matched_at'),
            'entries' => $entries,
        ];
    }
}

