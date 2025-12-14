<x-app-layout>
    @php
        $alertsSource = $alerts ?? $jobAlerts ?? null;

        if ($alertsSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $alertsCollection = $alertsSource->getCollection();
        } elseif ($alertsSource instanceof \Illuminate\Support\Collection) {
            $alertsCollection = $alertsSource;
        } elseif (is_array($alertsSource)) {
            $alertsCollection = collect($alertsSource);
        } else {
            $alertsCollection = collect();
        }

        $alertsCollection = $alertsCollection->filter();

        $totalAlerts = $alertsCount
            ?? ($alertsSource instanceof \Illuminate\Pagination\AbstractPaginator
                ? $alertsSource->total()
                : $alertsCollection->count());

        $activeAlerts = $alertsCollection->filter(function ($alert) {
            return (bool) data_get($alert, 'is_active', false);
        });
        $pausedAlerts = $alertsCollection->reject(function ($alert) {
            return (bool) data_get($alert, 'is_active', false);
        });

        $alertMetrics = [];
        foreach ($alertsCollection as $alert) {
            $stats = method_exists($alert, 'getAlertStats') ? (array) $alert->getAlertStats() : [];
            $alertMetrics[spl_object_id($alert)] = [
                'sent' => (int) ($stats['sent'] ?? 0),
                'clicked' => (int) ($stats['clicked'] ?? 0),
                'applied' => (int) ($stats['applied'] ?? 0),
                'engagement' => method_exists($alert, 'getEngagementRate')
                    ? (float) $alert->getEngagementRate()
                    : null,
                'conversion' => method_exists($alert, 'getConversionRate')
                    ? (float) $alert->getConversionRate()
                    : null,
                'last_sent_at' => data_get($alert, 'last_sent_at'),
            ];
        }

        $totalSent = collect($alertMetrics)->sum('sent');
        $totalClicked = collect($alertMetrics)->sum('clicked');
        $totalApplied = collect($alertMetrics)->sum('applied');

        $averageEngagement = collect($alertMetrics)
            ->pluck('engagement')
            ->filter(function ($value) {
                return $value !== null;
            })
            ->avg();
        $averageEngagement = $averageEngagement !== null ? round($averageEngagement, 1) : null;

        $latestDispatch = collect($alertMetrics)
            ->pluck('last_sent_at')
            ->filter()
            ->sort(function ($a, $b) {
                $aTime = $a instanceof \Carbon\CarbonInterface ? $a->valueOf() : strtotime((string) $a);
                $bTime = $b instanceof \Carbon\CarbonInterface ? $b->valueOf() : strtotime((string) $b);
                return $bTime <=> $aTime;
            })
            ->first();

        $latestDispatchHuman = null;
        if ($latestDispatch instanceof \Carbon\CarbonInterface) {
            $latestDispatchHuman = $latestDispatch->diffForHumans(null, true);
        } elseif (is_string($latestDispatch)) {
            $latestDispatchHuman = \Illuminate\Support\Str::limit($latestDispatch, 22);
        }

        $highlightAlerts = $alertsCollection
            ->sortByDesc(function ($alert) use ($alertMetrics) {
                $metrics = $alertMetrics[spl_object_id($alert)] ?? [];
                $score = ($metrics['sent'] ?? 0) * 2 + ($metrics['clicked'] ?? 0) + ($metrics['applied'] ?? 0) * 3;
                if (data_get($alert, 'is_active')) {
                    $score += 500;
                }
                return $score;
            })
            ->take(6);

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };

        $formatRate = function ($value) {
            return $value === null ? '—' : number_format((float) $value, 1) . '%';
        };

        $hasCreateRoute = \Illuminate\Support\Facades\Route::has('member.job-alerts.create');
        $hasToggleRoute = \Illuminate\Support\Facades\Route::has('member.job-alerts.toggle');
        $hasEditRoute = \Illuminate\Support\Facades\Route::has('member.job-alerts.edit');
        $hasDestroyRoute = \Illuminate\Support\Facades\Route::has('member.job-alerts.destroy');
    @endphp

    <div class="alerts-dashboard container py-5 py-md-6">
        <section class="alerts-hero rounded-4 overflow-hidden">
            <div class="alerts-hero__background"></div>
            <div class="alerts-hero__container">
                <div class="alerts-hero__content">
                    <span class="alerts-hero__eyebrow">Job Signals</span>
                    <h1 class="alerts-hero__title">Keep your opportunities flowing with mindful alerts</h1>
                    <p class="alerts-hero__subtitle">Celebrate the alerts that light up your inbox, tune the ones needing attention, and stay ready for every role that shimmers on your horizon.</p>
                    <div class="alerts-hero__cta">
                        <a href="{{ $hasCreateRoute ? route('member.job-alerts.create') : '#' }}" class="alerts-hero__primary" @unless($hasCreateRoute) aria-disabled="true" @endunless>
                            <i class="fas fa-plus me-2"></i>Create new alert
                        </a>
                        <a href="{{ $hasCreateRoute ? route('member.job-alerts.create') : '#' }}" class="alerts-hero__secondary" @unless($hasCreateRoute) aria-disabled="true" @endunless>
                            <i class="fas fa-magic me-2"></i>Let AI suggest one
                        </a>
                    </div>
                </div>
                <div class="alerts-hero__metrics">
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon"><i class="fas fa-bell"></i></span>
                        <div>
                            <p class="hero-stat__label">Total Alerts</p>
                            <p class="hero-stat__value">{{ $formatNumber($totalAlerts) }}</p>
                            <p class="hero-stat__hint">Across all categories</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon"><i class="fas fa-sun"></i></span>
                        <div>
                            <p class="hero-stat__label">Active Today</p>
                            <p class="hero-stat__value">{{ $formatNumber($activeAlerts->count()) }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($pausedAlerts->count()) }} paused</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon"><i class="fas fa-chart-line"></i></span>
                        <div>
                            <p class="hero-stat__label">Avg Engagement</p>
                            <p class="hero-stat__value">{{ $formatRate($averageEngagement) }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($totalClicked) }} clicks to date</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--indigo">
                        <span class="hero-stat__icon"><i class="fas fa-clock"></i></span>
                        <div>
                            <p class="hero-stat__label">Latest Dispatch</p>
                            <p class="hero-stat__value">{{ $latestDispatchHuman ?? '—' }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($totalSent) }} total sent</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="alerts-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Tune-in moments</h2>
                    <p class="section-subtitle mb-0">Hop straight to the alerts ushering in the most momentum right now</p>
                </div>
                <span class="status-pill">Curated from performance</span>
            </div>

            <div class="alerts-highlight-strip">
                @forelse ($highlightAlerts as $alert)
                    @php
                        $metrics = $alertMetrics[spl_object_id($alert)] ?? [];
                        $frequency = data_get($alert, 'frequency');
                        $frequencyLabel = $frequency ? \Illuminate\Support\Str::headline((string) $frequency) : 'Custom cadence';
                        $key = data_get($alert, 'id')
                            ?? data_get($alert, 'uuid')
                            ?? (string) spl_object_id($alert);
                    @endphp
                    <button type="button" class="alerts-highlight-card alerts-highlight-card--{{ data_get($alert, 'is_active') ? 'active' : 'paused' }}" data-alert-target="alert-card-{{ $key }}">
                        <span class="alerts-highlight-card__icon"><i class="fas fa-bell"></i></span>
                        <span class="alerts-highlight-card__label">{{ \Illuminate\Support\Str::limit(data_get($alert, 'name', 'Job alert'), 24) }}</span>
                        <span class="alerts-highlight-card__meta">{{ $frequencyLabel }} • {{ $formatNumber($metrics['sent'] ?? 0) }} sent</span>
                    </button>
                @empty
                    <div class="alerts-highlight-card alerts-highlight-card--empty">
                        <span class="alerts-highlight-card__icon"><i class="fas fa-sparkles"></i></span>
                        <span class="alerts-highlight-card__label">Create your first alert</span>
                        <span class="alerts-highlight-card__meta">Smart suggestions arrive here</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="alerts-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All job alerts</h2>
                    <p class="section-subtitle mb-0">Stay in sync with every set of opportunities you’re nurturing</p>
                </div>
                <span class="status-pill">{{ $formatNumber($totalAlerts) }} total</span>
            </div>

            @if ($alertsCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($alertsCollection as $alert)
                        @php
                            $metrics = $alertMetrics[spl_object_id($alert)] ?? [];
                            $keywords = (array) data_get($alert, 'keywords', []);
                            $categories = (array) data_get($alert, 'job_categories', []);
                            $locations = (array) data_get($alert, 'locations', []);
                            $channels = collect([
                                data_get($alert, 'email_enabled') ? 'Email' : null,
                                data_get($alert, 'sms_enabled') ? 'SMS' : null,
                                data_get($alert, 'push_enabled') ? 'Push' : null,
                            ])->filter()->values();
                            $frequency = data_get($alert, 'frequency');
                            $frequencyLabel = $frequency ? \Illuminate\Support\Str::headline((string) $frequency) : 'Custom cadence';
                            $lastSentAt = $metrics['last_sent_at'] ?? null;
                            $lastSentLabel = $lastSentAt instanceof \Carbon\CarbonInterface
                                ? $lastSentAt->diffForHumans()
                                : (is_string($lastSentAt) ? \Illuminate\Support\Str::limit($lastSentAt, 24) : 'Not yet delivered');
                            $alertKey = data_get($alert, 'id')
                                ?? data_get($alert, 'uuid')
                                ?? (string) spl_object_id($alert);
                            $isActive = (bool) data_get($alert, 'is_active', false);
                            $conversionRate = $metrics['conversion'] ?? null;
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <article class="alert-card {{ $isActive ? 'alert-card--active' : 'alert-card--paused' }}" id="alert-card-{{ $alertKey }}">
                                <header class="alert-card__header">
                                    <div class="alert-card__summary">
                                        <span class="alert-card__icon">
                                            <i class="fas fa-bell"></i>
                                        </span>
                                        <div>
                                            <h3 class="alert-card__title">{{ \Illuminate\Support\Str::limit(data_get($alert, 'name', 'Job alert'), 40) }}</h3>
                                            <p class="alert-card__subtitle">{{ $frequencyLabel }} • {{ $channels->isNotEmpty() ? $channels->implode(' • ') : 'No channels selected' }}</p>
                                        </div>
                                    </div>
                                    <div class="alert-card__status">
                                        <span class="alert-status-badge alert-status-badge--{{ $isActive ? 'active' : 'paused' }}">
                                            <i class="fas fa-circle me-1"></i>{{ $isActive ? 'Active' : 'Paused' }}
                                        </span>
                                        <time class="alert-card__timestamp">
                                            <i class="fas fa-clock me-1"></i>{{ $lastSentLabel }}
                                        </time>
                                    </div>
                                </header>

                                <div class="alert-card__filters">
                                    @if (!empty($keywords))
                                        <span class="alert-chip alert-chip--primary">
                                            <i class="fas fa-search me-2"></i>{{ \Illuminate\Support\Str::limit(implode(', ', array_slice($keywords, 0, 3)), 40) }}
                                            @if (count($keywords) > 3)
                                                <span class="alert-chip__more">+{{ count($keywords) - 3 }}</span>
                                            @endif
                                        </span>
                                    @endif
                                    @if (!empty($categories))
                                        <span class="alert-chip alert-chip--info">
                                            <i class="fas fa-folder-open me-2"></i>{{ count($categories) }} categories
                                        </span>
                                    @endif
                                    @if (!empty($locations))
                                        <span class="alert-chip alert-chip--warning">
                                            <i class="fas fa-map-marker-alt me-2"></i>{{ count($locations) }} regions
                                        </span>
                                    @endif
                                </div>

                                <div class="alert-card__metrics">
                                    <div class="alert-metric">
                                        <p class="alert-metric__value">{{ $formatNumber($metrics['sent'] ?? 0) }}</p>
                                        <p class="alert-metric__label">Sent</p>
                                    </div>
                                    <div class="alert-metric">
                                        <p class="alert-metric__value">{{ $formatNumber($metrics['clicked'] ?? 0) }}</p>
                                        <p class="alert-metric__label">Clicked</p>
                                    </div>
                                    <div class="alert-metric">
                                        <p class="alert-metric__value">{{ $formatNumber($metrics['applied'] ?? 0) }}</p>
                                        <p class="alert-metric__label">Applied</p>
                                    </div>
                                </div>

                                @if (($metrics['sent'] ?? 0) > 0)
                                    <div class="alert-card__progress">
                                        <div class="alert-progress">
                                            <div class="alert-progress__label">Engagement rate</div>
                                            <div class="alert-progress__bar">
                                                <span class="alert-progress__fill" style="width: {{ min(100, max(0, (float) ($metrics['engagement'] ?? 0))) }}%"></span>
                                            </div>
                                            <div class="alert-progress__value">{{ $formatRate($metrics['engagement'] ?? null) }}</div>
                                        </div>
                                        @if ($conversionRate !== null)
                                            <div class="alert-progress">
                                                <div class="alert-progress__label">Conversion rate</div>
                                                <div class="alert-progress__bar">
                                                    <span class="alert-progress__fill alert-progress__fill--success" style="width: {{ min(100, max(0, (float) $conversionRate)) }}%"></span>
                                                </div>
                                                <div class="alert-progress__value">{{ $formatRate($conversionRate) }}</div>
                                            </div>
                                        @endif
                                    </div>
                                @endif

                                <footer class="alert-card__footer">
                                    <a href="{{ $hasEditRoute ? route('member.job-alerts.edit', data_get($alert, 'id')) : '#' }}" class="chip-btn chip-btn--ghost flex-fill" @if (!$hasEditRoute) aria-disabled="true" @endif>
                                        <i class="fas fa-edit me-2"></i>Edit alert
                                    </a>
                                    @if ($hasToggleRoute && data_get($alert, 'id'))
                                        <form action="{{ route('member.job-alerts.toggle', data_get($alert, 'id')) }}" method="POST" class="flex-fill">
                                            @csrf
                                            <button type="submit" class="chip-btn {{ $isActive ? 'chip-btn--warning' : 'chip-btn--success' }} w-100">
                                                <i class="fas fa-{{ $isActive ? 'pause' : 'play' }} me-2"></i>{{ $isActive ? 'Pause' : 'Resume' }}
                                            </button>
                                        </form>
                                    @endif
                                    @if ($hasDestroyRoute && data_get($alert, 'id'))
                                        <form action="{{ route('member.job-alerts.destroy', data_get($alert, 'id')) }}" method="POST" class="flex-fill" onsubmit="return confirm('Delete this alert?');">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="chip-btn chip-btn--danger w-100">
                                                <i class="fas fa-trash me-2"></i>Delete
                                            </button>
                                        </form>
                                    @endif
                                </footer>
                            </article>
                        </div>
                    @endforeach
                </div>

                @if ($alertsSource instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $alertsSource->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <h3 class="empty-state__title">No job alerts yet</h3>
                    <p class="empty-state__subtitle">Invite our AI to scout on your behalf—set up your preferences and watch aligned roles arrive.</p>
                    <a href="{{ $hasCreateRoute ? route('member.job-alerts.create') : '#' }}" class="chip-btn" @unless($hasCreateRoute) aria-disabled="true" @endunless>
                        <i class="fas fa-plus me-2"></i>Create your first alert
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var alertHighlightButtons = document.querySelectorAll('[data-alert-target]');
                var alertCards = document.querySelectorAll('.alert-card');

                alertHighlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-alert-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        alertCards.forEach(function (card) {
                            card.classList.remove('alert-card--focus');
                        });

                        target.classList.add('alert-card--focus');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
