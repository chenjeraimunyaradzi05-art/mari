<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\AiContextHistoryService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class HousingExperienceController extends Controller
{
    public function index(Request $request): View
    {
        $listings = $this->listings();
        $page = max(1, (int) $request->integer('page', 1));
        $perPage = 6;

        $paginator = new LengthAwarePaginator(
            $listings->forPage($page, $perPage)->values(),
            $listings->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $defaultMortgage = $this->mortgagePayload();
        $mortgageInputs = $defaultMortgage['inputs'] ?? [];
        $mortgageResults = $this->mortgageResults($mortgageInputs);
        $housingContext = $this->buildHousingConciergePayload($listings, $mortgageInputs, $mortgageResults);

        return view('housing.index', [
            'filters' => [
                'locations' => ['All', 'Inner Melbourne', 'Sydney CBD', 'Gold Coast'],
                'types' => ['Apartment', 'Townhouse', 'Co-living', 'Regional land'],
                'budgets' => ['$500k', '$750k', '$1M', '$1.2M+'],
                'bedrooms' => ['1+', '2+', '3+', '4+'],
                'listing_types' => ['Rent', 'Buy', 'Co-buying'],
            ],
            'listings' => $paginator,
            'aiConciergePayloads' => $housingContext
                ? ['housing-mortgage-education' => $housingContext]
                : [],
            'aiConciergeSurface' => 'housing_dashboard',
        ]);
    }

    public function show(string $listing): View
    {
        $listingData = $this->findListing($listing);

        return view('housing.show', [
            'listing' => $listingData,
        ]);
    }

    public function preferences(): View
    {
        return view('housing.preferences');
    }

    public function storePreferences(Request $request): \Illuminate\Http\RedirectResponse
    {
        // Validate the request
        $request->validate([
            'locations' => 'nullable|string',
            'property_types' => 'nullable|array',
            'bedrooms' => 'nullable|string',
            'bathrooms' => 'nullable|string',
            'parking' => 'nullable|string',
            'min_price' => 'nullable|numeric',
            'max_price' => 'nullable|numeric',
            'move_in_date' => 'nullable|date',
            'amenities' => 'nullable|array',
        ]);

        // TODO: Store the preferences in the database
        // For now, we'll just redirect back with a success message

        return redirect()->route('housing.preferences')
            ->with('success', 'Housing preferences saved successfully.');
    }

    public function mortgage(): View
    {
        return view('housing.mortgage-calculator', $this->mortgagePayload());
    }

    public function calculateMortgage(Request $request): View
    {
        $inputs = $this->mortgageInputs($request);
        $payload = $this->mortgagePayload($inputs);
        $payload['results'] = $this->mortgageResults($inputs);

        return view('housing.mortgage-calculator', $payload);
    }

    /**
     * @psalm-return Collection<int<0, 2>, array{slug: 'brisbane-river-apartment'|'byron-co-living-loft'|'northcote-heritage-home', title: 'Brisbane River Apartment'|'Byron Co-living Loft'|'Northcote Heritage Home', listing_type: 'Buy'|'Rent', hero_image_url: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=900&q=80'|'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80'|'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80', suburb: 'Byron Bay'|'Northcote'|'Teneriffe', state: 'NSW'|'QLD'|'VIC', price_display: 'A$1,150,000'|'A$780,000'|'A$890 / week', bedrooms: 2|3, bathrooms: 1|2, car_spaces: 1, property_size: 125|140|420, summary: 'Light-filled riverside apartment in a women-friendly complex.'|'Ocean-facing loft with communal wellness amenities and surfboard storage.'|'Renovated Californian bungalow five minutes from the Mernda line.', description: 'Dual living zones, concierge, and rooftop wellness studio.'|'Thoughtfully updated residence with solar, water tanks, and flexible studio.'|'Women-only co-living loft curated for founders and remote talent.', address: '14 Elm Street, Northcote VIC'|'55 Vernon Terrace, Teneriffe QLD'|'8 Lawson Street, Byron Bay NSW', repayment_text: 'A$2,890 / mo'|'A$4,280 / mo'|'Rent assistance available', is_verified: bool, agents: array, open_homes: list{0?: Carbon, 1?: Carbon}}>
     */
    private function listings(): Collection
    {
        return collect([
            [
                'slug' => 'northcote-heritage-home',
                'title' => 'Northcote Heritage Home',
                'listing_type' => 'Buy',
                'hero_image_url' => 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
                'suburb' => 'Northcote',
                'state' => 'VIC',
                'price_display' => 'A$1,150,000',
                'bedrooms' => 3,
                'bathrooms' => 2,
                'car_spaces' => 1,
                'property_size' => 420,
                'summary' => 'Renovated Californian bungalow five minutes from the Mernda line.',
                'description' => 'Thoughtfully updated residence with solar, water tanks, and flexible studio.',
                'address' => '14 Elm Street, Northcote VIC',
                'repayment_text' => 'A$4,280 / mo',
                'is_verified' => true,
                'agents' => $this->agents(),
                'open_homes' => [Carbon::now()->addDays(2)->setTime(10, 30), Carbon::now()->addDays(5)->setTime(12, 0)],
            ],
            [
                'slug' => 'byron-co-living-loft',
                'title' => 'Byron Co-living Loft',
                'listing_type' => 'Rent',
                'hero_image_url' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
                'suburb' => 'Byron Bay',
                'state' => 'NSW',
                'price_display' => 'A$890 / week',
                'bedrooms' => 2,
                'bathrooms' => 1,
                'car_spaces' => 1,
                'property_size' => 140,
                'summary' => 'Ocean-facing loft with communal wellness amenities and surfboard storage.',
                'description' => 'Women-only co-living loft curated for founders and remote talent.',
                'address' => '8 Lawson Street, Byron Bay NSW',
                'repayment_text' => 'Rent assistance available',
                'is_verified' => false,
                'agents' => $this->agents(),
                'open_homes' => [],
            ],
            [
                'slug' => 'brisbane-river-apartment',
                'title' => 'Brisbane River Apartment',
                'listing_type' => 'Buy',
                'hero_image_url' => 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=900&q=80',
                'suburb' => 'Teneriffe',
                'state' => 'QLD',
                'price_display' => 'A$780,000',
                'bedrooms' => 2,
                'bathrooms' => 2,
                'car_spaces' => 1,
                'property_size' => 125,
                'summary' => 'Light-filled riverside apartment in a women-friendly complex.',
                'description' => 'Dual living zones, concierge, and rooftop wellness studio.',
                'address' => '55 Vernon Terrace, Teneriffe QLD',
                'repayment_text' => 'A$2,890 / mo',
                'is_verified' => true,
                'agents' => $this->agents(),
                'open_homes' => [Carbon::now()->addDays(7)->setTime(11, 0)],
            ],
        ]);
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{name: 'Sienna Clarke', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', phone: '02 8000 1234', email: 'sienna@athena.homes'}, array{name: 'Marley Ortiz', avatar_url: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80', phone: '02 8000 5678', email: 'marley@athena.homes'}}
     */
    private function agents(): array
    {
        return [
            ['name' => 'Sienna Clarke', 'avatar_url' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', 'phone' => '02 8000 1234', 'email' => 'sienna@athena.homes'],
            ['name' => 'Marley Ortiz', 'avatar_url' => 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80', 'phone' => '02 8000 5678', 'email' => 'marley@athena.homes'],
        ];
    }

    /**
     * @return (array|bool|int|string)[]|null
     *
     * @psalm-return array{slug: 'brisbane-river-apartment'|'byron-co-living-loft'|'northcote-heritage-home', title: 'Brisbane River Apartment'|'Byron Co-living Loft'|'Northcote Heritage Home', listing_type: 'Buy'|'Rent', hero_image_url: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=900&q=80'|'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80'|'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80', suburb: 'Byron Bay'|'Northcote'|'Teneriffe', state: 'NSW'|'QLD'|'VIC', price_display: 'A$1,150,000'|'A$780,000'|'A$890 / week', bedrooms: 2|3, bathrooms: 1|2, car_spaces: 1, property_size: 125|140|420, summary: 'Light-filled riverside apartment in a women-friendly complex.'|'Ocean-facing loft with communal wellness amenities and surfboard storage.'|'Renovated Californian bungalow five minutes from the Mernda line.', description: 'Dual living zones, concierge, and rooftop wellness studio.'|'Thoughtfully updated residence with solar, water tanks, and flexible studio.'|'Women-only co-living loft curated for founders and remote talent.', address: '14 Elm Street, Northcote VIC'|'55 Vernon Terrace, Teneriffe QLD'|'8 Lawson Street, Byron Bay NSW', repayment_text: 'A$2,890 / mo'|'A$4,280 / mo'|'Rent assistance available', is_verified: bool, agents: array, open_homes: list{0?: Carbon, 1?: Carbon}}|null
     */
    private function findListing(string $slug): array|null
    {
        $listing = $this->listings()->firstWhere('slug', $slug);

        abort_unless($listing, 404);

        return $listing;
    }

    /**
     * @return (float|int|mixed|string)[][]
     *
     * @psalm-return array{inputs: array{property_price: 950000|mixed, deposit_amount: 220000|mixed, interest_rate: float|mixed, loan_term: 30|mixed, repayment_frequency: 'monthly'|mixed, state: 'NSW'|mixed,...}, rates: array<5|6, '5.2%'|'5.8%'|'6.1%'>, terms: array{20: '20 years', 25: '25 years', 30: '30 years'}, frequencies: array{weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly'}, states: list{'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'}, results: array<never, never>}
     */
    private function mortgagePayload(array $overrides = []): array
    {
        $defaults = [
            'property_price' => 950000,
            'deposit_amount' => 220000,
            'interest_rate' => 5.8,
            'loan_term' => 30,
            'repayment_frequency' => 'monthly',
            'state' => 'NSW',
        ];

        $inputs = array_merge($defaults, $overrides);

        return [
            'inputs' => $inputs,
            'rates' => [5.2 => '5.2%', 5.8 => '5.8%', 6.1 => '6.1%'],
            'terms' => [20 => '20 years', 25 => '25 years', 30 => '30 years'],
            'frequencies' => [
                'weekly' => 'Weekly',
                'fortnightly' => 'Fortnightly',
                'monthly' => 'Monthly',
            ],
            'states' => ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'],
            'results' => [],
        ];
    }

    /**
     * @return (float|int|mixed)[]
     *
     * @psalm-return array{property_price: float, deposit_amount: float, interest_rate: float, loan_term: int, repayment_frequency: mixed, state: mixed}
     */
    private function mortgageInputs(Request $request): array
    {
        return [
            'property_price' => (float) $request->input('property_price', 0),
            'deposit_amount' => (float) $request->input('deposit_amount', 0),
            'interest_rate' => (float) $request->input('interest_rate', 5.8),
            'loan_term' => (int) $request->input('loan_term', 30),
            'repayment_frequency' => $request->input('repayment_frequency', 'monthly'),
            'state' => $request->input('state', 'NSW'),
        ];
    }

    /**
     * @return (array|float|int|mixed|string)[]
     *
     * @psalm-return array{loan_amount?: mixed, repayment?: float, frequency_label?: string, deposit_percent?: 0|float, deposit_gap?: 0|mixed, eligible_grants?: array}
     */
    private function mortgageResults(array $inputs): array
    {
        $loanAmount = max($inputs['property_price'] - $inputs['deposit_amount'], 0);
        $paymentsPerYear = match ($inputs['repayment_frequency']) {
            'weekly' => 52,
            'fortnightly' => 26,
            default => 12,
        };
        $totalPayments = $inputs['loan_term'] * $paymentsPerYear;
        $ratePerPeriod = ($inputs['interest_rate'] / 100) / $paymentsPerYear;

        if ($totalPayments <= 0 || $loanAmount <= 0) {
            return [];
        }

        if ($ratePerPeriod === 0.0) {
            $repayment = $loanAmount / $totalPayments;
        } else {
            $factor = pow(1 + $ratePerPeriod, $totalPayments);
            $repayment = $loanAmount * ($ratePerPeriod * $factor) / ($factor - 1);
        }

        $depositPercent = $inputs['property_price'] > 0
            ? round(($inputs['deposit_amount'] / $inputs['property_price']) * 100, 1)
            : 0;

        $frequencyLabel = ucfirst($inputs['repayment_frequency'] ?? 'monthly');

        return [
            'loan_amount' => $loanAmount,
            'repayment' => round($repayment, 2),
            'frequency_label' => $frequencyLabel,
            'deposit_percent' => $depositPercent,
            'deposit_gap' => max(($inputs['property_price'] * 0.2) - $inputs['deposit_amount'], 0),
            'eligible_grants' => $this->housingGrants($inputs['state']),
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{slug: 'regional-creators-grant'|'women-in-energy-accelerator', name: 'Regional Creators Grant'|'Women in Energy Accelerator'}, 1?: array{slug: 'young-founders-export', name: 'Young Founders Export Rebate'}}
     */
    private function housingGrants(string $state): array
    {
        $grants = [
            'NSW' => [
                ['slug' => 'women-in-energy-accelerator', 'name' => 'Women in Energy Accelerator'],
                ['slug' => 'young-founders-export', 'name' => 'Young Founders Export Rebate'],
            ],
            'VIC' => [
                ['slug' => 'regional-creators-grant', 'name' => 'Regional Creators Grant'],
            ],
        ];

        return $grants[$state] ?? [];
    }

    /**
     * @return (((array|bool|float|mixed|null|string)[]|string)[]|false|int|string)[]|null
     *
     * @psalm-return array{context_payload: string, prompt: 'Could you help me compare these housing options and mortgage trade-offs with care?', token: string, filters: array{surface: 'housing_dashboard', listing_mix?: string, mortgage_profile?: string}, selection_preview: array<int, array{id: mixed|null, description: 'Housing option'|mixed, amount: float|null, direction: 'debit', status: 'Housing'|mixed, flagged: bool, category: string, account: string, posted_at: mixed|null, ai_suggestions: list{0?: mixed}}>, selection_total: int, surface: 'housing_dashboard', resumed_from_history: false}|null
     */
    private function buildHousingConciergePayload(Collection $listings, array $mortgageInputs = [], array $mortgageResults = []): array|null
    {
        if ($listings->isEmpty()) {
            return null;
        }

        $selection = $listings
            ->take(3)
            ->map(/**
             * @return (array|bool|float|mixed|null|string)[]
             *
             * @psalm-return array{id: mixed|null, description: 'Housing option'|mixed, amount: float|null, direction: 'debit', status: 'Housing'|mixed, flagged: bool, category: string, account: string, posted_at: mixed|null, ai_suggestions: list{0?: mixed}}
             */
            function (array $listing): array {
                return [
                    'id' => $listing['slug'] ?? null,
                    'description' => $listing['title'] ?? 'Housing option',
                    'amount' => $this->parsePriceToFloat($listing['price_display'] ?? ''),
                    'direction' => 'debit',
                    'status' => $listing['listing_type'] ?? 'Housing',
                    'flagged' => (bool) ($listing['is_verified'] ?? false),
                    'category' => sprintf('%s bd • %s ba • %s car', $listing['bedrooms'] ?? '?', $listing['bathrooms'] ?? '?', $listing['car_spaces'] ?? '?'),
                    'account' => sprintf('%s, %s', $listing['suburb'] ?? 'Suburb', $listing['state'] ?? 'State'),
                    'posted_at' => $listing['repayment_text'] ?? null,
                    'ai_suggestions' => array_filter([$listing['summary'] ?? null]),
                ];
            })
            ->values()
            ->all();

        $filters = array_filter([
            'surface' => 'housing_dashboard',
            'listing_mix' => $this->describeListingMix($listings),
            'mortgage_profile' => $this->describeMortgageSnapshot($mortgageInputs, $mortgageResults),
        ]);

        $payload = [
            'token' => (string) Str::uuid(),
            'surface' => 'housing_dashboard',
            'generated_at' => now()->toIso8601String(),
            'selection_total' => $listings->count(),
            'filters' => $filters,
            'selection' => $selection,
        ];

        $encoded = base64_encode(json_encode($payload, JSON_THROW_ON_ERROR));

        $result = [
            'context_payload' => $encoded,
            'prompt' => 'Could you help me compare these housing options and mortgage trade-offs with care?',
            'token' => $payload['token'],
            'filters' => $filters,
            'selection_preview' => $selection,
            'selection_total' => $payload['selection_total'],
            'surface' => 'housing_dashboard',
            'resumed_from_history' => false,
        ];

        $this->persistAiHistory('housing-mortgage-education', $result);

        return $result;
    }

    private function describeListingMix(Collection $listings): string
    {
        return $listings
            ->groupBy(fn (array $listing) => $listing['listing_type'] ?? 'Other')
            ->map(fn (Collection $group, string $type) => sprintf('%s ×%d', ucfirst($type), $group->count()))
            ->values()
            ->implode(' • ');
    }

    private function describeMortgageSnapshot(array $inputs, array $results): string
    {
        if (empty($inputs)) {
            return 'Mortgage defaults not captured yet.';
        }

        $price = $this->formatCurrency($inputs['property_price'] ?? 0);
        $deposit = $this->formatCurrency($inputs['deposit_amount'] ?? 0);
        $rate = isset($inputs['interest_rate']) ? number_format((float) $inputs['interest_rate'], 2).'%' : '—';
        $term = isset($inputs['loan_term']) ? sprintf('%d yrs', (int) $inputs['loan_term']) : '30 yrs';
        $repayment = isset($results['repayment'])
            ? sprintf('%s %s', $this->formatCurrency((float) $results['repayment']), strtolower($results['frequency_label'] ?? 'per month'))
            : null;

        $parts = array_filter([
            sprintf('Price %s', $price),
            sprintf('Deposit %s', $deposit),
            sprintf('Rate %s', $rate),
            sprintf('Term %s', $term),
            $repayment ? sprintf('Repayment ≈ %s', $repayment) : null,
        ]);

        return implode(' • ', $parts);
    }

    private function parsePriceToFloat(?string $display): ?float
    {
        if ($display === null || trim($display) === '') {
            return null;
        }

        $sanitised = preg_replace('/[^\d.]/', '', (string) $display);

        if ($sanitised === '' || !is_numeric($sanitised)) {
            return null;
        }

        return (float) $sanitised;
    }

    private function formatCurrency(float $amount): string
    {
        if ($amount <= 0) {
            return 'A$0';
        }

        if ($amount >= 1000000) {
            return sprintf('A$%sm', rtrim(rtrim(number_format($amount / 1000000, 2), '0'), '.'));
        }

        if ($amount >= 1000) {
            return sprintf('A$%sk', rtrim(rtrim(number_format($amount / 1000, 1), '0'), '.'));
        }

        return sprintf('A$%s', number_format($amount));
    }

    private function persistAiHistory(string $contextKey, array $snapshot): void
    {
        $userId = Auth::id();

        if (!$userId || empty($snapshot['context_payload'] ?? null)) {
            return;
        }

        app(AiContextHistoryService::class)->store($userId, $contextKey, [
            'token' => $snapshot['token'] ?? (string) Str::uuid(),
            'filters' => $snapshot['filters'] ?? [],
            'selection_preview' => $snapshot['selection_preview'] ?? [],
            'selection_total' => $snapshot['selection_total'] ?? 0,
            'prompt' => $snapshot['prompt'] ?? null,
            'context_payload' => $snapshot['context_payload'],
            'surface' => $snapshot['surface'] ?? 'housing_dashboard',
        ]);
    }
}

