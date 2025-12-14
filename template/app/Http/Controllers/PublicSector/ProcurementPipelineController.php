<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\ComplianceTracker;
use App\Models\ProcurementOpportunity;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class ProcurementPipelineController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request): View
    {
        $stageLabels = [
            'discovery' => 'Discovery',
            'briefing' => 'Mission briefing',
            'open' => 'Open pipeline',
            'shortlist' => 'Shortlist',
            'awarded' => 'Awarded',
            'closed' => 'Closed',
        ];

        $opportunities = ProcurementOpportunity::query()
            ->with(['agency:id,name,category,slug', 'missionBrief'])
            ->latest('updated_at')
            ->get();

        $pipeline = $opportunities->groupBy(fn (ProcurementOpportunity $record) => $record->pipeline_stage);

        $stats = [
            'total' => $opportunities->count(),
            'open' => $opportunities->where('status', 'open')->count(),
            'in_briefing' => $opportunities->where('pipeline_stage', 'briefing')->count(),
            'awarded' => $opportunities->where('pipeline_stage', 'awarded')->count(),
        ];

        $compliance = ComplianceTracker::query()
            ->with(['opportunity:id,title,pipeline_stage,budget_band', 'owner:id,name'])
            ->latest('due_at')
            ->take(8)
            ->get();

        return view('public-sector.pipeline', [
            'stageLabels' => $stageLabels,
            'pipeline' => $pipeline,
            'stats' => $stats,
            'compliance' => $compliance,
            'aiConciergeUrl' => route('ai.concierge'),
        ]);
    }
}

