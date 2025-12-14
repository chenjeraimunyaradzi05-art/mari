<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Advertising\StoreCampaignRequest;
use App\Http\Requests\Advertising\UpdateCampaignRequest;
use App\Http\Resources\Org\AdCampaignResource;
use App\Models\AdCampaign;
use App\Models\AdvertisingCampaign;
use App\Models\AdvertisingAudienceSegment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdvertisingCampaignController extends Controller
{
    public function index(Request $request): View
    {
        $company = $this->companyFromRequest($request);

        $orgPages = $company->organizationPages()
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);

        return view('frontend.company-dashboard.advertising.campaigns.index', [
            'orgPages' => $orgPages,
            'defaultOrgPageId' => $orgPages->first()?->id,
        ]);
    }

    public function create(Request $request): View
    {
        $company = $this->companyFromRequest($request);

        $segments = AdvertisingAudienceSegment::query()
            ->where('company_id', $company->id)
            ->orderBy('name')
            ->get(['id', 'name', 'description']);

        return view('frontend.company-dashboard.advertising.campaigns.create', [
            'campaign' => new AdvertisingCampaign([
                'status' => AdvertisingCampaign::STATUS_DRAFT,
                'objective' => 'awareness',
            ]),
            'segments' => $segments,
            'objectives' => AdvertisingCampaign::OBJECTIVES,
        ]);
    }

    public function store(StoreCampaignRequest $request): RedirectResponse
    {
        $company = $this->companyFromRequest($request);

        $campaign = $company->advertisingCampaigns()->create($request->campaignData());

        $segmentIds = collect($request->validated()['audience_segments'] ?? [])
            ->filter()
            ->unique()
            ->values();

        if ($segmentIds->isNotEmpty()) {
            $validSegmentIds = AdvertisingAudienceSegment::query()
                ->where('company_id', $company->id)
                ->whereIn('id', $segmentIds)
                ->pluck('id')
                ->all();

            $campaign->audienceSegments()->sync($validSegmentIds);
        }

        return redirect()
            ->route('company.advertising.campaigns.index')
            ->with('status', 'Campaign draft created. Configure creatives to launch.');
    }

    public function show(Request $request, int $campaign): View
    {
        $company = $this->companyFromRequest($request);

        $record = AdCampaign::query()
            ->with('page.company')
            ->findOrFail($campaign);

        abort_unless(optional($record->page)->company_id === $company->id, 404);

        $record->load('page:id,name,slug');

        $initialCampaign = (new AdCampaignResource($record))->resolve($request);

        return view('frontend.company-dashboard.advertising.campaigns.show', [
            'campaignId' => $record->id,
            'orgPageId' => $record->org_page_id,
            'initialCampaign' => $initialCampaign,
        ]);
    }

    public function edit(Request $request, AdvertisingCampaign $campaign): View
    {
        $company = $this->guardCampaign($request, $campaign);

        $campaign->load('audienceSegments');

        $segments = AdvertisingAudienceSegment::query()
            ->where('company_id', $company->id)
            ->orderBy('name')
            ->get(['id', 'name', 'description']);

        return view('frontend.company-dashboard.advertising.campaigns.edit', [
            'campaign' => $campaign,
            'segments' => $segments,
            'objectives' => AdvertisingCampaign::OBJECTIVES,
        ]);
    }

    public function update(UpdateCampaignRequest $request, AdvertisingCampaign $campaign): RedirectResponse
    {
        $company = $this->guardCampaign($request, $campaign);

        $campaign->update($request->campaignData());

        $segmentIds = collect($request->validated()['audience_segments'] ?? [])
            ->filter()
            ->unique()
            ->values();

        if ($segmentIds->isNotEmpty()) {
            $validSegmentIds = AdvertisingAudienceSegment::query()
                ->where('company_id', $company->id)
                ->whereIn('id', $segmentIds)
                ->pluck('id')
                ->all();

            $campaign->audienceSegments()->sync($validSegmentIds);
        } else {
            $campaign->audienceSegments()->detach();
        }

        return redirect()
            ->route('company.advertising.campaigns.show', $campaign)
            ->with('status', 'Campaign updated successfully.');
    }

    public function destroy(Request $request, AdvertisingCampaign $campaign): RedirectResponse
    {
        $this->guardCampaign($request, $campaign);

        // detach any pivot relations first
        $campaign->audienceSegments()->detach();

        $campaign->delete();

        return redirect()
            ->route('company.advertising.campaigns.index')
            ->with('status', 'Campaign deleted.');
    }

    public function changeStatus(Request $request, AdvertisingCampaign $campaign): RedirectResponse
    {
        $this->guardCampaign($request, $campaign);

        $data = $request->validate([
            'status' => ['required', 'in:' . implode(',', AdvertisingCampaign::STATUSES)],
        ]);

        $campaign->status = $data['status'];
        $campaign->save();

        return redirect()
            ->route('company.advertising.campaigns.show', $campaign)
            ->with('status', 'Campaign status updated.');
    }

    private function companyFromRequest(Request $request)
    {
        $company = optional($request->user())->company;

        abort_unless($company, 403);

        return $company;
    }

    private function guardCampaign(Request $request, AdvertisingCampaign $campaign)
    {
        $company = $this->companyFromRequest($request);

        abort_unless($campaign->company_id === $company->id, 404);

        return $company;
    }
}

