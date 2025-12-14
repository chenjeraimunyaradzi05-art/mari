<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Models\CivicOpportunitySignup;
use App\Models\ProcurementOpportunity;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class CivicOpportunitiesController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request): View
    {
        $opportunities = ProcurementOpportunity::query()
            ->published()
            ->with(['agency:id,name,category', 'missionBrief'])
            ->orderBy('opens_at')
            ->orderBy('title')
            ->get();

        $signups = CivicOpportunitySignup::query()
            ->where('user_id', $request->user()->id)
            ->get()
            ->keyBy('procurement_opportunity_id');

        return view('member.civic-opportunities', [
            'opportunities' => $opportunities,
            'signups' => $signups,
            'aiConciergeUrl' => route('ai.concierge'),
        ]);
    }
}

