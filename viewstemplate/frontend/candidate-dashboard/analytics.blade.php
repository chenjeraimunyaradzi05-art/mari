<x-app-layout>
    @php
        $ensureCollection = function ($value) {
            if ($value instanceof \Illuminate\Pagination\AbstractPaginator) {
                return $value->getCollection();
            }

            if ($value instanceof \Illuminate\Support\Collection) {
                return $value;
            }

            if (is_array($value)) {
                return collect($value);
            }

            return collect();
        };

        $profileViewsCollection = $ensureCollection($profileViews ?? null)->values();
        $engagementCollection = $ensureCollection($engagement ?? null);
        $jobStatsCollection = $ensureCollection($jobStats ?? null);
        $aiInsightsCollection = collect($aiAnalytics ?? [])->filter(function ($value) {
            return filled($value);
        })->values();

        $profileViewSeries = [];
        $profileViewLabels = [];

        foreach ($profileViewsCollection as $index => $item) {
            $numericValue = null;

            if (is_array($item)) {
                foreach (['count', 'value', 'views', 'total'] as $key) {
                    if (array_key_exists($key, $item) && is_numeric($item[$key])) {
                        $numericValue = (float) $item[$key];
                        break;
                    }
                }

                if ($numericValue === null) {
                    $firstNumeric = collect($item)->first(function ($value) {
                        return is_numeric($value);
                    });

                    if ($firstNumeric !== null) {
                        $numericValue = (float) $firstNumeric;
                    }
                }
            } elseif (is_numeric($item)) {
                $numericValue = (float) $item;
            }

            if ($numericValue === null) {
                continue;
            }

            $labelCandidate = null;

            if (is_array($item)) {
                foreach (['date', 'label', 'day'] as $labelKey) {
                    if (!empty($item[$labelKey])) {
                        $labelCandidate = $item[$labelKey];
                        break;
                    }
                }
            }

            if ($labelCandidate instanceof \Carbon\CarbonInterface) {
                $label = $labelCandidate->format('M j');
            } elseif (is_string($labelCandidate) && trim($labelCandidate) !== '') {
                if (class_exists(\Carbon\Carbon::class) && strtotime($labelCandidate) !== false) {
                    try {
                        $label = \Carbon\Carbon::parse($labelCandidate)->format('M j');
                    } catch (\Exception $exception) {
                        $label = (string) $labelCandidate;
                    }
                } else {
                    $label = (string) $labelCandidate;
                }
            } else {
                $label = 'Day ' . ($index + 1);
            }

            $profileViewSeries[] = $numericValue;
            $profileViewLabels[] = $label;
        }

        $profileViewSeries = collect($profileViewSeries)->values();
        $profileViewLabels = collect($profileViewLabels)->values();

        $engagementSeries = [];
        foreach ($engagementCollection as $key => $value) {
            $numericValue = null;

            if (is_array($value)) {
                foreach (['value', 'count', 'total'] as $valueKey) {
                    if (array_key_exists($valueKey, $value) && is_numeric($value[$valueKey])) {
                        $numericValue = (float) $value[$valueKey];
                        break;
                    }
                }

                if ($numericValue === null) {
                    $firstNumeric = collect($value)->first(function ($inner) {
                        return is_numeric($inner);
                    });

                    if ($firstNumeric !== null) {
                        $numericValue = (float) $firstNumeric;
                    }
                }
            } elseif (is_numeric($value)) {
                $numericValue = (float) $value;
            }

            if ($numericValue === null) {
                continue;
            }

            $normalizedKey = is_string($key) && trim($key) !== ''
                ? \Illuminate\Support\Str::headline($key)
                : 'Metric ' . (count($engagementSeries) + 1);

            $engagementSeries[$normalizedKey] = $numericValue;
        }

        $engagementSeries = collect($engagementSeries);

        $jobStatsSeries = [];
        foreach ($jobStatsCollection as $key => $value) {
            $numericValue = null;

            if (is_array($value)) {
                foreach (['value', 'count', 'total'] as $valueKey) {
                    if (array_key_exists($valueKey, $value) && is_numeric($value[$valueKey])) {
                        $numericValue = (float) $value[$valueKey];
                        break;
                    }
                }

                if ($numericValue === null) {
                    $firstNumeric = collect($value)->first(function ($inner) {
                        return is_numeric($inner);
                    });

                    if ($firstNumeric !== null) {
                        $numericValue = (float) $firstNumeric;
                    }
                }
            } elseif (is_numeric($value)) {
                $numericValue = (float) $value;
            }

            if ($numericValue === null) {
                continue;
            }

            $normalizedKey = is_string($key) && trim($key) !== ''
                ? \Illuminate\Support\Str::headline($key)
                : 'Stage ' . (count($jobStatsSeries) + 1);

            $jobStatsSeries[$normalizedKey] = $numericValue;
        }

        $jobStatsSeries = collect($jobStatsSeries);

        $profileViewTotal = (int) round($profileViewSeries->sum());
        $profileViewAverage = $profileViewSeries->isNotEmpty()
            ? round($profileViewSeries->avg(), 1)
            : null;
        $profileViewLatest = $profileViewSeries->last();
        $profileViewPrevious = $profileViewSeries->count() > 1
            ? $profileViewSeries->slice(0, -1)->last()
            : null;

        $profileViewTrendAbsolute = null;
        $profileViewTrendPercent = null;
        $profileViewTrendDirection = 'steady';

        if ($profileViewPrevious !== null && $profileViewLatest !== null) {
            $profileViewTrendAbsolute = $profileViewLatest - $profileViewPrevious;
            $profileViewTrendDirection = $profileViewTrendAbsolute > 0 ? 'up' : ($profileViewTrendAbsolute < 0 ? 'down' : 'steady');

            if ((float) $profileViewPrevious !== 0.0) {
                $profileViewTrendPercent = round(($profileViewTrendAbsolute / $profileViewPrevious) * 100, 1);
            }
        }

        $profileViewTrendLabel = 'Holding steady';
        if ($profileViewTrendDirection === 'up') {
            $profileViewTrendLabel = '+' . number_format((float) max($profileViewTrendAbsolute ?? 0, 0)) . ' vs prior';
        } elseif ($profileViewTrendDirection === 'down') {
            $profileViewTrendLabel = number_format((float) $profileViewTrendAbsolute) . ' vs prior';
        } elseif ($profileViewTotal === 0) {
            $profileViewTrendLabel = 'No activity yet';
        }

        $engagementTotal = (int) round($engagementSeries->sum());
        $engagementAverage = $engagementSeries->isNotEmpty()
            ? round($engagementSeries->avg(), 1)
            : null;
        $engagementTopKey = $engagementSeries->isNotEmpty()
            ? $engagementSeries->sortDesc()->keys()->first()
            : null;
        $engagementTopValue = $engagementTopKey ? $engagementSeries->get($engagementTopKey) : null;

        $jobStatsTotal = (int) round($jobStatsSeries->sum());
        $jobStatsInterviews = 0;
        $jobStatsWins = 0;

        foreach ($jobStatsSeries as $key => $value) {
            $slug = \Illuminate\Support\Str::slug($key);

            if (str_contains($slug, 'interview')) {
                $jobStatsInterviews += $value;
            }

            if (str_contains($slug, 'hire') || str_contains($slug, 'offer-accepted') || str_contains($slug, 'offeraccepted') || str_contains($slug, 'offer-won')) {
                $jobStatsWins += $value;
            }
        }

        $jobWinRate = $jobStatsTotal > 0 && $jobStatsWins > 0
            ? round(($jobStatsWins / $jobStatsTotal) * 100, 1)
            : null;

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) round($value));
        };

        $formatDecimal = function ($value) {
            return $value === null ? '—' : number_format((float) $value, 1);
        };

        $formatPercent = function ($value) {
            return $value === null ? '—' : number_format((float) $value, 1) . '%';
        };

        $exportRouteAvailable = \Illuminate\Support\Facades\Route::has('member.analytics.export');
        $settingsRouteName = null;
        foreach (['member.profile.settings', 'member.profile.edit', 'member.profile'] as $candidateRoute) {
            if (\Illuminate\Support\Facades\Route::has($candidateRoute)) {
                $settingsRouteName = $candidateRoute;
                break;
            }
        }

        $exportUrl = $exportRouteAvailable ? route('member.analytics.export') : '#';
        $settingsUrl = $settingsRouteName ? route($settingsRouteName) : '#';

        $profileTrendPercentLabel = $profileViewTrendPercent !== null
            ? ($profileViewTrendPercent >= 0 ? '+' : '') . number_format($profileViewTrendPercent, 1) . '%'
            : null;

        $analyticsHighlights = collect([
            [
                'icon' => 'fa-chart-line',
                'label' => 'Profile reach',
                'meta' => $profileTrendPercentLabel ?? $profileViewTrendLabel,
                'target' => 'analytics-card-profile',
            ],
            [
                'icon' => 'fa-sparkles',
                'label' => 'Engagement pulse',
                'meta' => $engagementTopKey
                    ? ($engagementTopValue ? $engagementTopKey . ' • ' . $formatNumber($engagementTopValue) : $engagementTopKey)
                    : 'Awaiting signals',
                'target' => 'analytics-card-engagement',
            ],
            [
                'icon' => 'fa-briefcase',
                'label' => 'Pipeline wins',
                'meta' => $jobStatsWins > 0 ? $formatNumber($jobStatsWins) . ' offers won' : 'Keep the momentum going',
                'target' => 'analytics-card-applications',
            ],
        ])->filter(function ($highlight) {
            return filled($highlight['label']);
        });
    @endphp

    <div class="analytics-dashboard container py-5 py-md-6">
        <section class="analytics-hero rounded-4 overflow-hidden">
            <div class="analytics-hero__background"></div>
            <div class="analytics-hero__container">
                <div class="analytics-hero__content">
                    <span class="analytics-hero__eyebrow">Growth Signals</span>
                    <h1 class="analytics-hero__title">See how your story lands across the talent universe</h1>
                    <p class="analytics-hero__subtitle">Celebrate the reach you&rsquo;ve sparked, peek at the interactions humming beneath the surface, and let AI whisper the next best move.</p>
                    <div class="analytics-hero__cta">
                        <a href="{{ $exportUrl }}" class="analytics-hero__primary" @unless($exportRouteAvailable) aria-disabled="true" @endunless>
                            <i class="fas fa-download me-2"></i>Download latest report
                        </a>
                        <a href="{{ $settingsUrl }}" class="analytics-hero__secondary" @unless($settingsRouteName) aria-disabled="true" @endunless>
                            <i class="fas fa-sliders-h me-2"></i>Tune profile visibility
                        </a>
                    </div>
                </div>
                <div class="analytics-hero__metrics">
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon"><i class="fas fa-eye"></i></span>
                        <div>
                            <p class="hero-stat__label">Views this week</p>
                            <p class="hero-stat__value">{{ $formatNumber($profileViewTotal) }}</p>
                            <p class="hero-stat__hint">{{ $profileTrendPercentLabel ?? $profileViewTrendLabel }}</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon"><i class="fas fa-wave-square"></i></span>
                        <div>
                            <p class="hero-stat__label">Avg daily reach</p>
                            <p class="hero-stat__value">{{ $formatDecimal($profileViewAverage) }}</p>
                            <p class="hero-stat__hint">Last synced data</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon"><i class="fas fa-heart"></i></span>
                        <div>
                            <p class="hero-stat__label">Engagement average</p>
                            <p class="hero-stat__value">{{ $formatDecimal($engagementAverage) }}</p>
                            <p class="hero-stat__hint">{{ $engagementTopKey ? $engagementTopKey . ' leads' : 'Awaiting touchpoints' }}</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--indigo">
                        <span class="hero-stat__icon"><i class="fas fa-trophy"></i></span>
                        <div>
                            <p class="hero-stat__label">Win rate</p>
                            <p class="hero-stat__value">{{ $formatPercent($jobWinRate) }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($jobStatsWins) }} offers converted</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="analytics-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Signals to explore</h2>
                    <p class="section-subtitle mb-0">Jump straight to the stories reshaping your opportunities right now</p>
                </div>
                <span class="status-pill">Curated for you</span>
            </div>

            <div class="analytics-highlight-strip">
                @forelse($analyticsHighlights as $highlight)
                    <button type="button" class="analytics-highlight-card" data-analytics-target="{{ $highlight['target'] }}">
                        <span class="analytics-highlight-card__icon"><i class="fas {{ $highlight['icon'] }}"></i></span>
                        <span class="analytics-highlight-card__label">{{ $highlight['label'] }}</span>
                        <span class="analytics-highlight-card__meta">{{ $highlight['meta'] }}</span>
                    </button>
                @empty
                    <div class="analytics-highlight-card analytics-highlight-card--empty">
                        <span class="analytics-highlight-card__icon"><i class="fas fa-sparkles"></i></span>
                        <span class="analytics-highlight-card__label">Insights will appear once data lands</span>
                        <span class="analytics-highlight-card__meta">Check back after your next activity burst</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="analytics-summary mt-5">
            <div class="analytics-summary-grid">
                <div class="analytics-summary-card analytics-summary-card--sunrise">
                    <span class="analytics-summary-card__icon"><i class="fas fa-sun"></i></span>
                    <div>
                        <p class="analytics-summary-card__label">Profile reach</p>
                        <p class="analytics-summary-card__value">{{ $formatNumber($profileViewTotal) }}</p>
                        <p class="analytics-summary-card__hint">Across the last synced window</p>
                    </div>
                </div>
                <div class="analytics-summary-card analytics-summary-card--lilac">
                    <span class="analytics-summary-card__icon"><i class="fas fa-comment-dots"></i></span>
                    <div>
                        <p class="analytics-summary-card__label">Engagements logged</p>
                        <p class="analytics-summary-card__value">{{ $formatNumber($engagementTotal) }}</p>
                        <p class="analytics-summary-card__hint">Messages, saves &amp; profile taps</p>
                    </div>
                </div>
                <div class="analytics-summary-card analytics-summary-card--indigo">
                    <span class="analytics-summary-card__icon"><i class="fas fa-rocket"></i></span>
                    <div>
                        <p class="analytics-summary-card__label">Offers converted</p>
                        <p class="analytics-summary-card__value">{{ $formatNumber($jobStatsWins) }}</p>
                        <p class="analytics-summary-card__hint">Interviews progressed: {{ $formatNumber($jobStatsInterviews) }}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="analytics-grid mt-5">
            <div class="row g-4">
                <div class="col-xl-6">
                    <article class="analytics-card" id="analytics-card-profile">
                        <header class="analytics-card__header">
                            <div>
                                <span class="analytics-card__eyebrow">Momentum</span>
                                <h3 class="analytics-card__title">Profile views trail</h3>
                                <p class="analytics-card__subtitle">Track how your visibility shifts day by day</p>
                            </div>
                            <span class="analytics-card__chip">
                                <i class="fas fa-arrow-right"></i>
                                {{ $profileTrendPercentLabel ?? $profileViewTrendLabel }}
                            </span>
                        </header>
                        <div class="analytics-card__chart">
                            <canvas id="profileViewsChart"></canvas>
                        </div>
                    </article>
                </div>
                <div class="col-xl-6">
                    <article class="analytics-card" id="analytics-card-engagement">
                        <header class="analytics-card__header">
                            <div>
                                <span class="analytics-card__eyebrow">Connection energy</span>
                                <h3 class="analytics-card__title">Engagement mix</h3>
                                <p class="analytics-card__subtitle">Spot the touchpoints fans love the most</p>
                            </div>
                            <span class="analytics-card__chip">
                                <i class="fas fa-heart"></i>
                                {{ $engagementTopKey ? ($engagementTopKey . ' leads') : 'Waiting on signals' }}
                            </span>
                        </header>
                        <div class="analytics-card__chart">
                            <canvas id="engagementChart"></canvas>
                        </div>
                    </article>
                </div>
                <div class="col-xl-6">
                    <article class="analytics-card" id="analytics-card-applications">
                        <header class="analytics-card__header">
                            <div>
                                <span class="analytics-card__eyebrow">Opportunities</span>
                                <h3 class="analytics-card__title">Job pipeline health</h3>
                                <p class="analytics-card__subtitle">See how each stage of your applications is pacing</p>
                            </div>
                            <span class="analytics-card__chip">
                                <i class="fas fa-rocket"></i>
                                {{ $formatPercent($jobWinRate) }} win rate
                            </span>
                        </header>
                        <div class="analytics-card__chart">
                            <canvas id="jobStatsChart"></canvas>
                        </div>
                    </article>
                </div>
                <div class="col-xl-6">
                    <article class="analytics-card analytics-card--insights">
                        <header class="analytics-card__header">
                            <div>
                                <span class="analytics-card__eyebrow">AI whispers</span>
                                <h3 class="analytics-card__title">Next moves suggested</h3>
                                <p class="analytics-card__subtitle">Let our co-pilot surface quick wins tailored for you</p>
                            </div>
                        </header>
                        <div class="analytics-insights">
                            @forelse($aiInsightsCollection as $insight)
                                <div class="analytics-insight">
                                    <span class="analytics-insight__icon"><i class="fas fa-sparkles"></i></span>
                                    <p class="analytics-insight__text">{{ $insight }}</p>
                                </div>
                            @empty
                                <div class="analytics-empty">
                                    <span class="analytics-empty__icon"><i class="fas fa-circle-notch"></i></span>
                                    <h4 class="analytics-empty__title">No insights yet</h4>
                                    <p class="analytics-empty__subtitle">Start engaging with roles and we&rsquo;ll illuminate smart nudges right here.</p>
                                </div>
                            @endforelse
                        </div>
                    </article>
                </div>
            </div>
        </section>
    </div>

    @push('scripts')
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var highlightButtons = document.querySelectorAll('[data-analytics-target]');
                var analyticCards = document.querySelectorAll('.analytics-card');

                highlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-analytics-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        analyticCards.forEach(function (card) {
                            card.classList.remove('analytics-card--focus');
                        });

                        target.classList.add('analytics-card--focus');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                });

                var profileViewsCtx = document.getElementById('profileViewsChart');
                if (profileViewsCtx && window.Chart) {
                    var profileViewLabels = @json($profileViewLabels->values());
                    var profileViewData = @json($profileViewSeries->values());

                    new Chart(profileViewsCtx, {
                        type: 'line',
                        data: {
                            labels: profileViewLabels,
                            datasets: [{
                                label: 'Profile Views',
                                data: profileViewData,
                                borderColor: '#a855f7',
                                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                fill: true,
                                tension: 0.4,
                                borderWidth: 2,
                                pointRadius: 3,
                                pointBackgroundColor: '#7c3aed'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    ticks: {
                                        precision: 0,
                                        color: 'rgba(79, 70, 229, 0.7)'
                                    },
                                    grid: {
                                        color: 'rgba(129, 140, 248, 0.15)'
                                    }
                                },
                                x: {
                                    ticks: {
                                        color: 'rgba(79, 70, 229, 0.7)'
                                    },
                                    grid: {
                                        display: false
                                    }
                                }
                            }
                        }
                    });
                }

                var engagementCtx = document.getElementById('engagementChart');
                if (engagementCtx && window.Chart) {
                    var engagementLabels = @json($engagementSeries->keys()->values());
                    var engagementData = @json($engagementSeries->values());

                    new Chart(engagementCtx, {
                        type: 'bar',
                        data: {
                            labels: engagementLabels,
                            datasets: [{
                                label: 'Engagement',
                                data: engagementData,
                                backgroundColor: ['#4f46e5', '#a855f7', '#ec4899', '#f97316', '#22c55e']
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    ticks: {
                                        precision: 0,
                                        color: 'rgba(55, 48, 163, 0.7)'
                                    },
                                    grid: {
                                        color: 'rgba(165, 180, 252, 0.2)'
                                    }
                                },
                                x: {
                                    ticks: {
                                        color: 'rgba(55, 48, 163, 0.7)'
                                    },
                                    grid: {
                                        display: false
                                    }
                                }
                            }
                        }
                    });
                }

                var jobStatsCtx = document.getElementById('jobStatsChart');
                if (jobStatsCtx && window.Chart) {
                    var jobStatsLabels = @json($jobStatsSeries->keys()->values());
                    var jobStatsData = @json($jobStatsSeries->values());

                    new Chart(jobStatsCtx, {
                        type: 'doughnut',
                        data: {
                            labels: jobStatsLabels,
                            datasets: [{
                                data: jobStatsData,
                                backgroundColor: ['#4f46e5', '#a855f7', '#ec4899', '#f97316', '#22c55e', '#0ea5e9']
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        color: 'rgba(88, 28, 135, 0.85)',
                                        padding: 16
                                    }
                                }
                            }
                        }
                    });
                }
            });
        </script>
    @endpush
</x-app-layout>
