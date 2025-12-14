<?php

namespace App\Http\Controllers\TafeUniversity;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Models\TafeInstitution;
use App\Models\TafeProgram;
use App\Models\TafeProgramIntake;
use App\Models\TafeStudentJourney;
use App\Services\Education\TafeUniversityInsightService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

final class DashboardController extends Controller
{
    public function __invoke(Request $request, TafeUniversityInsightService $insightService): View
    {
        $user = $request->user();
        $user->loadMissing('tafeCareerProfile');

        $careerProfile = $user->tafeCareerProfile;

        $institution = $user->tafeInstitution()
            ->with([
                'programs' => fn ($query) => $query->with([
                    'intakes' => fn ($intakeQuery) => $intakeQuery->orderBy('start_date'),
                ]),
            ])
            ->first();

        $journeys = TafeStudentJourney::with(['program.institution'])
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(6)
            ->get();

        // Cache global spotlight programs (1 hour)
        $spotlightPrograms = Cache::remember('tafe.spotlight_programs', 3600, function () {
            return TafeProgram::with(['institution', 'intakes' => fn ($query) => $query->orderBy('start_date')])
                ->published()
                ->latest('updated_at')
                ->take(8)
                ->get();
        });

        // Ranking is fast (in-memory), no need to cache unless list is huge
        $rankedPrograms = $spotlightPrograms->map(function (TafeProgram $program) use ($insightService, $user) {
            $program->ai_match_score = $insightService->scoreProgram($user, $program);
            return $program;
        })->sortByDesc('ai_match_score')->values();

        $recommendations = $rankedPrograms->take(3);

        // Cache social highlights (30 mins) - heavy LIKE query
        $socialHighlights = Cache::remember('tafe.social_highlights', 1800, function () {
            return SocialPost::with(['profile', 'media'])
                ->public()
                ->visible()
                ->where(function ($query) {
                    $query->where('tags', 'like', '%tafe%')
                        ->orWhere('tags', 'like', '%university%')
                        ->orWhere('tags', 'like', '%campus%');
                })
                ->orderByDesc('ai_engagement_score')
                ->orderByDesc('published_at')
                ->take(6)
                ->get();
        });

        // Cache AI Insights (User specific, 24 hours) - Expensive API calls
        $aiInsights = Cache::remember("tafe.ai_insights.{$user->id}", 86400, function () use ($insightService, $user, $recommendations) {
            return $insightService->generateInsights($user, $recommendations);
        });

        $socialPulse = Cache::remember('tafe.social_pulse', 1800, function () use ($insightService, $socialHighlights) {
            return $insightService->summarizeSocial($socialHighlights);
        });

        // Cache Career Suggestions (User specific, 24 hours) - Expensive API calls
        $careerSuggestions = Cache::remember("tafe.career_suggestions.{$user->id}", 86400, function () use ($insightService, $user, $careerProfile) {
            return $insightService->suggestCareers($user, $careerProfile);
        });

        $spotlightInstitutions = Cache::remember('tafe.spotlight_institutions', 3600, function () {
            return TafeInstitution::query()
                ->withCount('programs')
                ->live()
                ->latest('published_at')
                ->take(4)
                ->get();
        });

        $institutionProgramCount = $institution ? $institution->programs->count() : null;
        $institutionIntakeCount = $institution
            ? $institution->programs->flatMap(fn ($program) => $program->intakes)->count()
            : null;

        // Cache global stats (1 hour)
        $globalStats = Cache::remember('tafe.global_stats', 3600, function () {
            return [
                'totalPrograms' => TafeProgram::count(),
                'liveIntakes' => TafeProgramIntake::count(),
            ];
        });

        $stats = [
            'totalPrograms' => $institutionProgramCount ?? $globalStats['totalPrograms'],
            'activeJourneys' => $journeys->count(),
            'liveIntakes' => $institutionIntakeCount ?? $globalStats['liveIntakes'],
        ];

        return view('education.tafe.dashboard', [
            'institution' => $institution,
            'journeys' => $journeys,
            'recommendations' => $recommendations,
            'spotlightPrograms' => $spotlightPrograms,
            'spotlightInstitutions' => $spotlightInstitutions,
            'socialHighlights' => $socialHighlights,
            'aiInsights' => $aiInsights,
            'socialPulse' => $socialPulse,
            'careerProfile' => $careerProfile,
            'careerSuggestions' => $careerSuggestions,
            'stats' => $stats,
        ]);
    }
}

