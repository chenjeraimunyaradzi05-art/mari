<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\PublicSectorAgency;
use App\Models\PublicSectorInsight;
use App\Models\PublicSectorOpportunity;
use App\Models\PublicSectorProgram;
use App\Models\ProcurementOpportunity;
use App\Models\SocialPost;
use App\Services\PublicSector\PublicSectorInsightService;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class DashboardController extends Controller
{
    public function __construct(private readonly PublicSectorInsightService $insightService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request): View
    {
        $agencies = PublicSectorAgency::active()
            ->withCount('programs')
            ->orderByDesc('impact_score')
            ->take(6)
            ->get();

        $programs = PublicSectorProgram::with('agency')
            ->latest('updated_at')
            ->take(6)
            ->get();

        $featuredOpportunities = PublicSectorOpportunity::with('agency')
            ->open()
            ->orderByDesc('is_featured')
            ->orderBy('closes_at')
            ->take(6)
            ->get();

        $insights = PublicSectorInsight::latestTrend()->take(6)->get();

        $socialHighlights = SocialPost::public()
            ->visible()
            ->where(function ($query): void {
                $query->whereJsonContains('tags', 'public-sector')
                    ->orWhereJsonContains('tags', 'government')
                    ->orWhere('caption', 'like', '%civic%');
            })
            ->with('profile')
            ->latest('published_at')
            ->take(6)
            ->get();

        $aiPlaybook = $this->insightService->buildPlaybook(
            $request->user(),
            $agencies,
            $featuredOpportunities,
            $insights
        );

        $signals = $this->insightService->opportunitySignals($featuredOpportunities);

        $recentEngagements = $request->user()->publicSectorEngagements()
            ->with('opportunity')
            ->latest('submitted_at')
            ->take(5)
            ->get();

        // Procurement Pipeline Stats
        $procurementStats = [
            'open' => ProcurementOpportunity::published()->stage('open')->count(),
            'briefing' => ProcurementOpportunity::published()->stage('briefing')->count(),
            'discovery' => ProcurementOpportunity::published()->stage('discovery')->count(),
        ];

        $missionBriefings = ProcurementOpportunity::published()
            ->stage('briefing')
            ->with('agency')
            ->latest('updated_at')
            ->take(3)
            ->get();

        return view('public-sector.dashboard', [
            'agencies' => $agencies,
            'programs' => $programs,
            'featuredOpportunities' => $featuredOpportunities,
            'insights' => $insights,
            'socialHighlights' => $socialHighlights,
            'aiPlaybook' => $aiPlaybook,
            'opportunitySignals' => $signals,
            'recentEngagements' => $recentEngagements,
            'procurementStats' => $procurementStats,
            'missionBriefings' => $missionBriefings,
        ]);
    }
}

