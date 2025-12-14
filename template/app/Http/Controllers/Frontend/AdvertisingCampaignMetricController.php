<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Advertising\StoreCampaignMetricRequest;
use App\Http\Requests\Advertising\UpdateCampaignMetricRequest;
use App\Models\AdvertisingCampaign;
use App\Models\AdvertisingCampaignMetric;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdvertisingCampaignMetricController extends Controller
{
    public function index(Request $request, AdvertisingCampaign $campaign): View
    {
        $this->guardCampaign($request, $campaign);

        $metrics = $campaign->metrics()
            ->orderByDesc('recorded_at')
            ->paginate(30);

        return view('frontend.company-dashboard.advertising.metrics.index', [
            'campaign' => $campaign,
            'metrics' => $metrics,
        ]);
    }

    public function create(Request $request, AdvertisingCampaign $campaign): View
    {
        $this->guardCampaign($request, $campaign);

        return view('frontend.company-dashboard.advertising.metrics.create', [
            'campaign' => $campaign,
            'metric' => new AdvertisingCampaignMetric([
                'recorded_at' => now()->toDateString(),
            ]),
        ]);
    }

    public function store(StoreCampaignMetricRequest $request, AdvertisingCampaign $campaign): RedirectResponse
    {
        $this->guardCampaign($request, $campaign);

        $campaign->metrics()->updateOrCreate(
            [
                'recorded_at' => $request->validated()['recorded_at'],
            ],
            $request->metricData() + ['campaign_id' => $campaign->id]
        );

        return redirect()
            ->route('company.advertising.campaigns.metrics.index', $campaign)
            ->with('status', 'Daily performance metrics saved.');
    }

    public function edit(Request $request, AdvertisingCampaign $campaign, AdvertisingCampaignMetric $metric): View
    {
        $this->guardMetric($request, $campaign, $metric);

        return view('frontend.company-dashboard.advertising.metrics.edit', [
            'campaign' => $campaign,
            'metric' => $metric,
        ]);
    }

    public function update(UpdateCampaignMetricRequest $request, AdvertisingCampaign $campaign, AdvertisingCampaignMetric $metric): RedirectResponse
    {
        $this->guardMetric($request, $campaign, $metric);

        $metric->update($request->metricData());

        return redirect()
            ->route('company.advertising.campaigns.metrics.index', $campaign)
            ->with('status', 'Metrics updated successfully.');
    }

    public function destroy(Request $request, AdvertisingCampaign $campaign, AdvertisingCampaignMetric $metric): RedirectResponse
    {
        $this->guardMetric($request, $campaign, $metric);

        $metric->delete();

        return redirect()
            ->route('company.advertising.campaigns.metrics.index', $campaign)
            ->with('status', 'Metrics entry deleted.');
    }

    private function guardCampaign(Request $request, AdvertisingCampaign $campaign)
    {
        $company = optional($request->user())->company;

        abort_unless($company, 403);
        abort_unless($campaign->company_id === $company->id, 404);

        return $company;
    }

    private function guardMetric(Request $request, AdvertisingCampaign $campaign, AdvertisingCampaignMetric $metric): void
    {
        $this->guardCampaign($request, $campaign);
        abort_unless($metric->campaign_id === $campaign->id, 404);
    }
}

