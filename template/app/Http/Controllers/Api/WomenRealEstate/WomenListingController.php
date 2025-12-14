<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\WomenRealEstate;

use App\Events\WomenRealEstate\WomenListingPublished;
use App\Http\Controllers\Controller;
use App\Http\Requests\WomenRealEstate\WomenListingIndexRequest;
use App\Http\Requests\WomenRealEstate\WomenListingPublishRequest;
use App\Http\Requests\WomenRealEstate\WomenListingStoreRequest;
use App\Http\Requests\WomenRealEstate\WomenListingUpdateRequest;
use App\Http\Resources\WomenRealEstate\WomenListingResource;
use App\Models\WomenRealEstate\WomenListing;
use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract as WomenListingAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

final class WomenListingController extends Controller
{
    public function __construct(private readonly WomenListingAnalyticsService $analytics)
    {
        $this->middleware('auth:sanctum');
    }

    public function index(WomenListingIndexRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', WomenListing::class);

        $filters = $request->validated();
        $perPage = $filters['per_page'] ?? 15;

        $user = $request->user();
        $canModerate = $this->userCanModerate($user);

        $query = WomenListing::query()
            ->with(self::defaultRelations());

        $this->analytics->applyFilters($query, $filters, $canModerate, $user);

        $query->latest('created_at');

        $paginator = $query->paginate($perPage)->appends($request->query());

        return WomenListingResource::collection($paginator);
    }

    public function metrics(WomenListingIndexRequest $request): JsonResponse
    {
        $this->authorize('viewAny', WomenListing::class);

        $filters = $request->validated();
        $user = $request->user();
        $canModerate = $this->userCanModerate($user);

        $refreshCache = (bool) ($filters['refresh_cache'] ?? false);
        $includeAgentDetails = array_key_exists('include_agent_details', $filters)
            ? (bool) $filters['include_agent_details']
            : true;

        unset($filters['refresh_cache']);

        $metrics = $this->analytics->metrics(
            $filters,
            $canModerate,
            $user,
            $refreshCache,
            $includeAgentDetails
        );

        return response()->json($metrics);
    }

    public function show(Request $request, WomenListing $listing): WomenListingResource
    {
        $this->authorize('view', $listing);

        $listing->loadMissing(self::defaultRelations());

        return new WomenListingResource($listing);
    }

    public function store(WomenListingStoreRequest $request): JsonResponse
    {
        $this->authorize('create', WomenListing::class);

        $validated = $this->preparePayload($request->validated());
        $listing = WomenListing::create($validated + ['owner_id' => $request->user()->id]);

        $this->syncAudiences($listing, $validated);
        $this->analytics->invalidateMetricsCache();

        return (new WomenListingResource($listing->load(self::defaultRelations())))->response()->setStatusCode(201);
    }

    public function update(WomenListingUpdateRequest $request, WomenListing $listing): WomenListingResource
    {
        $this->authorize('update', $listing);

        $validated = $this->preparePayload($request->validated());
        $listing->fill($validated);
        $listing->save();

        $this->syncAudiences($listing, $validated);
        $this->analytics->invalidateMetricsCache();

        return new WomenListingResource($listing->load(self::defaultRelations()));
    }

    public function publish(WomenListingPublishRequest $request, WomenListing $listing): WomenListingResource
    {
        $this->authorize('publish', $listing);

        $publishedAtInput = $request->validated('published_at');
        $appTimezone = config('app.timezone', 'UTC');
        $publishedAt = $publishedAtInput !== null
            ? Carbon::parse($publishedAtInput)->setTimezone($appTimezone)
            : Carbon::now($appTimezone);

        $listing->forceFill([
            'published_at' => $publishedAt,
        ])->save();

        $listing->refresh()->load(self::defaultRelations());

        WomenListingPublished::dispatch($listing);
        $this->analytics->invalidateMetricsCache();

        return new WomenListingResource($listing);
    }

    public function unpublish(Request $request, WomenListing $listing): WomenListingResource
    {
        $this->authorize('publish', $listing);

        $listing->forceFill([
            'published_at' => null,
        ])->save();

        $listing->refresh()->load(self::defaultRelations());
        $this->analytics->invalidateMetricsCache();

        return new WomenListingResource($listing);
    }

    /**
     * @return (\Closure|string)[]
     *
     * @psalm-return array{0: 'agent', 1: 'category', 2: 'location', 3: 'audiences', media: \Closure(mixed):mixed, socialShares: \Closure(mixed):mixed}
     */
    private static function defaultRelations(): array
    {
        return [
            'agent',
            'category',
            'location',
            'audiences',
            'media' => static fn ($query) => $query->orderBy('position'),
            'socialShares' => static fn ($query) => $query->orderByDesc('shared_at')->limit(5),
        ];
    }

    private function preparePayload(array $data): array
    {
        if (array_key_exists('audience_overrides', $data)) {
            $data['audience_overrides'] = $this->normalizeAudienceOverrides($data['audience_overrides']);
        }

        if (array_key_exists('features', $data)) {
            $data['features'] = $data['features'] === null
                ? null
                : $this->normalizeArray($data['features']);
        }

        if (array_key_exists('ai_insights', $data)) {
            $data['ai_insights'] = $data['ai_insights'] === null
                ? null
                : $this->normalizeArray($data['ai_insights']);
        }

        return $data;
    }

    /**
     * @psalm-return array<int, mixed>|null
     */
    private function normalizeAudienceOverrides(?array $overrides): array|null
    {
        if ($overrides === null) {
            return null;
        }

        $normalized = collect($overrides)
            ->filter(static fn ($value) => $value !== null && $value !== '')
            ->unique()
            ->values()
            ->all();

        return $normalized === [] ? null : $normalized;
    }

    private function normalizeArray(array $value): array
    {
        return collect($value)
            ->filter(static fn ($item) => $item !== null && $item !== '')
            ->all();
    }

    private function syncAudiences(WomenListing $listing, array $payload): void
    {
        $primary = array_key_exists('primary_audience', $payload)
            ? $payload['primary_audience']
            : ($listing->primary_audience?->value ?? null);

        $overrides = $payload['audience_overrides'] ?? ($listing->audience_overrides ?? []);

        $audiences = collect([$primary])
            ->merge(is_array($overrides) ? $overrides : [])
            ->filter()
            ->unique()
            ->values();

        if ($audiences->isEmpty()) {
            $listing->audiences()->delete();

            return;
        }

        $listing->audiences()->whereNotIn('audience', $audiences->all())->delete();

        $audiences->each(function (string $audience) use ($listing): void {
            $listing->audiences()->firstOrCreate(['audience' => $audience]);
        });

        $listing->refresh();
    }

    private function userCanModerate($user): bool
    {
        return $user !== null && method_exists($user, 'hasAnyRole')
            ? $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator'])
            : false;
    }
}

