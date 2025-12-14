@extends('women.real-estate.layouts.console')



@push('scripts')
    @once
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" integrity="sha384-PQmDdGztqKqRR3YKHy+XapnwXCfJOLLmObEWj1vDLteA94ppWKqhzyapMI2vlA38" crossorigin="anonymous"></script>
    @endonce
@endpush

@php
    $metrics = $dashboardSnapshot ?? [
        'total_quotes' => 0,
        'latest_generated_at' => null,
        'average_repayment_cents' => null,
        'risk_breakdown' => [],
    ];

    $telemetry = $telemetrySummary ?? null;
    $telemetryTotals = $telemetry['total'] ?? ['count' => 0, 'last_accessed_at' => null, 'channel_breakdown' => []];
    $telemetryWindow = $telemetry['since'] ?? now()->subDays(7);

    $refreshCollection = collect($refreshSeries ?? []);
    $chartLabels = $refreshCollection->pluck('label');
    $chartValues = $refreshCollection->pluck('value');
    $latestChartEntry = $refreshCollection->last();
    $latestChannels = collect($latestChartEntry['channels'] ?? [])->sortDesc();
    $peakRefreshes = $chartValues->max() ?? 0;

    $insights = $refreshInsights ?? [];
    $topWindowInsight = $insights['top_window'] ?? null;
    $channelTotalsCollection = collect($insights['channel_totals'] ?? [])->map(static fn ($count) => (int) $count)->sortDesc();
    $topListingsCollection = collect($insights['top_listings'] ?? [])->sortByDesc('total')->values();
    $topListingNames = collect($insights['top_listing_names'] ?? []);

    $topListingInsight = $topListingsCollection->first();
    $topListingTitle = $topListingInsight
        ? ($topListingNames->get($topListingInsight['listing_id']) ?? ('Listing #' . $topListingInsight['listing_id']))
        : null;
    $topListingChannels = collect($topListingInsight['channels'] ?? [])->map(static fn ($count) => (int) $count)->sortDesc();
    $topListingPrimaryChannel = $topListingChannels->keys()->first();
    $topListingPrimaryChannelCount = $topListingChannels->first();
    $secondaryListingInsights = $topListingsCollection->slice(1, 2)->values();
    $topWindowLabel = $topWindowInsight['label'] ?? null;
    $topWindowValue = $topWindowInsight['value'] ?? null;
    $topWindowValue = is_numeric($topWindowValue) ? (int) $topWindowValue : null;
    $channelMixPreview = $channelTotalsCollection
        ->map(static fn ($count, $channel) => ucfirst($channel) . ' ' . number_format($count))
        ->values();

    $timelineEvents = $refreshCollection
        ->sortByDesc('timestamp')
        ->take(6)
        ->map(static function ($entry) {
            try {
                $window = \Illuminate\Support\Carbon::parse($entry['timestamp']);
            } catch (\Throwable $exception) {
                $window = null;
            }

            $channels = collect($entry['channels'] ?? [])
                ->filter(static fn ($count) => (int) $count > 0)
                ->map(static fn ($count, $channel) => ucfirst($channel) . ' ' . number_format((int) $count))
                ->values();

            return [
                'label' => $window ? $window->format('M j, ga') : ($entry['label'] ?? 'Window'),
                'value' => number_format((int) ($entry['value'] ?? 0)) . ' refreshes',
                'channels' => $channels,
            ];
        })
        ->values();

    $latestGeneratedAtMetric = $metrics['latest_generated_at'] ?? null;
    if ($latestGeneratedAtMetric && ! $latestGeneratedAtMetric instanceof \Carbon\CarbonInterface) {
        try {
            $latestGeneratedAtMetric = \Illuminate\Support\Carbon::parse($latestGeneratedAtMetric);
        } catch (\Throwable $exception) {
            $latestGeneratedAtMetric = null;
        }
    }

    $socialInsights = $socialShareInsights ?? [
        'total_shares' => 0,
        'unique_listings' => 0,
        'latest_share_at' => null,
        'platform_breakdown' => [],
        'listing_breakdown' => [],
        'recent_events' => [],
        'recent_window_total' => 0,
        'recent_window_label' => 'Last 7 days',
        'window_label' => 'All time',
        'recent_window_start' => \Illuminate\Support\Carbon::now()->subDays(7),
    ];

    $socialLatestShareAt = $socialInsights['latest_share_at'] ?? null;
    if ($socialLatestShareAt && ! $socialLatestShareAt instanceof \Carbon\CarbonInterface) {
        try {
            $socialLatestShareAt = \Illuminate\Support\Carbon::parse($socialLatestShareAt);
        } catch (\Throwable $exception) {
            $socialLatestShareAt = null;
        }
    }

    $socialPlatformBreakdown = collect($socialInsights['platform_breakdown'] ?? [])
        ->map(static fn ($count) => (int) $count)
        ->sortDesc();

    $socialListingBreakdown = collect($socialInsights['listing_breakdown'] ?? [])
        ->map(static function ($item) {
            $lastShared = $item['last_shared_at'] ?? null;

            if ($lastShared && ! $lastShared instanceof \Carbon\CarbonInterface) {
                try {
                    $lastShared = \Illuminate\Support\Carbon::parse($lastShared);
                } catch (\Throwable $exception) {
                    $lastShared = null;
                }
            }

            $item['last_shared_at'] = $lastShared;

            return $item;
        })
        ->values();

    $socialRecentEvents = collect($socialInsights['recent_events'] ?? [])
        ->map(static function ($event) {
            $timestamp = $event['timestamp'] ?? null;

            if ($timestamp && ! $timestamp instanceof \Carbon\CarbonInterface) {
                try {
                    $timestamp = \Illuminate\Support\Carbon::parse($timestamp);
                } catch (\Throwable $exception) {
                    $timestamp = null;
                }
            }

            $event['timestamp'] = $timestamp;

            return $event;
        })
        ->values();

    $socialTotalShares = (int) ($socialInsights['total_shares'] ?? 0);
    $socialUniqueListings = (int) ($socialInsights['unique_listings'] ?? 0);
    $socialRecentWindowLabel = $socialInsights['recent_window_label'] ?? 'Last 7 days';
    $socialRecentWindowTotal = (int) ($socialInsights['recent_window_total'] ?? 0);
    $socialWindowLabel = $socialInsights['window_label'] ?? 'All time';

    $lastRefreshAt = $telemetryTotals['last_accessed_at'] ?? null;
    if ($lastRefreshAt && ! $lastRefreshAt instanceof \Carbon\CarbonInterface) {
        try {
            $lastRefreshAt = \Illuminate\Support\Carbon::parse($lastRefreshAt);
        } catch (\Throwable $exception) {
            $lastRefreshAt = null;
        }
    }

    $latestWindowCarbon = null;
    if ($latestChartEntry && ! empty($latestChartEntry['timestamp'])) {
        try {
            $latestWindowCarbon = \Illuminate\Support\Carbon::parse($latestChartEntry['timestamp']);
        } catch (\Throwable $exception) {
            $latestWindowCarbon = null;
        }
    }
    $latestWindowHuman = $latestWindowCarbon ? $latestWindowCarbon->diffForHumans() : null;

    $aiSpotlightCollection = collect($aiSpotlight ?? [])->values();
    $aiRecommendationActions = collect($aiRecommendations['actions'] ?? [])->map(function ($action) {
        if (! is_array($action)) {
            return null;
        }

        return [
            'label' => $action['label'] ?? '',
            'priority' => $action['priority'] ?? 'medium',
            'rationale' => $action['rationale'] ?? '',
            'listing_id' => $action['listing_id'] ?? null,
        ];
    })->filter()->values();
    $aiFocusMetric = $aiRecommendations['focus_metric'] ?? null;
    $aiModerationCollection = collect($moderationAssessments ?? [])->values();

    $liveMortgageRatesCollection = collect($liveMortgageRates ?? []);
    $mortgageWidgetConfig = collect($mortgageWidgetDefaults ?? []);
    $rentVsBuyConfig = collect($rentVsBuyDefaults ?? []);
    $safetyTipCollection = collect($safetyTips ?? []);
    $virtualTourCollection = collect($virtualTourEmbeds ?? []);
    $activeVirtualTour = $virtualTourCollection->first();
    $defaultHomePrice = (float) $mortgageWidgetConfig->get('home_price', 650000);
    $defaultDepositPercent = (float) $mortgageWidgetConfig->get('deposit_percent', 15);
    $defaultInterestRate = (float) $mortgageWidgetConfig->get('interest_rate', 5.9);
    $defaultTermYears = (int) $mortgageWidgetConfig->get('term_years', 30);
    $defaultWeeklyRent = (float) $rentVsBuyConfig->get('weekly_rent', 620);
    $defaultRentGrowth = (float) $rentVsBuyConfig->get('rent_growth_rate', 3.2);
    $defaultRentDeposit = (float) $rentVsBuyConfig->get('deposit_percent', 20);
    $defaultLoanAmount = max(0, $defaultHomePrice * (1 - ($defaultDepositPercent / 100)));
    $defaultMonthlyRepayment = $mortgageWidgetConfig->get('monthly_repayment');

    $roleGates = array_merge([
        'mortgage_tools' => true,
        'rent_vs_buy' => true,
        'safety_playbook' => true,
        'virtual_tours' => true,
    ], $roleGates ?? []);

    $widgetRoleLimits = collect(config('women_real_estate.dashboard.widget_role_limits', []))
        ->filter(static fn ($roles) => is_array($roles) && ! empty($roles));

    if ($widgetRoleLimits->isNotEmpty()) {
        $activeHousingRoles = collect(auth()->user()?->getAllPlatformRoles() ?? []);

        $roleGates = collect($roleGates)
            ->map(static function ($isEnabled, $widgetKey) use ($widgetRoleLimits, $activeHousingRoles) {
                if (! $isEnabled) {
                    return false;
                }

                $limitedRoles = $widgetRoleLimits->get($widgetKey);

                if (! is_array($limitedRoles) || $limitedRoles === []) {
                    return (bool) $isEnabled;
                }

                return $activeHousingRoles->intersect($limitedRoles)->isNotEmpty();
            })
            ->all();
    }

    $shouldShowDecisionDeck = ($roleGates['mortgage_tools'] ?? false)
        || ($roleGates['rent_vs_buy'] ?? false)
        || ($roleGates['safety_playbook'] ?? false);
@endphp

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const canvas = document.getElementById('refreshTrendChart');
            if (!canvas) {
                return;
            }

            const labels = @json($chartLabels->toArray());
            const values = @json($chartValues->toArray());

            if (!labels.length) {
                const emptyState = document.getElementById('refreshTrendEmpty');
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                }
                canvas.classList.add('hidden');
                return;
            }

            const context = canvas.getContext('2d');
            const gradient = context.createLinearGradient(0, 0, 0, canvas.height || 260);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.32)');
            gradient.addColorStop(1, 'rgba(129, 140, 248, 0.05)');

            new window.Chart(context, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            data: values,
                            borderColor: '#4f46e5',
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.38,
                            pointRadius: 4,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: '#4f46e5',
                            pointBorderWidth: 2,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            backgroundColor: '#111827',
                            titleColor: '#f9fafb',
                            bodyColor: '#e0e7ff',
                            callbacks: {
                                title(context) {
                                    return context[0]?.label ?? '';
                                },
                                label(context) {
                                    return `${context.parsed.y ?? 0} refreshes`;
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#312e81',
                                maxRotation: 0,
                                font: {
                                    weight: '600',
                                },
                            },
                            grid: {
                                display: false,
                            },
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#312e81',
                                stepSize: 1,
                            },
                            grid: {
                                color: 'rgba(99, 102, 241, 0.15)',
                                drawBorder: false,
                                borderDash: [4, 4],
                            },
                        },
                    },
                },
            });
        });
    </script>
@endpush

@section('console-content')
    @if (session('status'))
        <div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm shadow-emerald-100">
            {{ session('status') }}
        </div>
    @endif

    @php
        $registrationActions = [
            [
                'label' => 'Renter onboarding',
                'text' => 'Browse rental properties and find your perfect rental.',
                'route' => route('women.real-estate.rentals.index'),
                'icon' => 'home',
                'variant' => 'rose',
            ],
            [
                'label' => 'Househunter profile',
                'text' => 'Set up your househunter profile and get matched properties.',
                'route' => route('women.real-estate.househunter-profile'),
                'icon' => 'profile',
                'variant' => 'blue',
            ],
            [
                'label' => 'AI matches',
                'text' => 'View your AI-powered property matches and recommendations.',
                'route' => route('women.real-estate.househunter-matches'),
                'icon' => 'sparkles',
                'variant' => 'purple',
            ],
        ];

        $heroCtas = [
            [
                'label' => 'Register househunter',
                'route' => route('women.real-estate.househunter-profile'),
                'style' => 'primary',
            ],
            [
                'label' => 'Register renter',
                'route' => route('women.real-estate.rentals.index'),
                'style' => 'secondary',
            ],
        ];
    @endphp

    <div class="wr-console-hero">
        <span class="wr-console-pill">WomenRise Owner Console</span>
        <h1 class="wr-console-headline">A commanding view of your women-first mortgage funnels</h1>
        <p class="wr-console-subtitle">
            Track the energy behind every listing, catch the moments when owners lean in, and act before momentum fades. This is your performance cockpit—brighter, sharper, ready for decisive moves.
        </p>
        <div class="flex flex-wrap items-center gap-4 text-base text-indigo-700">
            <span class="glow-pill">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Hourly telemetry synced
            </span>
            <span class="glow-pill">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Owner-ready insights
            </span>
        </div>

        <div class="hero-highlight-grid" role="list">
            @foreach ($registrationActions as $action)
                <a href="{{ $action['route'] }}" class="hero-highlight-card hero-highlight-card--{{ $action['variant'] ?? 'rose' }}" role="listitem" aria-label="{{ $action['label'] }}">
                    <div class="icon-orbit">
                        @switch($action['icon'])
                            @case('home')
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5 12 4l9 6.5M4.5 9.75V20h4.5v-4.5h6V20h4.5V9.75" />
                                </svg>
                                @break

                            @case('profile')
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5a8.25 8.25 0 0 1 15 0" />
                                </svg>
                                @break

                            @case('sparkles')
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25h.008v.008H9V8.25Zm4.5 0h.008v.008H13.5V8.25Zm-6 4.5h.008v.008H7.5v-.008Zm7.5 0h.008v.008H15v-.008Zm4.5-3-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5m-15-6-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5m3-9L9 6l3-3 3 3 1.5-1.5" />
                                </svg>
                                @break

                            @default
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3" />
                                </svg>
                        @endswitch
                    </div>
                    <div>
                        <p class="hero-highlight-label">{{ $action['label'] }}</p>
                        <p class="hero-highlight-text">{{ $action['text'] }}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 21 10.5m0 0-3.75 3.75M21 10.5H3" />
                    </svg>
                </a>
            @endforeach
        </div>

        @if ($shouldShowDecisionDeck)
            <section class="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                @if ($roleGates['mortgage_tools'] ?? false)
                <article
                class="rounded-[2.5rem] border border-indigo-200/60 bg-white/90 p-8 shadow-[0_36px_80px_-45px_rgba(79,70,229,0.35)]"
                data-mortgage-calculator
                data-defaults='@json($mortgageWidgetConfig->toArray())'
                x-data="mortgageWidget(@js($mortgageWidgetConfig->toArray()))"
            >
                <span class="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-700">Live mortgage widget</span>
                <h2 class="mt-3 text-3xl font-black text-slate-900">Stress-test repayments in real time</h2>
                <p class="mt-2 text-base text-slate-600">
                    Women are facing $880/month repayment spikes (Critical Problems Women Face). Run scenarios before sharing listings so seekers see safe numbers.
                </p>

                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    <label class="space-y-2 text-sm font-semibold text-slate-700">
                        <span>Home price (AUD)</span>
                        <input
                            type="number"
                            min="50000"
                            step="1000"
                            value="{{ number_format($defaultHomePrice, 0, '.', '') }}"
                            data-input="home_price"
                            x-model.number="form.home_price"
                            x-on:input="scheduleMortgageRefresh()"
                            x-on:change="scheduleMortgageRefresh()"
                            class="w-full rounded-2xl border border-indigo-200/80 bg-white/80 px-4 py-2.5 text-base font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </label>
                    <label class="space-y-2 text-sm font-semibold text-slate-700">
                        <span>Deposit (%)</span>
                        <input
                            type="number"
                            min="0"
                            max="60"
                            step="1"
                            value="{{ number_format($defaultDepositPercent, 1, '.', '') }}"
                            data-input="deposit_percent"
                            x-model.number="form.deposit_percent"
                            x-on:input="scheduleMortgageRefresh()"
                            x-on:change="scheduleMortgageRefresh()"
                            class="w-full rounded-2xl border border-indigo-200/80 bg-white/80 px-4 py-2.5 text-base font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </label>
                    <label class="space-y-2 text-sm font-semibold text-slate-700">
                        <span>Interest rate (%)</span>
                        <input
                            type="number"
                            min="0"
                            max="15"
                            step="0.01"
                            value="{{ number_format($defaultInterestRate, 2, '.', '') }}"
                            data-input="interest_rate"
                            x-ref="interestInput"
                            x-model.number="form.interest_rate"
                            x-on:input="scheduleMortgageRefresh()"
                            x-on:change="scheduleMortgageRefresh()"
                            class="w-full rounded-2xl border border-indigo-200/80 bg-white/80 px-4 py-2.5 text-base font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </label>
                    <label class="space-y-2 text-sm font-semibold text-slate-700">
                        <span>Term (years)</span>
                        <input
                            type="number"
                            min="5"
                            max="40"
                            step="1"
                            value="{{ $defaultTermYears }}"
                            data-input="term_years"
                            x-model.number="form.term_years"
                            x-on:input="scheduleMortgageRefresh()"
                            x-on:change="scheduleMortgageRefresh()"
                            class="w-full rounded-2xl border border-indigo-200/80 bg-white/80 px-4 py-2.5 text-base font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </label>
                </div>

                <div class="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <div class="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-700">Estimated monthly repayment</div>
                    <div class="mt-2 text-4xl font-black text-indigo-700" data-mortgage-output x-text="monthlyRepaymentCopy">
                        @if ($defaultMonthlyRepayment)
                            ${{ number_format($defaultMonthlyRepayment, 0) }}
                        @else
                            $0
                        @endif
                    </div>
                    <p class="mt-1 text-sm text-indigo-900" data-mortgage-summary x-text="mortgageSummaryCopy">
                        Loan {{ '$' . number_format($defaultLoanAmount, 0) }} with {{ number_format($defaultDepositPercent, 1) }}% deposit selected.
                    </p>
                </div>

                <div class="mt-8">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-semibold uppercase tracking-[0.26em] text-slate-700">Latest rate snapshots</h3>
                        <p class="text-xs text-slate-500">Tap a rate to apply</p>
                    </div>
                    <div class="mt-3 space-y-3">
                        @forelse ($liveMortgageRatesCollection as $rate)
                            <button
                                type="button"
                                class="w-full rounded-2xl border border-indigo-100 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-indigo-400 hover:bg-white"
                                data-rate-apply
                                data-rate="{{ number_format($rate->interest_rate ?? 0, 3, '.', '') }}"
                                x-on:click.prevent="applyRate({{ json_encode((float) ($rate->interest_rate ?? 0)) }})"
                            >
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p class="text-base font-semibold text-slate-900">{{ $rate->provider }}</p>
                                        <p class="text-xs text-slate-500">{{ $rate->product_name }}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-xl font-black text-indigo-700">{{ number_format($rate->interest_rate ?? 0, 2) }}%</p>
                                        <p class="text-xs text-slate-500">{{ $rate->captured_at ? $rate->captured_at->diffForHumans() : 'Captured soon' }}</p>
                                    </div>
                                </div>
                                <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                                    @if ($rate->rate_type)
                                        <span class="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{{ ucfirst($rate->rate_type) }}</span>
                                    @endif
                                    @if ($rate->comparison_rate)
                                        <span class="rounded-full bg-slate-100 px-3 py-1">Comparison {{ number_format($rate->comparison_rate, 2) }}%</span>
                                    @endif
                                    @if ($rate->max_lvr)
                                        <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Max LVR {{ $rate->max_lvr }}%</span>
                                    @endif
                                </div>
                            </button>
                        @empty
                            <p class="rounded-2xl border border-dashed border-indigo-200 px-4 py-3 text-sm text-slate-500">Mortgage rate snapshots will appear once telemetry syncs.</p>
                        @endforelse
                    </div>
                </div>

                <p class="mt-4 text-xs text-slate-500">Illustrative only. Use for coaching conversations, not credit advice.</p>
            </article>
                @endif

                @if ($roleGates['rent_vs_buy'] ?? false)
                <article
                class="rounded-[2.5rem] border border-emerald-200/80 bg-emerald-50/80 p-8 shadow-inner"
                data-rent-vs-buy
                data-config='@json($rentVsBuyConfig->toArray())'
                x-data="rentVsBuyWidget(@js($rentVsBuyConfig->toArray()))"
            >
                <span class="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">Rent vs buy</span>
                <h2 class="mt-3 text-3xl font-black text-slate-900">Show the calmest path</h2>
                <p class="mt-2 text-base text-emerald-900">
                    Only 44% of women can save deposits easily. Stack rent growth against ownership so they see the break-even moment.
                </p>

                <div class="mt-6 space-y-4">
                    <label class="space-y-2 text-sm font-semibold text-emerald-900">
                        <span>Weekly rent (AUD)</span>
                        <input
                            type="number"
                            min="100"
                            step="10"
                            value="{{ number_format($defaultWeeklyRent, 0, '.', '') }}"
                            data-input="weekly_rent"
                            x-model.number="form.weekly_rent"
                            x-on:input="scheduleRentRefresh()"
                            x-on:change="scheduleRentRefresh()"
                            class="w-full rounded-2xl border border-emerald-200 bg-white/80 px-4 py-2.5 text-base font-semibold text-emerald-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                    </label>
                    <label class="space-y-2 text-sm font-semibold text-emerald-900">
                        <span>Rent growth (annual %)</span>
                        <input
                            type="number"
                            min="0"
                            max="12"
                            step="0.1"
                            value="{{ number_format($defaultRentGrowth, 1, '.', '') }}"
                            data-input="rent_growth"
                            x-model.number="form.rent_growth"
                            x-on:input="scheduleRentRefresh()"
                            x-on:change="scheduleRentRefresh()"
                            class="w-full rounded-2xl border border-emerald-200 bg-white/80 px-4 py-2.5 text-base font-semibold text-emerald-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                    </label>
                    <label class="space-y-2 text-sm font-semibold text-emerald-900">
                        <span>Deposit (%)</span>
                        <input
                            type="number"
                            min="0"
                            max="40"
                            step="1"
                            value="{{ number_format($defaultRentDeposit, 1, '.', '') }}"
                            data-input="rent_deposit"
                            x-model.number="form.rent_deposit"
                            x-on:input="scheduleRentRefresh()"
                            x-on:change="scheduleRentRefresh()"
                            class="w-full rounded-2xl border border-emerald-200 bg-white/80 px-4 py-2.5 text-base font-semibold text-emerald-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                    </label>
                </div>

                <div class="mt-6 rounded-2xl border border-emerald-200/80 bg-white/80 p-5">
                    <div class="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">12-month cost delta</div>
                    <div class="mt-2 text-4xl font-black text-emerald-700" data-rent-delta-annual x-text="deltaAnnualCopy">$0</div>
                    <p class="mt-1 text-sm text-emerald-900" data-rent-delta-monthly x-text="deltaMonthlyCopy">Monthly delta appears after adjustments.</p>
                    <p class="mt-1 text-sm text-emerald-900" data-rent-summary x-text="rentSummaryCopy">Monthly comparison appears here.</p>
                    <dl class="mt-4 space-y-2 text-xs font-semibold text-emerald-900/90" x-show="crossoverMonthlyValue || crossoverAnnualValue" x-cloak>
                        <div class="flex items-center justify-between">
                            <dt class="uppercase tracking-[0.3em] text-emerald-600">Monthly crossover</dt>
                            <dd class="text-sm font-black" x-text="crossoverMonthlyValue">—</dd>
                        </div>
                        <div class="flex items-center justify-between">
                            <dt class="uppercase tracking-[0.3em] text-emerald-600">Annual crossover</dt>
                            <dd class="text-sm font-black" x-text="crossoverAnnualValue">—</dd>
                        </div>
                    </dl>
                    <div class="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Crossover outlook</p>
                        <p class="mt-1 text-sm text-emerald-900" data-rent-crossover x-text="crossoverCopy">Projection appears here.</p>
                    </div>
                </div>

                <p class="mt-4 text-xs text-emerald-900/80">
                    Pair this with the mortgage widget when guiding members through rent vs buy coaching rituals.
                </p>
            </article>
                @endif

                @if ($roleGates['safety_playbook'] ?? false)
                <article class="rounded-[2.5rem] border border-rose-200/80 bg-rose-50/80 p-8 shadow-[0_36px_80px_-45px_rgba(225,29,72,0.25)]">
                <span class="text-xs font-semibold uppercase tracking-[0.32em] text-rose-700">Safety rituals</span>
                <h2 class="mt-3 text-3xl font-black text-slate-900">Keep women-first journeys safe</h2>
                <p class="mt-2 text-base text-rose-900">
                    Pull guidance straight from Critical Problems Women Face so every listing conversation bakes in safety and trauma-aware workflows.
                </p>

                <ul class="mt-6 space-y-4">
                    @forelse ($safetyTipCollection as $tip)
                        <li class="rounded-2xl border border-rose-100 bg-white/80 p-4">
                            <p class="text-base font-semibold text-slate-900">{{ $tip['title'] }}</p>
                            <p class="mt-1 text-sm text-slate-600">{{ $tip['detail'] }}</p>
                            @if (! empty($tip['source']))
                                <p class="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">{{ $tip['source'] }}</p>
                            @endif
                        </li>
                    @empty
                        <li class="rounded-2xl border border-dashed border-rose-200/60 bg-white/70 p-4 text-sm text-slate-500">
                            Safety recommendations will appear once we sync the Critical Problems brief.
                        </li>
                    @endforelse
                </ul>

                <p class="mt-4 text-xs text-rose-700">Use these as pre-flight checks before publishing rent-vs-buy calculators to seekers.</p>
            </article>
                @endif
            </section>
        @endif

        <div class="hero-cta-row" role="group" aria-label="Registration actions">
            @foreach ($heroCtas as $cta)
                <a href="{{ $cta['route'] }}" class="{{ $cta['style'] === 'secondary' ? 'hero-cta-secondary' : 'hero-cta-primary' }}">
                    {{ $cta['label'] }}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 21 10.5m0 0-3.75 3.75M21 10.5H3" />
                    </svg>
                </a>
            @endforeach
        </div>
    </div>

    <div class="wr-console-shell">
        @if (($roleGates['virtual_tours'] ?? false) && $activeVirtualTour)
            @php
                $activeTourUrl = $activeVirtualTour['url'] ?? null;
                $isVideoTour = $activeTourUrl
                    ? \Illuminate\Support\Str::endsWith(\Illuminate\Support\Str::lower($activeTourUrl), ['.mp4', '.webm', '.ogg'])
                    : false;
                $secondaryTours = $virtualTourCollection->slice(1);
            @endphp

            <section class="mb-10 grid gap-6 lg:grid-cols-5">
                <article class="rounded-[2.5rem] border border-slate-900/10 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-[0_36px_80px_-45px_rgba(15,23,42,0.8)] lg:col-span-3">
                    <span class="text-xs font-semibold uppercase tracking-[0.36em] text-indigo-200">Virtual tour broadcast</span>
                    <h2 class="mt-3 text-3xl font-black leading-tight">Drop women directly inside your listing</h2>
                    <p class="mt-2 text-base text-indigo-100">
                        Tours are the fastest path to trust. Stream them during coaching calls to capture attention and surface safety credentials visually.
                    </p>
                    <div class="mt-6 overflow-hidden rounded-[1.75rem] border border-white/20 bg-black/40 shadow-inner shadow-black/60">
                        @if ($isVideoTour)
                            <video controls playsinline class="h-[320px] w-full rounded-[1.75rem] object-cover">
                                <source src="{{ $activeTourUrl }}" type="video/mp4" />
                                Your browser does not support inline tour playback.
                            </video>
                        @else
                            <iframe src="{{ $activeTourUrl }}" class="h-[320px] w-full rounded-[1.75rem] border-0" allowfullscreen loading="lazy"></iframe>
                        @endif
                    </div>
                    <p class="mt-3 text-sm font-semibold text-indigo-100/80">{{ $activeVirtualTour['caption'] ?? 'Immersive tour' }}</p>
                </article>

                <aside class="rounded-[2.5rem] border border-slate-200/70 bg-white/90 p-8 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.65)] lg:col-span-2">
                    <span class="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Tour rotation</span>
                    <h3 class="mt-3 text-2xl font-black text-slate-900">Keep the best tours pinned</h3>
                    <p class="mt-2 text-sm text-slate-600">Swap the headliner or paste a quick link while you are on a live call.</p>

                    <ul class="mt-6 space-y-3">
                        @forelse ($secondaryTours as $tour)
                            <li class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                <p class="text-base font-semibold text-slate-900">{{ $tour['caption'] ?? 'Immersive tour' }}</p>
                                <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>ID #{{ $tour['id'] }}</span>
                                    <a href="{{ $tour['url'] }}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-semibold text-indigo-600 transition hover:text-indigo-500">
                                        Open
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 21 10.5m0 0-3.75 3.75M21 10.5H3" />
                                        </svg>
                                    </a>
                                </div>
                            </li>
                        @empty
                            <li class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                                Upload two more tours to keep this rotation fresh.
                            </li>
                        @endforelse
                    </ul>

                    <p class="mt-6 text-xs text-slate-500">Need an update? Drop fresh tours through the Women Media Vault (left navigation) so renters always see safe, current footage.</p>
                </aside>
            </section>
        @endif
        <section class="mb-10">
            <form method="GET" action="{{ route('women.real-estate.listings.index') }}" class="flex flex-col gap-6 rounded-[2.25rem] border border-indigo-200/60 bg-white/85 px-6 py-6 shadow-[0_22px_48px_-32px_rgba(79,70,229,0.55)] backdrop-blur-lg lg:flex-col">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8">
                    <div class="flex-1">
                        <label for="wr-search" class="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-800">Search Listings</label>
                        <div class="relative mt-2">
                            <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-indigo-500">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1015 15l4.35 4.35z" />
                                </svg>
                            </span>
                            <input
                                id="wr-search"
                                name="search"
                                type="search"
                                value="{{ $filters['search'] }}"
                                placeholder="Find listings by title, keywords, or slug"
                                class="w-full rounded-2xl border border-indigo-200 bg-white/80 py-3 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner shadow-indigo-100/40 transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring focus:ring-indigo-200/60"
                            />
                        </div>
                    </div>
                    <div class="flex-1">
                        <span class="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-800">Audience Focus</span>
                        <div class="mt-3 flex flex-wrap gap-2">
                            @foreach ($availableAudiences as $value => $label)
                                <label class="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100">
                                    <input
                                        type="checkbox"
                                        name="audience[]"
                                        value="{{ $value }}"
                                        @checked(in_array($value, $filters['audiences'], true))
                                        class="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>{{ $label }}</span>
                                </label>
                            @endforeach
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                    <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.32em] text-white transition hover:bg-indigo-500">
                        Apply Filters
                    </button>
                    @if ($hasActiveFilters)
                        <a href="{{ route('women.real-estate.listings.index') }}" class="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.32em] text-indigo-600 transition hover:border-indigo-400 hover:text-indigo-500">
                            Clear
                        </a>
                    @endif
                </div>
            </form>
        </section>

        <div class="wr-console-card-shell">
            <section class="flex flex-col gap-8 rounded-[2.75rem] border border-indigo-200/60 bg-white/85 px-8 py-12 shadow-[0_36px_80px_-45px_rgba(79,70,229,0.65)] backdrop-blur-lg lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:px-14 lg:py-16">
                <div class="space-y-6 lg:w-7/12">
                    <span class="inline-flex items-center gap-3 rounded-full bg-indigo-100/80 px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-700">Mortgage intelligence</span>
                    <h1 class="text-[3rem] font-black text-slate-900 leading-tight sm:text-[3.35rem]">
                        A commanding view of your women-first mortgage funnels
                    </h1>
                    <p class="text-lg text-slate-600 lg:text-xl lg:leading-relaxed">
                        Track the energy behind every listing, catch the moments when owners lean in, and act before momentum fades. This is your performance cockpit—brighter, sharper, ready for decisive moves.
                    </p>
                    <div class="flex flex-wrap items-center gap-4 text-base text-indigo-700">
                        <span class="glow-pill">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Hourly telemetry synced
                        </span>
                        <span class="glow-pill">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Owner-ready insights
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-5 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-indigo-600 to-fuchsia-500 p-8 text-white shadow-2xl shadow-indigo-800/40 lg:w-5/12">
                    <div class="text-sm uppercase tracking-[0.42em] opacity-80">Next action</div>
                    <p class="text-xl font-semibold leading-relaxed">
                        Refresh scenarios, invite co-owners, and keep the listings that matter high in discovery.
                    </p>
                    <a href="{{ route('women.real-estate.listings.create') }}" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-6 py-4 text-sm font-semibold uppercase tracking-[0.32em] transition hover:bg-white/25">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                        </svg>
                        New Listing
                    </a>
                </div>
            </section>
        </div>

        <section class="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
            <article class="metrics-card lg:col-span-1">
                <div class="metrics-card__title">Mortgage scenarios</div>
                <div class="metrics-card__value">{{ number_format($metrics['total_quotes']) }}</div>
                <p class="metrics-card__hint">Repayment scenarios generated across your portfolio.</p>
            </article>

            <article class="metrics-card lg:col-span-1">
                <div class="metrics-card__title">Average repayment</div>
                <div class="metrics-card__value">
                    @if ($metrics['average_repayment_cents'])
                        ${{ number_format($metrics['average_repayment_cents'] / 100, 2) }}
                    @else
                        <span class="text-slate-400">—</span>
                    @endif
                </div>
                <p class="metrics-card__hint">Blended repayment for most recent scenarios.</p>
            </article>

            <article class="metrics-card lg:col-span-1">
                <div class="metrics-card__title">Latest scenario</div>
                <div class="metrics-card__value">
                    @if ($latestGeneratedAtMetric)
                        {{ $latestGeneratedAtMetric->diffForHumans() }}
                    @else
                        <span class="text-slate-400">Awaiting first run</span>
                    @endif
                </div>
                @if (! empty($metrics['risk_breakdown']))
                    <div class="mt-4 flex flex-wrap gap-2">
                        @foreach ($metrics['risk_breakdown'] as $risk => $count)
                            <span class="listing-card__telemetry-badge bg-white/60 text-indigo-600">{{ ucfirst($risk) }} · {{ $count }}</span>
                        @endforeach
                    </div>
                @else
                    <p class="metrics-card__hint">Risk mix appears once scenarios land.</p>
                @endif
            </article>

            <article class="metrics-card lg:col-span-1">
                <div class="metrics-card__title">Widget refreshes</div>
                <div class="metrics-card__value">{{ number_format($telemetryTotals['count'] ?? 0) }}</div>
                <p class="metrics-card__hint">
                    @if ($lastRefreshAt)
                        Last refresh {{ $lastRefreshAt->diffForHumans() }}
                    @else
                        Watching activity since {{ $telemetryWindow->toFormattedDateString() }}.
                    @endif
                </p>
            </article>

            <article class="metrics-card lg:col-span-1">
                <div class="metrics-card__title">Social shares</div>
                <div class="metrics-card__value">{{ number_format($socialTotalShares) }}</div>
                <p class="metrics-card__hint">
                    {{ $socialRecentWindowLabel }} · {{ number_format($socialRecentWindowTotal) }}
                </p>
            </article>
        </section>

        @if ($aiSpotlightCollection->isNotEmpty() || $aiRecommendationActions->isNotEmpty() || $aiModerationCollection->isNotEmpty())
            <section class="mt-10 ai-grid">
                <article class="ai-card">
                    <div class="ai-card__title">AI Spotlight</div>

                    @forelse ($aiSpotlightCollection as $insight)
                        @php
                            $generatedAt = $insight['generated_at'] ?? null;
                            if ($generatedAt && ! $generatedAt instanceof \Carbon\CarbonInterface) {
                                try {
                                    $generatedAt = \Illuminate\Support\Carbon::parse($generatedAt);
                                } catch (\Throwable $exception) {
                                    $generatedAt = null;
                                }
                            }
                            $strengths = collect($insight['strengths'] ?? [])->take(3);
                            $opportunities = collect($insight['opportunities'] ?? [])->take(3);
                        @endphp
                        <div class="mt-6">
                            <div class="ai-card__meta">
                                @if (! empty($insight['listing_id']))
                                    <span class="ai-card__badge">Listing #{{ $insight['listing_id'] }}</span>
                                @endif
                                @if (! empty($insight['provider']))
                                    <span class="ai-card__badge">{{ \Illuminate\Support\Str::title(str_replace('_', ' ', (string) $insight['provider'])) }} {{ ! empty($insight['from_cache']) ? '· Cached' : '· Live' }}</span>
                                @endif
                                @if ($generatedAt)
                                    <span class="ai-card__badge">Updated {{ $generatedAt->diffForHumans() }}</span>
                                @endif
                            </div>
                            <p class="ai-card__summary">{{ $insight['summary'] ?? 'No insight generated yet.' }}</p>

                            @if ($strengths->isNotEmpty())
                                <div class="ai-card__footnote">Strengths</div>
                                <ul class="ai-card__list">
                                    @foreach ($strengths as $item)
                                        <li>{{ $item }}</li>
                                    @endforeach
                                </ul>
                            @endif

                            @if ($opportunities->isNotEmpty())
                                <div class="ai-card__footnote mt-4">Opportunities</div>
                                <ul class="ai-card__list">
                                    @foreach ($opportunities as $item)
                                        <li>{{ $item }}</li>
                                    @endforeach
                                </ul>
                            @endif

                            @if (! empty($insight['next_action']))
                                <div class="ai-card__footnote mt-5">Next action</div>
                                <p class="ai-card__summary text-sm text-indigo-700">{{ $insight['next_action'] }}</p>
                            @endif
                        </div>
                    @empty
                        <p class="ai-card__empty">AI insights will appear once listings accrue engagement.</p>
                    @endforelse
                </article>

                <article class="ai-card">
                    <div class="ai-card__title">Personalised Recommendations</div>
                    @if ($aiRecommendationActions->isNotEmpty())
                        <div class="ai-card__meta">
                            <span class="ai-card__badge">Focus · {{ $aiFocusMetric ? \Illuminate\Support\Str::headline((string) $aiFocusMetric) : 'Portfolio health' }}</span>
                        </div>
                        <div class="ai-card__actions">
                            @foreach ($aiRecommendationActions as $action)
                                @php
                                    $priority = strtolower((string) ($action['priority'] ?? 'medium'));
                                    $priorityClass = match ($priority) {
                                        'high' => 'ai-priority-high',
                                        'low' => 'ai-priority-low',
                                        default => 'ai-priority-medium',
                                    };
                                @endphp
                                <div class="ai-action-item">
                                    <div class="ai-action-item__heading">
                                        <span class="ai-action-item__priority {{ $priorityClass }}">{{ \Illuminate\Support\Str::upper($priority) }}</span>
                                        @if (! empty($action['listing_id']))
                                            <span>Listing #{{ $action['listing_id'] }}</span>
                                        @endif
                                    </div>
                                    <div class="ai-action-item__body">{{ $action['label'] }}</div>
                                    @if (! empty($action['rationale']))
                                        <p class="mt-2 text-sm text-slate-600">{{ $action['rationale'] }}</p>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @else
                        <p class="ai-card__empty">No tailored actions needed right now—keep momentum steady.</p>
                    @endif
                </article>

                <article class="ai-card">
                    <div class="ai-card__title">Moderation Watchlist</div>
                    @if ($aiModerationCollection->isNotEmpty())
                        @foreach ($aiModerationCollection as $assessment)
                            @php
                                $generatedAt = $assessment['generated_at'] ?? null;
                                if ($generatedAt && ! $generatedAt instanceof \Carbon\CarbonInterface) {
                                    try {
                                        $generatedAt = \Illuminate\Support\Carbon::parse($generatedAt);
                                    } catch (\Throwable $exception) {
                                        $generatedAt = null;
                                    }
                                }
                                $flags = collect($assessment['flags'] ?? [])->take(4);
                            @endphp
                            <div class="mt-6">
                                <div class="ai-card__meta">
                                    @if (! empty($assessment['listing_id']))
                                        <span class="ai-card__badge">Listing #{{ $assessment['listing_id'] }}</span>
                                    @endif
                                    <span class="ai-card__badge">Risk · {{ \Illuminate\Support\Str::upper((string) ($assessment['risk_level'] ?? 'low')) }}</span>
                                    @if ($generatedAt)
                                        <span class="ai-card__badge">Checked {{ $generatedAt->diffForHumans() }}</span>
                                    @endif
                                </div>
                                <p class="ai-card__summary">{{ $assessment['recommended_action'] ?? 'No moderation action suggested.' }}</p>
                                @if ($flags->isNotEmpty())
                                    <div class="ai-card__footnote">Flags</div>
                                    <ul class="ai-card__list">
                                        @foreach ($flags as $flag)
                                            <li>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', (string) $flag)) }}</li>
                                        @endforeach
                                    </ul>
                                @endif
                            </div>
                        @endforeach
                    @else
                        <p class="ai-card__empty">No moderation risks detected across the active portfolio.</p>
                    @endif
                </article>
            </section>
        @endif

            <section class="quick-actions">
                <a href="{{ route('women.real-estate.rentals.index') }}" class="quick-action-card quick-action-card--amber">
                    <div>
                        <p class="quick-action-card__eyebrow">Rentals</p>
                        <p class="quick-action-card__text">Browse rental properties and find your perfect rental.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M13 7l5 5-5 5M6 4v16" />
                        </svg>
                    </span>
                </a>
                <a href="{{ route('women.real-estate.househunter-profile') }}" class="quick-action-card quick-action-card--blue">
                    <div>
                        <p class="quick-action-card__eyebrow">Househunter</p>
                        <p class="quick-action-card__text">Set up your househunter profile and get matched properties.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M13 7l5 5-5 5M6 4v16" />
                        </svg>
                    </span>
                </a>
                <a href="{{ route('women.real-estate.househunter-matches') }}" class="quick-action-card quick-action-card--purple">
                    <div>
                        <p class="quick-action-card__eyebrow">AI matches</p>
                        <p class="quick-action-card__text">View your AI-powered property matches and recommendations.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M13 7l5 5-5 5M6 4v16" />
                        </svg>
                    </span>
                </a>
                <a href="{{ route('women.real-estate.network.connections') }}" class="quick-action-card quick-action-card--rose">
                    <div>
                        <p class="quick-action-card__eyebrow">Community</p>
                        <p class="quick-action-card__text">Connect with landlords, investors, and househunters.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M13 7l5 5-5 5M6 4v16" />
                        </svg>
                    </span>
                </a>
                <div class="quick-action-card quick-action-card--teal">
                    <div>
                        <p class="quick-action-card__eyebrow">Creative refresh</p>
                        <p class="quick-action-card__text">Re-engage top performing listings with fresh photography drops.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M13 7l5 5-5 5M6 4v16" />
                        </svg>
                    </span>
                </div>
                <div class="quick-action-card quick-action-card--amber">
                    <div>
                        <p class="quick-action-card__eyebrow">Scenario health</p>
                        <p class="quick-action-card__text">Schedule a mortgage scenario refresh for owners who stalled.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                </div>
                <div class="quick-action-card quick-action-card--teal">
                    <div>
                        <p class="quick-action-card__eyebrow">Collaboration</p>
                        <p class="quick-action-card__text">Invite a co-agent to review mortgages and share analytics.</p>
                    </div>
                    <span class="quick-action-card__cta">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M17 11a4 4 0 10-8 0 4 4 0 008 0z" />
                        </svg>
                    </span>
                </div>
            </section>

            <section class="mt-12 grid gap-6 lg:grid-cols-3">
                <div class="social-card lg:col-span-1">
                    <div class="social-card__title">Social amplification</div>
                    <div class="social-card__metric">{{ number_format($socialTotalShares) }}</div>
                    <p class="social-card__hint">{{ $socialWindowLabel }} · {{ number_format($socialUniqueListings) }} listings amplified</p>

                    <div class="social-card__badges">
                        <span class="social-card__badge">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Latest {{ $socialLatestShareAt ? $socialLatestShareAt->diffForHumans() : 'pending' }}
                        </span>
                        <span class="social-card__badge">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" d="M4 6h16M4 10h16M4 14h12M4 18h8" />
                            </svg>
                            {{ $socialRecentWindowLabel }} · {{ number_format($socialRecentWindowTotal) }}
                        </span>
                    </div>

                    @if ($socialListingBreakdown->isNotEmpty())
                        <div class="social-card__list">
                            @foreach ($socialListingBreakdown->take(4) as $listingInsight)
                                <div class="social-card__list-item">
                                    <span>{{ $listingInsight['title'] }}</span>
                                    <span>
                                        {{ number_format($listingInsight['count']) }}
                                        @if ($listingInsight['last_shared_at'])
                                            · {{ $listingInsight['last_shared_at']->diffForHumans() }}
                                        @endif
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <p class="social-card__hint mt-6 text-sm text-slate-500">Shares appear once listings publish with public visibility.</p>
                    @endif

                    @if ($socialPlatformBreakdown->isNotEmpty())
                        <div class="social-card__badges mt-4">
                            @foreach ($socialPlatformBreakdown->take(3) as $platform => $count)
                                <span class="social-card__badge">{{ ucfirst($platform) }} · {{ number_format($count) }}</span>
                            @endforeach
                        </div>
                    @endif
                </div>

                <div class="social-activity-card lg:col-span-2">
                    <div class="social-activity-card__header">
                        <div class="social-activity-card__title">Recent share activity</div>
                        <div class="social-activity-card__subtitle">Moments your listings were packaged for social amplification.</div>
                    </div>

                    @if ($socialRecentEvents->isNotEmpty())
                        <div class="social-activity-list">
                            @foreach ($socialRecentEvents as $event)
                                <div class="social-activity-item">
                                    <div class="social-activity-item__header">
                                        <span class="social-activity-item__title">{{ $event['listing_title'] ?? ('Listing #' . $event['listing_id']) }}</span>
                                        <span class="social-activity-item__badge">{{ strtoupper($event['platform']) }}</span>
                                    </div>
                                    <div class="social-activity-item__meta">
                                        <span>{{ $event['timestamp'] ? $event['timestamp']->diffForHumans() : 'Just now' }}</span>
                                        <span>Reason · {{ ucfirst($event['reason'] ?? 'updated') }}</span>
                                    </div>
                                    @if (! empty($event['hashtags']))
                                        <div class="social-activity-item__hashtags">
                                            @foreach (array_slice($event['hashtags'], 0, 4) as $tag)
                                                <span class="social-activity-item__hashtag">#{{ $tag }}</span>
                                            @endforeach
                                        </div>
                                    @endif
                                    @if (! empty($event['share_url']))
                                        <a href="{{ $event['share_url'] }}" target="_blank" rel="noopener" class="social-activity-item__link">
                                            View share link
                                        </a>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @else
                        <p class="mt-6 text-sm text-indigo-100/80">Once listings publish with social amplification enabled, activity will collect here.</p>
                    @endif
                </div>
            </section>

            <section class="mt-12 grid gap-6 lg:grid-cols-3">
                <div class="chart-card lg:col-span-2">
                    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 class="chart-card__title">Hourly mortgage widget refreshes</h2>
                            <p class="chart-card__subtitle">
                                Owner activity across your listings — peak
                                <span class="font-bold">{{ number_format($peakRefreshes ?? 0) }}</span>
                                refreshes/hr
                            </p>
                        </div>
                        @if ($latestChartEntry)
                            <div class="rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-700 shadow-sm">
                                Window started {{ $latestWindowHuman ?? 'Just now' }}
                            </div>
                        @endif
                    </header>

                    <div class="mt-6 relative h-[260px]">
                        <div id="refreshTrendEmpty" class="chart-card__empty hidden">
                            Refresh telemetry populates once owners engage with your widget.
                        </div>
                        <canvas id="refreshTrendChart" height="260"></canvas>
                    </div>

                    <footer class="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-900">
                        @if ($latestChannels->isNotEmpty())
                            @foreach ($latestChannels as $channel => $count)
                                <span class="listing-card__telemetry-badge bg-white/70 text-indigo-700">
                                    {{ ucfirst($channel) }} · {{ $count }}
                                </span>
                            @endforeach
                        @else
                            <span class="listing-card__telemetry-badge bg-white/70 text-indigo-600">Channel mix appears after your first refresh.</span>
                        @endif
                    </footer>
                </div>

                <aside class="spotlight-card">
                    <div class="spotlight-card__title">Engagement spotlight</div>

                    @if ($topListingInsight)
                        <div class="spotlight-card__metric">{{ number_format($topListingInsight['total']) }}</div>
                        <p class="spotlight-card__subtitle">Refreshes across {{ $topListingTitle }}</p>

                        <div class="spotlight-card__list">
                            @if ($topListingPrimaryChannel)
                                <div class="spotlight-card__list-item">
                                    <span>Top channel</span>
                                    <span class="spotlight-card__badge">
                                        {{ ucfirst($topListingPrimaryChannel) }} · {{ number_format($topListingPrimaryChannelCount) }}
                                    </span>
                                </div>
                            @endif

                            @if ($topWindowLabel && $topWindowValue !== null)
                                <div class="spotlight-card__list-item">
                                    <span>Peak window</span>
                                    <span class="spotlight-card__badge">{{ $topWindowLabel }} · {{ number_format($topWindowValue) }}</span>
                                </div>
                            @endif

                            @if ($secondaryListingInsights->isNotEmpty())
                                @foreach ($secondaryListingInsights as $secondary)
                                    @php
                                        $secondaryTitle = $topListingNames->get($secondary['listing_id']) ?? ('Listing #' . $secondary['listing_id']);
                                    @endphp
                                    <div class="spotlight-card__list-item">
                                        <span>{{ $secondaryTitle }}</span>
                                        <span class="spotlight-card__badge">{{ number_format($secondary['total']) }}</span>
                                    </div>
                                @endforeach
                            @endif

                            @if ($channelMixPreview->isNotEmpty())
                                <div class="spotlight-card__list-item">
                                    <span>Channel mix</span>
                                    <span class="spotlight-card__badge">
                                        {{ $channelMixPreview->take(2)->implode(' · ') }}
                                    </span>
                                </div>
                            @endif
                        </div>
                    @else
                        <div class="spotlight-card__empty">
                            Refresh highlights appear once owners have engaged with your mortgage widget over the last 72 hours.
                        </div>
                    @endif
                </aside>
            </section>

            <section class="mt-8">
                <div class="timeline-card">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h3 class="timeline-card__title">Refresh timeline</h3>
                            <p class="text-teal-800/80 text-base">Recent hourly windows mapping where owners leaned in.</p>
                        </div>
                        <div class="rounded-full bg-white/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-800 shadow-sm">
                            Latest {{ $timelineEvents->count() }} windows
                        </div>
                    </div>

                    @if ($timelineEvents->isNotEmpty())
                        <div class="timeline-list mt-6">
                            @foreach ($timelineEvents as $event)
                                <div class="timeline-item">
                                    <span class="timeline-item__label">{{ $event['label'] }}</span>
                                    <span class="timeline-item__value">{{ $event['value'] }}</span>
                                    <span class="timeline-item__channels">
                                        @if ($event['channels']->isNotEmpty())
                                            {{ $event['channels']->take(3)->implode(' · ') }}
                                        @else
                                            <span class="text-slate-400">Channels pending</span>
                                        @endif
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="mt-6 rounded-xl border border-teal-200 bg-white/70 px-6 py-5 text-teal-900">
                            Timeline rows appear after your first wave of hourly engagement summaries.
                        </div>
                    @endif
                </div>
            </section>

            <section class="mt-12">
                @if ($listings->isEmpty())
                    <div class="listing-card text-center">
                        <div class="flex justify-center">
                            <span class="listing-card__accent">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v8m4-4H8" />
                                </svg>
                                Let’s launch your first listing
                            </span>
                        </div>
                        <h2 class="mt-5 text-2xl font-semibold text-slate-900">No listings yet — your community is waiting.</h2>
                        <p class="mt-3 text-slate-600">
                            Create a women-led housing opportunity to start collecting insights, refreshing mortgage scenarios, and matching with ready buyers.
                        </p>
                        <div class="mt-6 flex justify-center">
                            <a href="{{ route('women.real-estate.listings.create') }}" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white shadow-lg transition hover:bg-indigo-500">
                                Launch Listing
                            </a>
                        </div>
                    </div>
                @else
                    <div class="space-y-7">
                        @foreach ($listings as $listing)
                            @php
                                $latestQuote = $listing->latestMortgageQuote;
                                $listingTelemetry = $telemetry['per_listing'][$listing->id] ?? null;
                                $telemetryChannels = collect($listingTelemetry['channel_breakdown'] ?? [])->sortDesc();

                                $listingLastAccessedAt = $listingTelemetry['last_accessed_at'] ?? null;
                                if ($listingLastAccessedAt && ! $listingLastAccessedAt instanceof \Carbon\CarbonInterface) {
                                    try {
                                        $listingLastAccessedAt = \Illuminate\Support\Carbon::parse($listingLastAccessedAt);
                                    } catch (\Throwable $exception) {
                                        $listingLastAccessedAt = null;
                                    }
                                }
                            @endphp

                            <article class="listing-card">
                                <div class="flex flex-col gap-4 lg:flex-row lg:justify-between">
                                    <div class="space-y-3">
                                        <div class="flex flex-wrap items-center gap-3">
                                            <a href="{{ route('women.real-estate.listings.show', $listing) }}" class="text-2xl font-bold text-slate-900 transition hover:text-indigo-600">
                                                {{ $listing->title }}
                                            </a>
                                            <span class="listing-card__accent">
                                                {{ ucfirst(str_replace('_', ' ', $listing->listing_type)) }}
                                            </span>
                                            <span class="listing-card__accent bg-pink-100 text-pink-600">
                                                {{ strtoupper($listing->audience) }}
                                            </span>
                                        </div>
                                        <p class="text-sm text-slate-600 lg:max-w-2xl">{{ Str::limit($listing->description, 220) }}</p>
                                    </div>
                                    <div class="flex items-start gap-3 lg:min-w-[220px] lg:justify-end">
                                        <span class="inline-flex items-center gap-2 rounded-xl bg-indigo-600/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-700">
                                            {{ $listing->mortgage_quotes_count ?? 0 }} scenarios
                                        </span>
                                        <span class="inline-flex items-center gap-2 rounded-xl bg-slate-900/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
                                            {{ $listing->photos_count ?? 0 }} photos
                                        </span>
                                    </div>
                                </div>

                                <div class="listing-card__meta">
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
                                        </svg>
                                        Visibility: {{ ucfirst($listing->visibility) }}
                                    </span>
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Verification: {{ ucfirst($listing->verification_status) }}
                                    </span>
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h2l1-2h4l1 2h2l-3 9H6l-3-9z" />
                                        </svg>
                                        {{ $listing->agentProfile ? 'Agent connected' : 'No agent profile' }}
                                    </span>
                                </div>

                                @if ($latestQuote)
                                    <div class="mt-6 rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm text-slate-700 shadow-inner">
                                        <div class="flex flex-wrap items-center gap-4">
                                            <span class="text-base font-semibold text-indigo-700">Latest mortgage scenario</span>
                                            <span class="inline-flex items-center gap-1 text-sm text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 12l4.243-4.243m-5.657 8.485L6.343 12l5.657-5.657" />
                                                </svg>
                                                Repayment ${{ number_format($latestQuote->calculated_repayment_cents / 100, 2) }} &middot; {{ ucfirst($latestQuote->repayment_frequency) }}
                                            </span>
                                            <span class="inline-flex items-center gap-1 text-sm text-slate-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {{ optional($latestQuote->generated_at)->diffForHumans() }}
                                            </span>
                                            <span class="inline-flex items-center gap-1 text-sm rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                                                Risk {{ ucfirst($latestQuote->risk_rating ?? 'n/a') }}
                                            </span>
                                        </div>
                                        @if ($latestQuote->ai_commentary)
                                            <p class="mt-3 text-slate-600">{{ \Illuminate\Support\Str::limit($latestQuote->ai_commentary, 220) }}</p>
                                        @endif
                                    </div>
                                @else
                                    <div class="listing-card__telemetry mt-6">
                                        Run a fresh mortgage scenario to unlock tailored repayments and AI commentary for this listing.
                                    </div>
                                @endif

                                <div class="listing-card__telemetry mt-6 border-dashed">
                                    @if ($listingTelemetry && ($listingTelemetry['total'] ?? 0) > 0)
                                        <div class="flex flex-wrap items-center gap-2 text-indigo-900">
                                            <span class="listing-card__telemetry-badge">
                                                {{ $listingTelemetry['total'] }} refreshes
                                            </span>
                                            @foreach ($telemetryChannels as $channel => $count)
                                                <span class="listing-card__telemetry-badge bg-white/60 text-indigo-600">
                                                    {{ ucfirst($channel) }} · {{ $count }}
                                                </span>
                                            @endforeach
                                            @if ($listingLastAccessedAt)
                                                <span class="listing-card__telemetry-badge bg-white/40 text-indigo-500">
                                                    Last refresh {{ $listingLastAccessedAt->diffForHumans() }}
                                                </span>
                                            @endif
                                        </div>
                                    @else
                                        <div class="flex items-center gap-3 text-indigo-700 text-base">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            No widget refreshes captured this week — surface the widget in your outreach and check back soon.
                                        </div>
                                    @endif
                                </div>
                            </article>
                        @endforeach
                    </div>

                    <div class="mt-8">
                        {{ $listings->links() }}
                    </div>
                @endif
            </section>
        </div>
    </div>
@endsection

