<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Growth\Experiment;
use App\Models\MarketingAttribution;
use App\Models\Referral;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class GrowthAnalyticsController extends Controller
{
    public function index(): \Illuminate\Contracts\View\View
    {
        // Marketing Attribution Stats
        $attributionStats = MarketingAttribution::selectRaw('utm_source, count(*) as total')
            ->groupBy('utm_source')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $conversionsBySource = MarketingAttribution::whereNotNull('conversion_at')
            ->selectRaw('utm_source, count(*) as total')
            ->groupBy('utm_source')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Referral Stats
        $referralStats = [
            'total_invites' => Referral::count(),
            'accepted_invites' => Referral::where('status', 'accepted')->count(),
            'rewarded_invites' => Referral::where('status', 'rewarded')->count(),
            'pending_invites' => Referral::where('status', 'pending')->count(),
        ];

        // Experiment Stats
        $experiments = Experiment::withCount(['assignments', 'conversions'])->get();

        return view('admin.growth.analytics', compact(
            'attributionStats',
            'conversionsBySource',
            'referralStats',
            'experiments'
        ));
    }
}

