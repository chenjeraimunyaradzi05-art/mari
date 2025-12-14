<?php

namespace App\Http\Controllers\Partner;

use App\Http\Controllers\Controller;
use App\Models\AdvertisingCampaign;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class PartnerDashboardController extends Controller
{
    public function index(): \Illuminate\Contracts\View\View
    {
        $company = Auth::user()->company; // Assuming User has Company relation

        if (!$company) {
            abort(403, 'User is not associated with a company.');
        }

        $campaigns = AdvertisingCampaign::where('company_id', $company->id)
            ->withCount('creatives')
            ->latest()
            ->get();

        $metrics = [
            'active_campaigns' => $campaigns->where('status', 'active')->count(),
            'total_spend' => 0, // Placeholder: Calculate from metrics
            'impressions' => 0, // Placeholder
            'clicks' => 0, // Placeholder
        ];

        return view('partner.dashboard.index', compact('campaigns', 'metrics'));
    }
}

