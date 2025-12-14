<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Advertising\StoreAudienceSegmentRequest;
use App\Models\AdvertisingAudienceSegment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdvertisingAudienceSegmentController extends Controller
{
	public function index(Request $request): View
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);

		$segments = AdvertisingAudienceSegment::query()
			->where('company_id', $company->id)
			->withCount('campaigns')
			->latest()
			->paginate(12);

		return view('frontend.company-dashboard.advertising.segments.index', [
			'segments' => $segments,
		]);
	}

	public function create(Request $request): View
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);

		return view('frontend.company-dashboard.advertising.segments.create');
	}

	public function store(StoreAudienceSegmentRequest $request): RedirectResponse
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);

		$company->advertisingAudienceSegments()->create($request->segmentData());

		return redirect()
			->route('company.advertising.segments.index')
			->with('status', 'Audience segment saved. You can now attach it to campaigns.');
	}

	public function edit(Request $request, AdvertisingAudienceSegment $segment): View
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);
		abort_unless($segment->company_id === $company->id, 404);

		return view('frontend.company-dashboard.advertising.segments.create', [
			'segment' => $segment,
		]);
	}

	public function update(StoreAudienceSegmentRequest $request, AdvertisingAudienceSegment $segment): RedirectResponse
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);
		abort_unless($segment->company_id === $company->id, 404);

		$segment->update($request->segmentData());

		return redirect()
			->route('company.advertising.segments.index')
			->with('status', 'Audience segment updated.');
	}

	public function destroy(Request $request, AdvertisingAudienceSegment $segment): RedirectResponse
	{
		$company = optional($request->user())->company;

		abort_unless($company, 403);
		abort_unless($segment->company_id === $company->id, 404);

		$segment->delete();

		return redirect()
			->route('company.advertising.segments.index')
			->with('status', 'Audience segment deleted.');
	}
}


