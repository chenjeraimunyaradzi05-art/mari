<?php
namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\AICacheService;
use App\Services\AIErrorHandler;
use App\Services\CareerInsightsService;
use App\Services\JobMatchingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class CandidateAnalyticsController extends Controller
{
    protected CareerInsightsService $careerInsightsService;
    protected JobMatchingService $jobMatchingService;
    protected AICacheService $cacheService;
    protected AIErrorHandler $errorHandler;

    public function __construct(
        CareerInsightsService $careerInsightsService,
        JobMatchingService $jobMatchingService,
        AICacheService $cacheService,
        AIErrorHandler $errorHandler
    ) {
        $this->careerInsightsService = $careerInsightsService;
        $this->jobMatchingService = $jobMatchingService;
        $this->cacheService = $cacheService;
        $this->errorHandler = $errorHandler;
    }

    public function index(Request $request): \Illuminate\Http\RedirectResponse|\Illuminate\Contracts\View\View
    {
        $user = Auth::user();
        $candidate = $user->candidate;

        if (!$candidate) {
            return redirect()->route('member.profile.index')
                ->with('error', 'Please complete your profile to view analytics');
        }

        try {
            // Track usage
            $this->errorHandler->logUsage('analytics_view', $user->id, [
                'candidate_id' => $candidate->id,
                'profile_score' => $candidate->getComprehensiveProfileScore(),
            ]);

            // Get profile views data (last 7 days) - No caching (real-time data)
            $profileViews = $this->careerInsightsService->getProfileViews($candidate);

            // Get engagement stats - No caching (real-time data)
            $engagement = $this->careerInsightsService->getEngagementStats($candidate);

            // Get job application stats - No caching (real-time data)
            $jobStats = $this->careerInsightsService->getJobApplicationStats($candidate);

            // Get AI-powered insights - Use cache
            $aiAnalytics = $this->cacheService->getCareerInsights($candidate->id, function() use ($user, $candidate) {
                return $this->generateAIInsights($user, $candidate);
            });

            return view('frontend.candidate-dashboard.analytics', compact(
                'profileViews',
                'engagement',
                'jobStats',
                'aiAnalytics',
                'candidate'
            ));
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'CandidateAnalyticsController', [
                'user_id' => $user->id,
                'candidate_id' => $candidate->id,
            ]);

            return redirect()->route('member.dashboard')
                ->with('error', 'Unable to load analytics. Please try again later.');
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: string, 2?: string, 3?: 'Add more skills to your profile. Candidates with 5+ skills get 40% more job matches.'|'Add your work experience to increase your profile credibility and attract recruiters.', 4?: 'Add your work experience to increase your profile credibility and attract recruiters.'}
     */
    private function generateAIInsights(\Illuminate\Contracts\Auth\Authenticatable|null $user, $candidate): array
    {
        $insights = [];

        // Profile completion insight
        $profileScore = $candidate->getComprehensiveProfileScore();
        if ($profileScore < 100) {
            $insights[] = "Your profile is {$profileScore}% complete. Complete it for 3x more visibility!";
        }

        // Video profile insight
        if (!$candidate->hasCompletedVideoProfile()) {
            $insights[] = "Add a video profile to stand out! Profiles with videos get 5x more views.";
        }

        // Job match insight
        try {
            $matches = $this->jobMatchingService->findMatchingJobs($candidate, 5, 70.0);
            $matchCount = $matches->count();
            if ($matchCount > 0) {
                $insights[] = "You have {$matchCount} high-quality job matches waiting for you!";
            }
        } catch (\Exception $e) {
            // Silently handle if matching fails
        }

        // Skills insight
        $skillCount = $candidate->skills()->count();
        if ($skillCount < 5) {
            $insights[] = "Add more skills to your profile. Candidates with 5+ skills get 40% more job matches.";
        }

        // Experience insight
        $expCount = $candidate->experiences()->count();
        if ($expCount < 1) {
            $insights[] = "Add your work experience to increase your profile credibility and attract recruiters.";
        }

        // Default insights if none generated
        if (empty($insights)) {
            $insights[] = "Your profile looks great! Keep applying to jobs that match your skills.";
            $insights[] = "Check out our Career Insights page for personalized recommendations.";
        }

        return $insights;
    }
}

