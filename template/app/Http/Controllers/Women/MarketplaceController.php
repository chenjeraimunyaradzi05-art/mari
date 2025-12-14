<?php

namespace App\Http\Controllers\Women;

use App\Http\Controllers\Controller;
use App\Models\BankTransactionContext;
use App\Models\Lead;
use App\Models\ServiceListing;
use App\Models\ServiceListingLead;
use App\Services\Advertising\HomepageSponsorService;
use App\Services\AiContextHistoryService;
use App\Services\RealTimeAnalyticsEngine;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\View\View;
use JsonException;

final class MarketplaceController extends Controller
{
    public function __construct(
        private readonly HomepageSponsorService $homepageSponsors,
        private readonly AiContextHistoryService $history,
        private readonly RealTimeAnalyticsEngine $analytics,
    ) {
    }

    public function index(Request $request): View
    {
        $categories = collect(config('women_marketplace.categories', []));
        $filters = collect(config('women_marketplace.filters', []));
        $query = $this->buildQuery($request);

        $listings = $this->buildListingQuery($query)->get();
        $categoryCounts = ServiceListing::published()
            ->selectRaw('category, COUNT(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $aiContexts = $request->user()
            ? $this->history
                ->latest($request->user()->id, 4, 'women_marketplace', 'women-marketplace')
                ->map(fn (BankTransactionContext $context) => $this->formatHistoryEntry($context))
                ->filter(fn (array $entry) => ! empty($entry['context_payload']))
            : collect();

        return view('women.marketplace.index', [
            'stats' => $this->buildStats(),
            'categories' => $categories,
            'filters' => $filters,
            'categoryCounts' => $categoryCounts,
            'listings' => $listings,
            'totalListings' => ServiceListing::published()->count(),
            'totalResults' => $listings->count(),
            'query' => $query,
            'appliedFilters' => $this->describeAppliedFilters($filters, $query, $categories),
            'heroSponsors' => $this->homepageSponsors->forSlot('marketplace-hero'),
            'sidebarSponsors' => $this->homepageSponsors->forSlot('marketplace-sidebar'),
            'spotlightSponsors' => $this->homepageSponsors->forSlot('marketplace-spotlight'),
            'aiContexts' => $aiContexts,
        ]);
    }

    public function __invoke(Request $request): View
    {
        return $this->index($request);
    }

    public function storeLead(Request $request, ServiceListing $serviceListing): RedirectResponse
    {
        $this->authorize('expressInterest', $serviceListing);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:600'],
            'return_to' => ['nullable', 'url'],
            'filters' => ['nullable', 'array'],
            'filters.*' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $contactName = $user?->preferred_name ?? $user?->name;

        $lead = ServiceListingLead::create([
            'service_listing_id' => $serviceListing->id,
            'user_id' => $user?->id,
            'contact_name' => $contactName,
            'contact_email' => $user?->email,
            'contact_phone' => $user?->phone ?? $user?->mobile ?? null,
            'source' => 'women_marketplace',
            'status' => 'new',
            'notes' => $data['notes'] ?? null,
            'metadata' => array_filter([
                'filters' => $data['filters'] ?? [],
                'user_agent' => $request->userAgent(),
            ]),
        ]);

        if ($serviceListing->org_page_id) {
            $orgLead = Lead::create([
                'org_page_id' => $serviceListing->org_page_id,
                'type' => 'women_marketplace',
                'contact_name' => $contactName,
                'contact_email' => $user?->email,
                'contact_phone' => $user?->phone ?? $user?->mobile ?? null,
                'payload' => [
                    'service_listing_id' => $serviceListing->id,
                    'service_listing_slug' => $serviceListing->slug,
                    'filters' => $data['filters'] ?? [],
                ],
                'source' => 'women_marketplace',
                'status' => 'new',
                'submitted_at' => now(),
            ]);

            $lead->update(['lead_id' => $orgLead->id]);
        }

        $this->analytics->record('marketplace.listing.lead_submitted', [
            'properties' => [
                'user_id' => $user?->id,
                'service_listing_id' => $serviceListing->id,
                'service_listing_slug' => $serviceListing->slug,
                'category' => $serviceListing->category,
                'price_tier' => $serviceListing->price_tier,
                'is_sponsored' => $serviceListing->is_sponsored,
            ],
            'metadata' => [
                'filters' => $data['filters'] ?? [],
                'notes_length' => strlen($data['notes'] ?? ''),
            ],
        ]);

        return redirect()->to($data['return_to'] ?? route('women.marketplace.index'))
            ->with('marketplace_status', sprintf('We shared your intro request with %s.', $serviceListing->name));
    }

    public function shareWithAthena(Request $request, ServiceListing $serviceListing): RedirectResponse
    {
        $this->authorize('view', $serviceListing);

        $data = $request->validate([
            'prompt' => ['nullable', 'string', 'max:600'],
            'filters' => ['nullable', 'array'],
            'filters.*' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        abort_unless($user, 403);

        $prompt = trim($data['prompt'] ?? '') ?: sprintf(
            'Could you compare %s (%s) with similar trauma-aware services? Include childcare or access perks if available.',
            $serviceListing->name,
            trim(($serviceListing->city ? $serviceListing->city.', ' : '').($serviceListing->state ?? '')) ?: $serviceListing->categoryLabel()
        );

        $selection = [[
            'id' => $serviceListing->slug,
            'description' => $serviceListing->name,
            'amount' => null,
            'direction' => 'info',
            'status' => $serviceListing->categoryLabel(),
            'flagged' => $serviceListing->is_sponsored,
            'category' => sprintf('%s • %s', ucfirst($serviceListing->price_tier ?? 'Flexible'), $serviceListing->location_label ?? 'Nationwide'),
            'account' => implode(' • ', array_filter([
                $serviceListing->price_copy,
                $serviceListing->booking_cta,
            ])),
            'posted_at' => $serviceListing->published_at?->toDateString(),
            'ai_suggestions' => [$serviceListing->description],
        ]];

        $snapshot = [
            'token' => (string) Str::uuid(),
            'surface' => 'women_marketplace',
            'generated_at' => now()->toIso8601String(),
            'selection_total' => 1,
            'filters' => $data['filters'] ?? [],
            'selection' => $selection,
        ];

        try {
            $contextPayload = base64_encode(json_encode($snapshot, JSON_THROW_ON_ERROR));
        } catch (JsonException) {
            $contextPayload = null;
        }

        $this->history->store($user->id, 'women-marketplace', [
            'token' => $snapshot['token'],
            'filters' => $snapshot['filters'],
            'selection_preview' => $selection,
            'selection_total' => 1,
            'prompt' => $prompt,
            'context_payload' => $contextPayload,
            'surface' => 'women_marketplace',
        ]);

        $this->analytics->record('marketplace.ai.hand_off', [
            'properties' => [
                'user_id' => $user->id,
                'service_listing_id' => $serviceListing->id,
                'category' => $serviceListing->category,
            ],
            'metadata' => [
                'filters' => $data['filters'] ?? [],
            ],
        ]);

        return redirect()->route('ai.concierge', array_filter([
            'context' => 'women-marketplace',
            'prompt' => $prompt,
            'context_payload' => $contextPayload,
        ]));
    }

    public function sponsorRedirect(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'slot' => ['required', 'string', 'max:64'],
            'sponsor' => ['nullable', 'string', 'max:160'],
            'redirect' => ['required', 'url'],
            'signature' => ['nullable', 'string', 'max:128'],
            'creative_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();

        $this->analytics->record('marketplace.sponsor.clicked', [
            'properties' => [
                'user_id' => $user?->id,
                'slot' => $data['slot'],
                'sponsor_label' => $data['sponsor'],
                'creative_id' => $data['creative_id'] ?? null,
            ],
            'metadata' => [
                'signature' => $data['signature'] ?? null,
                'redirect' => $data['redirect'],
            ],
        ]);

        return redirect()->away($data['redirect']);
    }

    private function buildListingQuery(array $query): \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder
    {
        return ServiceListing::query()
            ->with('orgPage')
            ->published()
            ->when($query['category'], fn (Builder $builder, string $value) => $builder->where('category', $value))
            ->when($query['location'], fn (Builder $builder, string $value) => $builder->where('location_slug', $value))
            ->when($query['price'], fn (Builder $builder, string $value) => $builder->where('price_tier', $value))
            ->when($query['modality'], fn (Builder $builder, string $value) => $builder->whereJsonContains('modalities', $value))
            ->when($query['availability'], fn (Builder $builder, string $value) => $builder->whereJsonContains('availability_options', $value))
            ->when($query['q'], function (Builder $builder) use ($query) {
                $needle = '%' . Str::lower($query['q']) . '%';

                $builder->where(function (Builder $search) use ($needle) {
                    $search
                        ->whereRaw('LOWER(name) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(description) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(city) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(state) LIKE ?', [$needle]);
                });
            })
            ->when($query['sort'] === 'rating', fn (Builder $builder) => $builder->orderByDesc('rating'))
            ->when($query['sort'] === 'newest', fn (Builder $builder) => $builder->orderByDesc('published_at'))
            ->orderByDesc('is_sponsored')
            ->orderByDesc('featured_until')
            ->orderByDesc('published_at');
    }

    /**
     * @return string[]
     *
     * @psalm-return array{q: string, category: string, location: string, price: string, modality: string, availability: string, sort: string}
     */
    private function buildQuery(Request $request): array
    {
        return [
            'q' => trim((string) $request->string('q')),
            'category' => $request->string('category')->lower()->value(),
            'location' => $request->string('location')->lower()->value(),
            'price' => $request->string('price')->lower()->value(),
            'modality' => $request->string('modality')->lower()->value(),
            'availability' => $request->string('availability')->lower()->value(),
            'sort' => $request->string('sort')->lower()->value(),
        ];
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return list{0?: array{label: string, value: mixed|string}, 1?: array{label: string, value: mixed|string}, 2?: array{label: string, value: mixed|string},...}
     */
    private function describeAppliedFilters(Collection $filters, array $query, Collection $categories): array
    {
        $applied = [];

        if ($query['q']) {
            $applied[] = ['label' => 'Search', 'value' => $query['q']];
        }

        if ($query['category']) {
            $applied[] = ['label' => 'Category', 'value' => $categories[$query['category']]['label'] ?? Str::headline($query['category'])];
        }

        foreach ([
            'location' => 'locations',
            'price' => 'price_ranges',
            'modality' => 'modalities',
            'availability' => 'availability',
        ] as $queryKey => $filterGroup) {
            $value = $query[$queryKey] ?? null;

            if (! $value) {
                continue;
            }

            $label = $this->findFilterLabel($filters, $filterGroup, $value);

            $applied[] = [
                'label' => Str::headline(str_replace('_', ' ', $queryKey)),
                'value' => $label ?? Str::headline($value),
            ];
        }

        return $applied;
    }

    private function findFilterLabel(Collection $filters, string $group, ?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        return collect($filters->get($group, []))
            ->firstWhere('value', $value)['label'] ?? null;
    }

    /**
     * @return (int|mixed|string)[]
     *
     * @psalm-return array{live_listings: int, sponsored_perks: int, states_represented: int, community_requests: '—'|mixed}
     */
    private function buildStats(): array
    {
        $defaults = config('women_marketplace.stats', []);

        return [
            'live_listings' => ServiceListing::published()->count(),
            'sponsored_perks' => ServiceListing::published()->where('is_sponsored', true)->count(),
            'states_represented' => ServiceListing::published()->whereNotNull('state')->distinct('state')->count('state'),
            'community_requests' => $defaults['community_requests'] ?? '—',
        ];
    }

    /**
     * @return (\Illuminate\Support\Carbon|array|int|null|string)[]
     *
     * @psalm-return array{prompt: string, filters: array, selection_total: int, context_payload: string, token: string, created_at: \Illuminate\Support\Carbon|null}
     */
    private function formatHistoryEntry(BankTransactionContext $context): array
    {
        return [
            'prompt' => $context->prompt ?? 'Marketplace reflection',
            'filters' => $context->filters ?? [],
            'selection_total' => $context->selection_total,
            'context_payload' => $context->context_payload,
            'token' => $context->token,
            'created_at' => $context->created_at,
        ];
    }
}

