<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Http\Requests\Org\StoreAdCampaignRequest;
use App\Http\Requests\Org\UpdateAdCampaignRequest;
use App\Http\Resources\Org\AdCampaignResource;
use App\Http\Resources\Org\AdMetricsDailyResource;
use App\Models\AdCampaign;
use App\Models\AdMetricsDaily;
use App\Models\Lead;
use App\Models\OrganizationPage;
use App\Models\User;
use App\Support\OrgPageAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;

final class AdCampaignController extends Controller
{
	public function index(Request $request): AnonymousResourceCollection
	{
		$user = $request->user();
		abort_unless($user, 401, 'Authentication required.');

		$validated = $request->validate([
			'org_page_id' => ['nullable', 'integer', 'exists:organization_pages,id'],
			'objective' => ['nullable', Rule::in(AdCampaign::OBJECTIVES)],
			'status' => ['nullable', Rule::in(AdCampaign::STATUSES)],
			'order_by' => ['nullable', Rule::in(['created_at', 'start_on', 'end_on', 'spent_cents'])],
			'order_dir' => ['nullable', Rule::in(['asc', 'desc'])],
			'q' => ['nullable', 'string', 'max:120'],
			'starts_after' => ['nullable', 'date'],
			'starts_before' => ['nullable', 'date'],
			'per_page' => ['nullable', 'integer', 'between:5,100'],
			'with_metrics_summary' => ['nullable', 'boolean'],
		]);

		$pageIds = OrgPageAccess::idsFor($user);
		abort_if($pageIds->isEmpty(), 403, 'You are not assigned to any organization pages.');

		if (! empty($validated['org_page_id']) && ! $pageIds->contains((int) $validated['org_page_id'])) {
			abort(403, 'You are not allowed to view this organization page.');
		}

		$query = AdCampaign::query()
			->with(['page:id,name,slug,company_id'])
			->withCount('creatives')
			->whereIn('org_page_id', $pageIds);

		if (! empty($validated['org_page_id'])) {
			$query->where('org_page_id', (int) $validated['org_page_id']);
		}

		if (! empty($validated['objective'])) {
			$query->where('objective', $validated['objective']);
		}

		if (! empty($validated['status'])) {
			$query->where('status', $validated['status']);
		}

		if (! empty($validated['q'])) {
			$search = Str::lower($validated['q']);
			$query->where(function (Builder $builder) use ($search) {
				$builder->whereRaw('LOWER(name) like ?', ['%' . $search . '%']);
			});
		}

		if (! empty($validated['starts_after'])) {
			$query->whereDate('start_on', '>=', $validated['starts_after']);
		}

		if (! empty($validated['starts_before'])) {
			$query->whereDate('start_on', '<=', $validated['starts_before']);
		}

		$orderBy = $validated['order_by'] ?? 'created_at';
		$orderDir = $validated['order_dir'] ?? 'desc';

		$query->orderBy($orderBy, $orderDir);

		$perPage = $validated['per_page'] ?? 15;
		$campaigns = $query->paginate($perPage);

		if (! empty($validated['with_metrics_summary'])) {
			$this->attachMetricsSummaries($campaigns);
		}

		return AdCampaignResource::collection($campaigns)
			->additional([
				'filters' => array_filter($validated, fn ($value, $key) => $key !== 'per_page', ARRAY_FILTER_USE_BOTH),
			]);
	}

	public function store(StoreAdCampaignRequest $request): JsonResponse
	{
		$campaign = AdCampaign::create($request->campaignData());

		return response()->json(
			(new AdCampaignResource($campaign))->resolve($request),
			201
		);
	}

	public function show(Request $request, AdCampaign $campaign): JsonResponse
	{
		$this->authorizeCampaignAccess($request->user(), $campaign);

		$campaign->load('page:id,name,slug')
			->loadCount('creatives');

		return response()->json(
			(new AdCampaignResource($campaign))->resolve($request)
		);
	}

	public function metrics(Request $request, AdCampaign $campaign): JsonResponse
	{
		$this->authorizeCampaignAccess($request->user(), $campaign);

		$days = (int) $request->integer('days', 30);
		$days = max(1, min(90, $days));

		$metrics = $campaign->dailyMetrics()
			->latest('date')
			->limit($days)
			->get()
			->reverse()
			->values();

		$summary = $this->summarizeMetrics($campaign, $metrics);

		return response()->json([
			'campaign' => (new AdCampaignResource($campaign))->resolve($request),
			'summary' => $summary,
			'metrics' => AdMetricsDailyResource::collection($metrics)->resolve($request),
		]);
	}

	public function update(UpdateAdCampaignRequest $request, AdCampaign $campaign): JsonResponse
	{
		$campaign->fill($request->campaignData());
		$campaign->save();
		$campaign->refresh();

		return response()->json(
			(new AdCampaignResource($campaign))->resolve($request)
		);
	}

	public function action(Request $request, AdCampaign $campaign): JsonResponse
	{
		$this->authorizeCampaignAccess($request->user(), $campaign);

		$data = $request->validate([
			'action' => ['required', Rule::in(['pause', 'resume', 'complete'])],
		]);

		switch ($data['action']) {
			case 'pause':
				$campaign->status = AdCampaign::STATUS_PAUSED;
				break;
			case 'resume':
				$campaign->status = AdCampaign::STATUS_ACTIVE;
				break;
			case 'complete':
				$campaign->status = AdCampaign::STATUS_COMPLETED;
				break;
		}

		$campaign->save();
		$campaign->refresh();

		return response()->json((new AdCampaignResource($campaign))->resolve($request));
	}

	public function overview(Request $request, OrganizationPage $organizationPage): JsonResponse
	{
		$user = $request->user();
		abort_unless($user, 401, 'Authentication required.');

		$pageIds = OrgPageAccess::idsFor($user);
		abort_unless($pageIds->contains($organizationPage->getKey()), 403, 'You are not allowed to view this organization page.');

		$campaignBaseQuery = AdCampaign::query()->where('org_page_id', $organizationPage->getKey());
		$campaignCounts = [
			'total' => (clone $campaignBaseQuery)->count(),
			'active' => (clone $campaignBaseQuery)->where('status', AdCampaign::STATUS_ACTIVE)->count(),
			'paused' => (clone $campaignBaseQuery)->where('status', AdCampaign::STATUS_PAUSED)->count(),
			'completed' => (clone $campaignBaseQuery)->where('status', AdCampaign::STATUS_COMPLETED)->count(),
		];

		$startOfMonth = Carbon::now()->startOfMonth();
		$metricSummary = AdMetricsDaily::query()
			->selectRaw('sum(impressions) as impressions, sum(clicks) as clicks, sum(leads) as leads, sum(cost_cents) as cost_cents')
			->where('date', '>=', $startOfMonth->toDateString())
			->whereHas('campaign', fn (Builder $builder) => $builder->where('org_page_id', $organizationPage->getKey()))
			->first();

		$leadTotals = [
			'total' => Lead::query()->where('org_page_id', $organizationPage->getKey())->count(),
			'month' => Lead::query()
				->where('org_page_id', $organizationPage->getKey())
				->whereDate('submitted_at', '>=', $startOfMonth)
				->count(),
		];

		return response()->json([
			'page' => [
				'id' => $organizationPage->getKey(),
				'name' => $organizationPage->name,
				'slug' => $organizationPage->slug,
			],
			'campaigns' => $campaignCounts,
			'metrics' => [
				'period' => [
					'from' => $startOfMonth->toDateString(),
					'to' => Carbon::now()->toDateString(),
				],
				'values' => [
					'impressions' => (int) ($metricSummary->impressions ?? 0),
					'clicks' => (int) ($metricSummary->clicks ?? 0),
					'leads' => (int) ($metricSummary->leads ?? 0),
					'cost_cents' => (int) ($metricSummary->cost_cents ?? 0),
				],
			],
			'leads' => $leadTotals,
		]);
	}

	private function authorizeCampaignAccess(?User $user, AdCampaign $campaign): void
	{
		abort_unless($user !== null, 401, 'Authentication required.');

		$campaign->loadMissing('page.company', 'page.admins');

		$page = $campaign->page;

		abort_unless($page, 404, 'Campaign is missing a parent page.');

		$isCompanyOwner = $page->company && $page->company->user_id === $user->id;
		$isPageAdmin = $page->admins->contains('user_id', $user->id);

		abort_unless($isCompanyOwner || $isPageAdmin, 403, 'You are not allowed to manage this campaign.');
	}

	/**
	 * @return (float|int|mixed|null)[][]
	 *
	 * @psalm-return array{totals: array{impressions: int<min, max>, clicks: int<min, max>, views: int, watch_time_s: int, leads: int, conversions: int, cost_cents: int, ctr: 0|float, conversion_rate: 0|float, avg_cpc_cents: int|null}, pacing: array{budget_cents: int, spent_cents: int, remaining_cents: int<0, max>, lifetime_progress: 0|float}, date_range: array{start: mixed|null, end: mixed|null}}
	 */
	private function summarizeMetrics(AdCampaign $campaign, Collection $metrics): array
	{
		$totals = [
			'impressions' => (int) $metrics->sum('impressions'),
			'clicks' => (int) $metrics->sum('clicks'),
			'views' => (int) $metrics->sum('views'),
			'watch_time_s' => (int) $metrics->sum('watch_time_s'),
			'leads' => (int) $metrics->sum('leads'),
			'conversions' => (int) $metrics->sum('conversions'),
			'cost_cents' => (int) $metrics->sum('cost_cents'),
		];

		$totals['ctr'] = $totals['impressions'] > 0
			? round($totals['clicks'] / $totals['impressions'], 4)
			: 0;

		$totals['conversion_rate'] = $totals['clicks'] > 0
			? round($totals['conversions'] / $totals['clicks'], 4)
			: 0;

		$totals['avg_cpc_cents'] = $totals['clicks'] > 0
			? (int) floor($totals['cost_cents'] / max(1, $totals['clicks']))
			: null;

		$budget = (int) $campaign->budget_cents;
		$spent = (int) $campaign->spent_cents;

		return [
			'totals' => $totals,
			'pacing' => [
				'budget_cents' => $budget,
				'spent_cents' => $spent,
				'remaining_cents' => max(0, $budget - $spent),
				'lifetime_progress' => $budget > 0 ? round($spent / $budget, 4) : 0,
			],
			'date_range' => [
				'start' => optional($metrics->first())->date?->toDateString(),
				'end' => optional($metrics->last())->date?->toDateString(),
			],
		];
	}

	private function attachMetricsSummaries(LengthAwarePaginator $campaigns): void
	{
		$ids = collect($campaigns->items())->pluck('id')->filter()->all();

		if (empty($ids)) {
			return;
		}

		/** @var array<int, array<string, int>> $metrics */
		$metrics = AdMetricsDaily::query()
			->selectRaw('campaign_id, sum(impressions) as impressions, sum(clicks) as clicks, sum(leads) as leads, sum(cost_cents) as cost_cents')
			->whereIn('campaign_id', $ids)
			->groupBy('campaign_id')
			->get()
			->mapWithKeys(function ($row) {
				return [
					$row->campaign_id => [
						'impressions' => (int) $row->impressions,
						'clicks' => (int) $row->clicks,
						'leads' => (int) $row->leads,
						'cost_cents' => (int) $row->cost_cents,
					],
				];
			})
			->all();

		foreach ($campaigns->items() as $campaign) {
			$campaignId = (int) $campaign->id;

			if (! array_key_exists($campaignId, $metrics)) {
				continue;
			}

			$campaign->setAttribute('metrics_summary', $metrics[$campaignId]);
		}
	}
}

