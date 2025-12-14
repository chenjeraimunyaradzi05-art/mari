<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\AdvertisingCampaign;
use App\Services\Advertising\SlotPerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AdvertisingSlotInsightController extends Controller
{
    public function __invoke(Request $request, SlotPerformanceService $service): JsonResponse
    {
        $company = optional($request->user())->company;
        abort_unless($company, 403);

        $days = (int) $request->integer('days', 30);
        $days = max(3, min(60, $days));

        $campaignId = $request->integer('campaign_id');
        $campaign = null;

        if ($campaignId) {
            $campaign = AdvertisingCampaign::query()
                ->where('company_id', $company->id)
                ->whereKey($campaignId)
                ->first();
        }

        $payload = $campaign
            ? $service->forCampaign($campaign, $days)
            : $service->forCompany($company, $days);

        return response()->json($payload);
    }
}

