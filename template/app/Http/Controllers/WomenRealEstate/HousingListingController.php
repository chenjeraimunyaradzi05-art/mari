<?php

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\ListingMortgageQuote;
use App\Models\MortgageRateSnapshot;
use App\Models\User;
use App\Models\WomenHousingListing;
use App\Models\WomenListingPhoto;
use App\Models\WomenRealEstate\WomenListing;
use App\Services\WomenRealEstate\Ai\WomenListingAiService;
use App\Services\WomenRealEstate\MortgageIntelligenceTelemetry;
use App\Services\WomenRealEstate\WomenListingMediaPipeline;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class HousingListingController extends Controller
{
    public function __construct(private readonly WomenListingMediaPipeline $mediaPipeline)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function index(Request $request, MortgageIntelligenceTelemetry $telemetry, WomenListingAiService $aiService): View
    {
        $currentUser = $request->user();

        $this->ensureHousingRole($currentUser);

        $ownerId = Auth::id();

        $roleGates = [
            'mortgage_tools' => $currentUser?->hasAnyPlatformRole(['real_estate_agent']) ?? false,
            'rent_vs_buy' => $currentUser?->hasAnyPlatformRole(['real_estate_agent', 'real_estate_seeker']) ?? false,
            'safety_playbook' => $currentUser?->hasAnyPlatformRole(['real_estate_agent', 'real_estate_seeker']) ?? false,
            'virtual_tours' => $currentUser?->hasAnyPlatformRole(['real_estate_agent', 'real_estate_seeker']) ?? false,
        ];

        $availableAudiences = [
            'women_only' => 'Women-only households',
            'women_students' => 'Women students & graduates',
            'women_professionals' => 'Women professionals',
            'women_caregivers' => 'Women caregivers & carers',
            'women_retirees' => 'Women retirees & downsizers',
        ];

        $searchTerm = trim((string) $request->query('search', ''));
        $selectedAudiences = collect(Arr::wrap($request->query('audience', [])))
            ->map(static fn ($value) => (string) $value)
            ->filter(fn ($value) => array_key_exists($value, $availableAudiences))
            ->values()
            ->all();

        $listingQuery = WomenHousingListing::query()
            ->where('owner_user_id', $ownerId);

        if ($searchTerm !== '') {
            $listingQuery->where(function (Builder $builder) use ($searchTerm): void {
                $builder
                    ->where('title', 'like', '%' . $searchTerm . '%')
                    ->orWhere('description', 'like', '%' . $searchTerm . '%')
                    ->orWhere('slug', 'like', '%' . $searchTerm . '%');
            });
        }

        if ($selectedAudiences !== []) {
            $listingQuery->whereIn('audience', $selectedAudiences);
        }

        $ownerListingIds = (clone $listingQuery)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();

        $portfolioAveragePriceCents = (clone $listingQuery)->avg('price_cents');

        $listings = (clone $listingQuery)
            ->with([
                'agentProfile',
                'latestMortgageQuote.rateSnapshot',
            ])
            ->withCount(['photos', 'mortgageQuotes'])
            ->latest('created_at')
            ->paginate(10);

        $listings->appends($request->query());

        $quoteBase = ListingMortgageQuote::query()
            ->whereHas('listing', static function (Builder $query) use ($ownerId): void {
                $query->where('owner_user_id', $ownerId);
            });

        if ($ownerListingIds === []) {
            $quoteBase->whereRaw('1 = 0');
        } else {
            $quoteBase->whereIn('women_housing_listing_id', $ownerListingIds);
        }

        $totalQuotes = (clone $quoteBase)->count();
        $latestGeneratedAt = (clone $quoteBase)->max('generated_at');
        $averageRepaymentCents = (clone $quoteBase)->avg('calculated_repayment_cents');
        $riskBreakdown = (clone $quoteBase)
            ->select('risk_rating')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('risk_rating')
            ->pluck('aggregate', 'risk_rating')
            ->map(static fn ($count) => (int) $count)
            ->filter(static fn ($count, $risk) => $risk !== null)
            ->all();

        $dashboardSnapshot = [
            'total_quotes' => $totalQuotes,
            'latest_generated_at' => $latestGeneratedAt ? Carbon::parse($latestGeneratedAt) : null,
            'average_repayment_cents' => $averageRepaymentCents ? (int) round($averageRepaymentCents) : null,
            'risk_breakdown' => $riskBreakdown,
        ];

        $preferredRegion = $this->resolvePreferredRegion($currentUser);
        $liveMortgageRates = MortgageRateSnapshot::query()
            ->forRegion($preferredRegion)
            ->orderByDesc('captured_at')
            ->orderBy('interest_rate')
            ->limit(5)
            ->get();

        $portfolioAveragePrice = $portfolioAveragePriceCents ? (float) ($portfolioAveragePriceCents / 100) : null;
        $primaryRateSnapshot = $liveMortgageRates->first();

        $mortgageWidgetDefaults = $this->buildMortgageWidgetDefaults($portfolioAveragePrice, $primaryRateSnapshot);
        $rentVsBuyDefaults = $this->buildRentVsBuyDefaults($portfolioAveragePrice, $primaryRateSnapshot);
        $safetyTips = $this->housingSafetyTips();
        $virtualTourEmbeds = $this->gatherVirtualTourEmbeds($currentUser);

    $telemetrySummary = $telemetry->summariesFor(collect($listings->items())->pluck('id'));

        $refreshSeriesCollection = AnalyticsEvent::query()
            ->where('event', 'mortgage_widget_usage_summary')
            ->where('source', 'women_real_estate')
            ->where('received_at', '>=', Carbon::now()->subDays(3))
            ->orderByDesc('received_at')
            ->limit(36)
            ->get()
            ->reverse()
            ->map(static function (AnalyticsEvent $event) use ($ownerListingIds) {
                $metadata = $event->metadata ?? [];

                try {
                    $windowStartedAt = isset($metadata['window_started_at'])
                        ? Carbon::parse($metadata['window_started_at'])
                        : ($event->received_at ?? Carbon::now());
                } catch (\Throwable $exception) {
                    $windowStartedAt = $event->received_at ?? Carbon::now();
                }

                $ownerListings = collect($metadata['listings'] ?? [])
                    ->filter(static function ($listing) use ($ownerListingIds) {
                        $listingId = isset($listing['listing_id']) ? (int) $listing['listing_id'] : null;

                        return $listingId && in_array($listingId, $ownerListingIds, true);
                    });

                $channelAggregates = $ownerListings->reduce(static function (array $carry, array $listing) {
                    foreach (($listing['channel_breakdown'] ?? []) as $channel => $count) {
                        $carry[$channel] = ($carry[$channel] ?? 0) + (int) $count;
                    }

                    return $carry;
                }, []);

                $totalRefreshes = (int) $ownerListings->sum(static fn (array $listing) => (int) ($listing['total'] ?? 0));

                return [
                    'timestamp' => $windowStartedAt->toIso8601String(),
                    'label' => $windowStartedAt->format('M j · ga'),
                    'value' => $totalRefreshes,
                    'channels' => $channelAggregates,
                    'listings' => $ownerListings
                        ->map(static function (array $listing) {
                            $listingId = isset($listing['listing_id']) ? (int) $listing['listing_id'] : null;

                            return [
                                'listing_id' => $listingId,
                                'total' => (int) ($listing['total'] ?? 0),
                                'channel_breakdown' => collect($listing['channel_breakdown'] ?? [])
                                    ->map(static fn ($count) => (int) $count)
                                    ->all(),
                            ];
                        })
                        ->filter(static fn (array $listing) => $listing['listing_id'] !== null)
                        ->values()
                        ->all(),
                ];
            })
            ->values();

        $refreshSeries = $refreshSeriesCollection->all();

        $listingEngagement = $refreshSeriesCollection
            ->flatMap(static function (array $point) {
                return collect($point['listings'] ?? [])
                    ->map(static function (array $listing) use ($point) {
                        return [
                            'listing_id' => $listing['listing_id'],
                            'total' => $listing['total'],
                            'channels' => $listing['channel_breakdown'] ?? [],
                            'window_timestamp' => $point['timestamp'],
                        ];
                    });
            })
            ->groupBy('listing_id')
            ->map(static function ($entries) {
                $total = (int) $entries->sum('total');
                $channels = $entries->reduce(static function (array $carry, array $entry) {
                    foreach ($entry['channels'] as $channel => $count) {
                        $carry[$channel] = ($carry[$channel] ?? 0) + (int) $count;
                    }

                    return $carry;
                }, []);

                $latestWindow = $entries->map(static fn ($entry) => $entry['window_timestamp'])
                    ->filter()
                    ->map(static function ($timestamp) {
                        try {
                            return Carbon::parse($timestamp);
                        } catch (\Throwable $exception) {
                            return null;
                        }
                    })
                    ->filter()
                    ->sortDesc()
                    ->first();

                return [
                    'listing_id' => (int) $entries->first()['listing_id'],
                    'total' => $total,
                    'channels' => $channels,
                    'last_window_started_at' => $latestWindow,
                ];
            })
            ->sortByDesc('total')
            ->values();

        $channelTotals = $refreshSeriesCollection->reduce(static function (array $carry, array $point) {
            foreach (($point['channels'] ?? []) as $channel => $count) {
                $carry[$channel] = ($carry[$channel] ?? 0) + (int) $count;
            }

            return $carry;
        }, []);

        $topListingIds = $listingEngagement->take(3)->pluck('listing_id')->all();

        $topListingNames = $topListingIds
            ? WomenHousingListing::query()
                ->whereIn('id', $topListingIds)
                ->pluck('title', 'id')
                ->mapWithKeys(static fn ($title, $id) => [(int) $id => $title])
                ->all()
            : [];

        $topWindow = $refreshSeriesCollection
            ->sortByDesc('value')
            ->first();

        $refreshInsights = [
            'top_window' => $topWindow,
            'channel_totals' => $channelTotals,
            'top_listings' => $listingEngagement->all(),
            'top_listing_names' => $topListingNames,
        ];

        $socialConfig = (array) config('women_real_estate.social', []);
        $dashboardWindowDays = max(0, (int) ($socialConfig['dashboard_window_days'] ?? 30));
        $recentWindowDays = max(1, (int) ($socialConfig['recent_window_days'] ?? 7));
        $dashboardWindowStart = $dashboardWindowDays > 0 ? Carbon::now()->subDays($dashboardWindowDays) : null;
        $recentWindowStart = Carbon::now()->subDays($recentWindowDays);

        $socialShareQuery = AnalyticsEvent::query()
            ->where('event', 'women_housing_listing_social_share_generated')
            ->where('properties->owner_user_id', $ownerId);

        if ($dashboardWindowStart !== null) {
            $socialShareQuery->where('received_at', '>=', $dashboardWindowStart);
        }

        $socialShareEvents = $socialShareQuery
            ->orderByDesc('received_at')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $socialShareListingIds = $socialShareEvents
            ->map(static fn (AnalyticsEvent $event) => (int) data_get($event->properties, 'listing_id', 0))
            ->filter(static fn ($id) => $id > 0)
            ->unique()
            ->values();

        $socialShareListingTitles = $socialShareListingIds->isEmpty()
            ? collect()
            : WomenHousingListing::query()
                ->whereIn('id', $socialShareListingIds->all())
                ->pluck('title', 'id');

        $platformBreakdown = $socialShareEvents
            ->groupBy(static fn (AnalyticsEvent $event) => strtolower((string) data_get($event->properties, 'platform', 'direct')))
            ->map(static fn ($events) => $events->count())
            ->sortDesc()
            ->all();

        $listingBreakdown = $socialShareEvents
            ->groupBy(static fn (AnalyticsEvent $event) => (int) data_get($event->properties, 'listing_id', 0))
            ->filter(static fn ($events, $listingId) => (int) $listingId > 0)
            ->map(function ($events, $listingId) use ($socialShareListingTitles) {
                /** @var \Illuminate\Support\Collection $events */
                $latestEvent = $events
                    ->sortByDesc(static fn (AnalyticsEvent $event) => $event->received_at ?? $event->created_at)
                    ->first();

                $timestamp = $latestEvent?->received_at ?? $latestEvent?->created_at;

                return [
                    'listing_id' => (int) $listingId,
                    'title' => $socialShareListingTitles->get((int) $listingId, 'Listing #' . $listingId),
                    'count' => $events->count(),
                    'last_shared_at' => $timestamp,
                ];
            })
            ->sortByDesc('count')
            ->values()
            ->take(5)
            ->all();

        $latestShareEvent = $socialShareEvents->first();
        $latestShareAt = $latestShareEvent?->received_at ?? $latestShareEvent?->created_at;

        $recentWindowTotal = $socialShareEvents
            ->filter(static function (AnalyticsEvent $event) use ($recentWindowStart) {
                $timestamp = $event->received_at ?? $event->created_at;

                return $timestamp !== null && $timestamp >= $recentWindowStart;
            })
            ->count();

        $recentEvents = $socialShareEvents
            ->take(6)
            ->map(function (AnalyticsEvent $event) use ($socialShareListingTitles) {
                $properties = $event->properties ?? [];
                $metadata = $event->metadata ?? [];
                $listingId = (int) ($properties['listing_id'] ?? 0);
                $timestamp = $event->received_at ?? $event->created_at;

                return [
                    'listing_id' => $listingId,
                    'listing_title' => $listingId > 0
                        ? $socialShareListingTitles->get($listingId, $metadata['listing_title'] ?? ('Listing #' . $listingId))
                        : ($metadata['listing_title'] ?? null),
                    'platform' => $properties['platform'] ?? 'direct',
                    'reason' => $properties['reason'] ?? 'updated',
                    'share_url' => $properties['share_url'] ?? null,
                    'timestamp' => $timestamp,
                    'hashtags' => (array) ($metadata['hashtags'] ?? []),
                ];
            })
            ->values()
            ->all();

        $socialShareInsights = [
            'total_shares' => $socialShareEvents->count(),
            'unique_listings' => $socialShareListingIds->count(),
            'latest_share_at' => $latestShareAt,
            'platform_breakdown' => $platformBreakdown,
            'listing_breakdown' => $listingBreakdown,
            'recent_events' => $recentEvents,
            'recent_window_total' => $recentWindowTotal,
            'recent_window_label' => $recentWindowDays === 1 ? 'Last 24 hours' : 'Last ' . $recentWindowDays . ' days',
            'window_label' => $dashboardWindowDays > 0 ? 'Last ' . $dashboardWindowDays . ' days' : 'All time',
            'recent_window_start' => $recentWindowStart,
        ];

        $filters = [
            'search' => $searchTerm,
            'audiences' => $selectedAudiences,
        ];

        $hasActiveFilters = $filters['search'] !== '' || $filters['audiences'] !== [];

        $listingCollection = collect($listings->items());

        $socialShareCounts = collect($socialShareInsights['listing_breakdown'] ?? [])
            ->mapWithKeys(static function (array $row) {
                $listingId = isset($row['listing_id']) ? (int) $row['listing_id'] : 0;

                return $listingId > 0 ? [$listingId => (int) ($row['count'] ?? 0)] : [];
            });

        $aiSpotlight = [];

        foreach ($listingCollection->take(3) as $listingInstance) {
            /** @var WomenHousingListing $listingInstance */
            $aiSpotlight[$listingInstance->id] = $aiService->listingInsights($listingInstance, [
                'metrics' => [
                    'mortgage_quotes_count' => $listingInstance->mortgage_quotes_count ?? 0,
                    'photos_count' => $listingInstance->photos_count ?? 0,
                    'social_share_count' => (int) $socialShareCounts->get($listingInstance->id, 0),
                ],
            ]);
        }

        $moderationAssessments = [];

        $moderationCandidates = $listingCollection
            ->filter(static function ($listingInstance) {
                $status = (string) ($listingInstance->moderation_status ?? '');

                return in_array($status, ['pending', 'flagged', 'under_review', 'escalated'], true);
            })
            ->take(5);

        foreach ($moderationCandidates as $listingInstance) {
            /** @var WomenHousingListing $listingInstance */
            $moderationAssessments[$listingInstance->id] = $aiService->moderationAssessment($listingInstance);
        }

        $aiMetricsContext = [
            'dashboard' => $dashboardSnapshot,
            'social' => [
                'recent_window_total' => $socialShareInsights['recent_window_total'] ?? 0,
                'total_shares' => $socialShareInsights['total_shares'] ?? 0,
            ],
            'engagement' => [
                'top_window' => $refreshInsights['top_window'] ?? null,
                'channel_totals' => $refreshInsights['channel_totals'] ?? [],
            ],
        ];

        $recommendationListings = $listingCollection
            ->map(static function ($listingInstance) use ($socialShareCounts) {
                /** @var WomenHousingListing $listingInstance */
                return [
                    'id' => $listingInstance->id,
                    'title' => $listingInstance->title,
                    'audience' => $listingInstance->audience,
                    'mortgage_quotes_count' => $listingInstance->mortgage_quotes_count ?? 0,
                    'moderation_status' => $listingInstance->moderation_status,
                    'social_share_count' => (int) $socialShareCounts->get($listingInstance->id, 0),
                    'published_at' => optional($listingInstance->published_at)->toIso8601String(),
                ];
            })
            ->all();

        $aiRecommendations = $aiService->ownerRecommendations($ownerId, [
            'metrics' => $aiMetricsContext,
            'listings' => $recommendationListings,
        ]);

        return view('women.real-estate.listings.index', compact(
            'listings',
            'dashboardSnapshot',
            'telemetrySummary',
            'refreshSeries',
            'refreshInsights',
            'availableAudiences',
            'filters',
            'hasActiveFilters',
            'socialShareInsights',
            'aiSpotlight',
            'aiRecommendations',
            'moderationAssessments',
            'liveMortgageRates',
            'mortgageWidgetDefaults',
            'rentVsBuyDefaults',
            'safetyTips',
            'virtualTourEmbeds',
            'roleGates'
        ));
    }

    public function create(): View
    {
        $user = Auth::user();

        if (! $user) {
            abort(403);
        }

        if (! $user->email_verified_at) {
            return view('women.real-estate.listings.verification-required');
        }

        if (! Gate::allows('create', WomenListing::class)) {
            return view('women.real-estate.listings.verification-required');
        }

        $agentProfile = $user->agentProfile;

        return view('women.real-estate.listings.create', compact('agentProfile'));
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', WomenHousingListing::class);

        $data = $this->validatedData($request);
        $data['owner_user_id'] = Auth::id();

    $listing = WomenHousingListing::create($data);

    $this->syncListingPhotos($listing, $request);
    $listing->refresh();
    $this->queueSocialAmplification($listing, 'published');

        // @todo integrate AI tagging and mortgage insights capture.

        return redirect()
            ->route('women.real-estate.listings.show', $listing)
            ->with('status', 'Listing created successfully.');
    }

    public function show(WomenHousingListing $listing): View
    {
        $this->authorize('view', $listing);

        $currentUser = Auth::user();

        $listing->load([
            'photos' => static fn ($query) => $query->orderBy('position'),
            'agentProfile.user',
            'partnershipIntentions' => static fn ($query) => $query
                ->with('initiator')
                ->latest('created_at'),
            'mortgageQuotes' => static fn ($query) => $query
                ->with('rateSnapshot')
                ->latest('generated_at')
                ->limit(6),
        ]);

        $canViewAllIntentions = $currentUser && (int) $currentUser->id === (int) $listing->owner_user_id;
        $viewerIntentions = $currentUser
            ? $listing->partnershipIntentions->where('initiator_user_id', $currentUser->id)->values()
            : collect();

        $targetAudiences = match ($listing->listing_type) {
            'investment' => ['investor'],
            default => ['owner_occupier', 'first_home'],
        };

        $availableRateSnapshots = MortgageRateSnapshot::query()
            ->forRegion('AU')
            ->whereIn('available_to', $targetAudiences)
            ->orderByDesc('captured_at')
            ->orderByDesc('created_at')
            ->limit(12)
            ->get();

        return view('women.real-estate.listings.show', compact(
            'listing',
            'canViewAllIntentions',
            'viewerIntentions',
            'availableRateSnapshots'
        ));
    }

    public function edit(WomenHousingListing $listing): View
    {
        $this->authorize('update', $listing);

        $listing->load(['photos' => static fn ($query) => $query->orderBy('position')]);

        $agentProfile = Auth::user()->agentProfile;

        $wizardListing = WomenListing::find($listing->id);

        if ($wizardListing !== null) {
            Gate::authorize('update', $wizardListing);
        }

        $wizardListingId = $wizardListing?->id;

        return view('women.real-estate.listings.edit', compact('listing', 'agentProfile', 'wizardListingId'));
    }

    public function update(Request $request, WomenHousingListing $listing): RedirectResponse
    {
        $this->authorize('update', $listing);

    $previousVisibility = (string) $listing->visibility;

        $data = $this->validatedData($request, $listing->id);
        $listing->update($data);

        $this->syncListingPhotos($listing, $request);
        $listing->refresh();

        $reason = $previousVisibility !== 'public' && $listing->visibility === 'public'
            ? 'published'
            : 'updated';

        $this->queueSocialAmplification($listing, $reason);

        // @todo queue AI refresh when listing is updated.

        return redirect()
            ->route('women.real-estate.listings.show', $listing)
            ->with('status', 'Listing updated successfully.');
    }

    public function destroy(WomenHousingListing $listing): RedirectResponse
    {
        $this->authorize('delete', $listing);

        $listing->delete();

        return redirect()
            ->route('women.real-estate.listings.index')
            ->with('status', 'Listing removed.');
    }

    /**
     * @return (bool|int|mixed|null)[]
     *
     * @psalm-return array{mortgage_required: bool, agent_profile_id: int|null,...}
     */
    private function validatedData(Request $request, ?int $ignoreId = null): array
    {
        $uniqueSlugRule = 'unique:women_housing_listings,slug';
        if ($ignoreId) {
            $uniqueSlugRule .= ',' . $ignoreId;
        }

        $validator = validator($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', $uniqueSlugRule],
            'listing_type' => ['required', 'in:rent_shared,rent_private,buy,investment'],
            'audience' => ['required', 'in:women_only,women_students,women_professionals,women_caregivers,women_retirees'],
            'description' => ['nullable', 'string'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'size:3'],
            'bond_cents' => ['nullable', 'integer', 'min:0'],
            'mortgage_required' => ['sometimes', 'boolean'],
            'location' => ['nullable', 'array'],
            'location.address_line1' => ['nullable', 'string', 'max:255'],
            'location.suburb' => ['nullable', 'string', 'max:120'],
            'location.state' => ['nullable', 'string', 'max:120'],
            'location.postcode' => ['nullable', 'string', 'max:12'],
            'location.country' => ['nullable', 'string', 'size:2'],
            'location.lat' => ['nullable', 'numeric'],
            'location.lng' => ['nullable', 'numeric'],
            'amenities' => ['nullable'],
            'availability_date' => ['nullable', 'date'],
            'verification_status' => ['nullable', 'in:pending,verified,rejected'],
            'moderation_status' => ['nullable', 'in:clean,flagged,under_review'],
            'visibility' => ['nullable', 'in:public,community,private'],
            'agent_profile_id' => ['nullable', 'integer', 'exists:agent_profiles,id'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_photo_ids' => ['sometimes', 'array'],
            'remove_photo_ids.*' => ['integer'],
            'primary_photo_id' => ['nullable', 'integer'],
        ]);

        $validated = $validator->validate();

        if (isset($validated['amenities']) && is_string($validated['amenities'])) {
            $decodedAmenities = json_decode($validated['amenities'], true);
            $validated['amenities'] = is_array($decodedAmenities) ? $decodedAmenities : null;
        }

        $validated['mortgage_required'] = (bool) ($validated['mortgage_required'] ?? false);

        $agentProfileId = $request->input('agent_profile_id');
        if ($agentProfileId) {
            $agentProfile = Auth::user()->agentProfile;
            if (! $agentProfile || (int) $agentProfile->id !== (int) $agentProfileId) {
                abort(403, 'You can only attach your own agent profile.');
            }

            $validated['agent_profile_id'] = (int) $agentProfileId;
        } else {
            $validated['agent_profile_id'] = null;
        }

        unset($validated['photos'], $validated['remove_photo_ids'], $validated['primary_photo_id']);

        return $validated;
    }

    private function syncListingPhotos(WomenHousingListing $listing, Request $request): void
    {
        $removeIds = collect($request->input('remove_photo_ids', []))
            ->filter(static fn ($value) => is_numeric($value))
            ->map(static fn ($value) => (int) $value);

        if ($removeIds->isNotEmpty()) {
            $listing->photos()
                ->whereIn('id', $removeIds->all())
                ->get()
                ->each(function (WomenListingPhoto $photo): void {
                    $this->mediaPipeline->remove($photo);
                });
        }

        $newPhotos = $request->file('photos', []);

        foreach ($newPhotos as $uploadedFile) {
            if (! $uploadedFile) {
                continue;
            }

            $this->mediaPipeline->upload($listing, $uploadedFile, [
                'meta' => [
                    'original_name' => $uploadedFile->getClientOriginalName(),
                    'mime_type' => $uploadedFile->getClientMimeType(),
                    'size_bytes' => $uploadedFile->getSize(),
                ],
            ]);
        }

        $primaryId = $request->input('primary_photo_id');
        if ($primaryId) {
            $target = $listing->photos()->whereKey((int) $primaryId)->first();

            if ($target) {
                $this->mediaPipeline->updateMeta($target, ['is_primary' => true]);
            }
        }
    }

    private function queueSocialAmplification(WomenHousingListing $listing, string $reason): void
    {
        if (! config('women_real_estate.features.social_amplification')) {
            return;
        }

        if ($listing->visibility !== 'public') {
            return;
        }

        $cooldownMinutes = max(0, (int) config('women_real_estate.social.dispatch_cooldown_minutes', 0));

        if ($cooldownMinutes > 0) {
            $cacheKey = 'women_real_estate:social_dispatch:' . $listing->id;
            $now = Carbon::now();
            $lastDispatched = Cache::get($cacheKey);

            if ($lastDispatched) {
                $lastDispatchedAt = $lastDispatched instanceof Carbon
                    ? $lastDispatched
                    : Carbon::createFromTimestamp((int) $lastDispatched);

                if ($lastDispatchedAt->greaterThanOrEqualTo($now->copy()->subMinutes($cooldownMinutes))) {
                    return;
                }
            }

            Cache::put($cacheKey, $now->getTimestamp(), $cooldownMinutes * 60);
        }

        \App\Jobs\WomenRealEstate\GenerateHousingListingSocialShareJob::dispatch($listing->id, $reason);
    }

    private function ensureHousingRole(?User $user): void
    {
        if (! $user) {
            abort(403, 'Sign in to view the housing console.');
        }

        if ($user->hasAnyPlatformRole(['real_estate_agent', 'real_estate_seeker'])) {
            return;
        }

        if ($user->real_estate_onboarded_at) {
            return;
        }

        abort(403, 'Housing workflows are limited to verified women real estate roles.');
    }

    private function resolvePreferredRegion(?User $user): string
    {
        $location = $user?->location;

        if (is_array($location) && ! empty($location['country'])) {
            return strtoupper($location['country']);
        }

        if (is_string($location)) {
            $normalized = Str::upper($location);

            if (Str::contains($normalized, ['NZ', 'NEW ZEALAND'])) {
                return 'NZ';
            }
        }

        return 'AU';
    }

    /**
     * @return (float|int)[]
     *
     * @psalm-return array{home_price: float, deposit_percent: 15, interest_rate: float, term_years: 30, monthly_repayment: float}
     */
    private function buildMortgageWidgetDefaults(?float $portfolioPrice, ?MortgageRateSnapshot $rateSnapshot): array
    {
        $homePrice = $portfolioPrice && $portfolioPrice > 0 ? $portfolioPrice : 650000;
        $depositPercent = 15;
        $interestRate = $rateSnapshot?->interest_rate ?? 5.9;
        $termYears = 30;

        $loanAmount = $homePrice * (1 - ($depositPercent / 100));
        $monthlyRepayment = $this->calculateMonthlyRepayment($loanAmount, $interestRate, $termYears);

        return [
            'home_price' => round($homePrice, 2),
            'deposit_percent' => $depositPercent,
            'interest_rate' => round($interestRate, 2),
            'term_years' => $termYears,
            'monthly_repayment' => $monthlyRepayment,
        ];
    }

    /**
     * @return (float|int)[]
     *
     * @psalm-return array{home_price: float, deposit_percent: 20, interest_rate: float, term_years: 30, monthly_mortgage: float, weekly_rent: float, rent_growth_rate: float}
     */
    private function buildRentVsBuyDefaults(?float $portfolioPrice, ?MortgageRateSnapshot $rateSnapshot): array
    {
        $homePrice = $portfolioPrice && $portfolioPrice > 0 ? $portfolioPrice : 650000;
        $depositPercent = 20;
        $interestRate = $rateSnapshot?->interest_rate ?? 5.9;
        $termYears = 30;
        $loanAmount = $homePrice * (1 - ($depositPercent / 100));
        $monthlyRepayment = $this->calculateMonthlyRepayment($loanAmount, $interestRate, $termYears);
        $weeklyRent = $this->estimateWeeklyRent($homePrice);

        return [
            'home_price' => round($homePrice, 2),
            'deposit_percent' => $depositPercent,
            'interest_rate' => round($interestRate, 2),
            'term_years' => $termYears,
            'monthly_mortgage' => $monthlyRepayment,
            'weekly_rent' => $weeklyRent,
            'rent_growth_rate' => 3.2,
        ];
    }

    private function estimateWeeklyRent(float $homePrice): float
    {
        $annualRent = $homePrice * 0.042; // 4.2% gross yield heuristic

        return round($annualRent / 52, 2);
    }

    private function calculateMonthlyRepayment(float $loanAmount, float $annualRate, int $termYears): float
    {
        $monthlyRate = ($annualRate / 100) / 12;
        $months = max(1, $termYears * 12);

        if ($monthlyRate <= 0) {
            return round($loanAmount / $months, 2);
        }

        $factor = pow(1 + $monthlyRate, -$months);

        return round(($loanAmount * $monthlyRate) / (1 - $factor), 2);
    }

    private function gatherVirtualTourEmbeds(?User $user): array
    {
        if (! $user) {
            return [];
        }

        return $user->womenRealEstateMedia()
            ->where('media_type', 'virtual_tour')
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->take(3)
            ->get()
            ->map(function ($media) {
                /** @var \App\Models\WomenRealEstate\WomenUserMedia $media */
                $disk = $media->disk ?: 'public';
                $path = $media->path;

                if (! $path) {
                    return null;
                }

                /** @var FilesystemAdapter $filesystem */
                $filesystem = Storage::disk($disk);

                if (! $filesystem->exists($path)) {
                    return null;
                }

                return [
                    'id' => $media->id,
                    'caption' => $media->caption ?? 'Immersive tour',
                    'url' => $filesystem->url($path),
                    'media_type' => $media->media_type,
                    'meta' => $media->meta ?? [],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{title: 'Stress-test repayments early', detail: 'Average repayments jumped by $880/month in 2024. Run worst-case scenarios before presenting offers.', source: 'Critical Problems Women Face – Financial Barriers'}, array{title: 'Safeguard single-parent households', detail: 'Single mothers experience the sharpest affordability pressure. Flag relief options and grant pathways up front.', source: 'Critical Problems Women Face – Mortgages & Housing'}, array{title: 'Counter financial abuse signals', detail: 'Women fleeing violence struggle with utilities and essential services. Offer anonymous viewing slots and paused-deposit workflows.', source: 'Critical Problems Women Face – Insurance & Subscriptions'}}
     */
    private function housingSafetyTips(): array
    {
        return [
            [
                'title' => 'Stress-test repayments early',
                'detail' => 'Average repayments jumped by $880/month in 2024. Run worst-case scenarios before presenting offers.',
                'source' => 'Critical Problems Women Face – Financial Barriers',
            ],
            [
                'title' => 'Safeguard single-parent households',
                'detail' => 'Single mothers experience the sharpest affordability pressure. Flag relief options and grant pathways up front.',
                'source' => 'Critical Problems Women Face – Mortgages & Housing',
            ],
            [
                'title' => 'Counter financial abuse signals',
                'detail' => 'Women fleeing violence struggle with utilities and essential services. Offer anonymous viewing slots and paused-deposit workflows.',
                'source' => 'Critical Problems Women Face – Insurance & Subscriptions',
            ],
        ];
    }
}

