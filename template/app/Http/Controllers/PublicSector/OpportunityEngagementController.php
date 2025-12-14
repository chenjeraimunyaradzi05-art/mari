<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\PublicSectorEngagement;
use App\Models\PublicSectorOpportunity;
use App\Services\PublicSector\PublicSectorInsightService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class OpportunityEngagementController extends Controller
{
    public function __construct(private readonly PublicSectorInsightService $insightService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function store(Request $request, PublicSectorOpportunity $opportunity): RedirectResponse
    {
        $validated = $request->validate([
            'motivation' => ['nullable', 'string', 'max:600'],
            'channels' => ['nullable', 'array'],
            'channels.*' => ['string', 'max:60'],
        ]);

        $engagement = PublicSectorEngagement::create([
            'user_id' => $request->user()->id,
            'public_sector_opportunity_id' => $opportunity->id,
            'engagement_type' => 'interest',
            'channels' => array_values($validated['channels'] ?? []),
            'motivation' => $validated['motivation'] ?? null,
            'submitted_at' => now(),
        ]);

        $summary = $this->insightService->summarizeEngagement(
            $request->user(),
            $opportunity,
            $engagement->channels ?? [],
            $engagement->motivation
        );

        $engagement->update(['ai_summary' => $summary]);

        return back()->with('public_sector_interest_saved', true);
    }
}

