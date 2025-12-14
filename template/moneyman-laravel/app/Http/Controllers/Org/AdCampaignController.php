<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\AdCampaign;
use App\Models\AdMetricsDaily;

class AdCampaignController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'org_page_id' => ['required','integer','exists:organization_pages,id'],
            'objective' => ['required', Rule::in(['reach','traffic','leads','applications'])],
            'budget_cents' => ['required','integer','min:0'],
            'start_on' => ['required','date'],
            'end_on' => ['nullable','date','after_or_equal:start_on'],
            'targeting' => ['array'],
            'status' => ['required', Rule::in(['draft','active','paused','completed'])],
        ]);

        $campaign = AdCampaign::create($data);
        return response()->json($campaign, 201);
    }

    public function metrics(int $id, Request $request)
    {
        $days = (int) $request->query('days', 30);
        $metrics = AdMetricsDaily::where('campaign_id', $id)
            ->orderByDesc('date')->limit($days)->get();
        return response()->json($metrics);
    }
}
