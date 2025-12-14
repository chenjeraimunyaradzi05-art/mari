<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Advertising\StoreCreativeRequest;
use App\Http\Requests\Advertising\UpdateCreativeRequest;
use App\Models\AdvertisingCampaign;
use App\Models\AdvertisingCreative;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdvertisingCreativeController extends Controller
{
    public function create(Request $request, AdvertisingCampaign $campaign): View
    {
        $this->guardCampaign($request, $campaign);

        return view('frontend.company-dashboard.advertising.creatives.create', [
            'campaign' => $campaign,
            'creative' => new AdvertisingCreative([
                'status' => AdvertisingCreative::STATUS_DRAFT,
                'format' => array_key_first(AdvertisingCreative::FORMATS) ?? 'single_image',
                'review_status' => AdvertisingCreative::REVIEW_PENDING,
            ]),
            'statuses' => AdvertisingCreative::STATUSES,
            'reviewStatuses' => AdvertisingCreative::REVIEW_STATUSES,
            'formats' => AdvertisingCreative::FORMATS,
        ]);
    }

    public function store(StoreCreativeRequest $request, AdvertisingCampaign $campaign): RedirectResponse
    {
        $company = $this->guardCampaign($request, $campaign);

        $campaign->creatives()->create(
            $request->creativeData() + [
                'company_id' => $company->id,
            ]
        );

        return redirect()
            ->route('company.advertising.campaigns.show', $campaign)
            ->with('status', 'Creative added to campaign. Add at least one approved creative before launch.');
    }

    public function edit(Request $request, AdvertisingCampaign $campaign, AdvertisingCreative $creative): View
    {
        $company = $this->guardCampaign($request, $campaign);
        $this->guardCreative($creative, $campaign, $company->id);

        return view('frontend.company-dashboard.advertising.creatives.edit', [
            'campaign' => $campaign,
            'creative' => $creative,
            'statuses' => AdvertisingCreative::STATUSES,
            'reviewStatuses' => AdvertisingCreative::REVIEW_STATUSES,
            'formats' => AdvertisingCreative::FORMATS,
        ]);
    }

    public function update(UpdateCreativeRequest $request, AdvertisingCampaign $campaign, AdvertisingCreative $creative): RedirectResponse
    {
        $company = $this->guardCampaign($request, $campaign);
        $this->guardCreative($creative, $campaign, $company->id);

        $creative->update($request->creativeData());

        return redirect()
            ->route('company.advertising.campaigns.show', $campaign)
            ->with('status', 'Creative updated successfully.');
    }

    public function destroy(Request $request, AdvertisingCampaign $campaign, AdvertisingCreative $creative): RedirectResponse
    {
        $company = $this->guardCampaign($request, $campaign);
        $this->guardCreative($creative, $campaign, $company->id);

        $creative->delete();

        return redirect()
            ->route('company.advertising.campaigns.show', $campaign)
            ->with('status', 'Creative removed from campaign.');
    }

    private function guardCampaign(Request $request, AdvertisingCampaign $campaign)
    {
        $company = optional($request->user())->company;

        abort_unless($company, 403);
        abort_unless($campaign->company_id === $company->id, 404);

        return $company;
    }

    private function guardCreative(AdvertisingCreative $creative, AdvertisingCampaign $campaign, int $companyId): void
    {
        abort_unless($creative->campaign_id === $campaign->id, 404);
        abort_unless($creative->company_id === $companyId, 404);
    }
}

