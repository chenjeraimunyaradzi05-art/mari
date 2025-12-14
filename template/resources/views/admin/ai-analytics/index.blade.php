@extends('admin.layouts.master')



@section('contents')
<div class="dashboard-ai-analytics">
    <!-- Header -->
    <div class="row mb-4">
        <div class="col-md-6">
            <h2 class="mb-0">
                <i class="fas fa-robot" style="color: #E91E8C;"></i> AI Analytics Dashboard
            </h2>
            <p class="text-muted">Monitor AI system performance and usage metrics</p>
            <div class="last-update-pill" id="dashboardLastUpdatePill">
                <i class="fas fa-clock"></i>
                <span id="dashboardLastUpdateText">Awaiting latest metrics…</span>
            </div>
        </div>
        <div class="col-md-6 text-end">
            <button type="button"  href="{{ route('admin.ai-analytics.realtime') }}" class="btn btn-primary me-2">
                <i class="fas fa-broadcast-tower"></i> Real-Time Dashboard
            </button>
            <div class="btn-group me-2">
                <button type="button"  href="{{ route('admin.ai-analytics.export.pdf') }}" class="btn btn-outline-danger" target="_blank">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </button>
                <button type="button"  href="{{ route('admin.ai-analytics.export.excel') }}" class="btn btn-outline-success">
                    <i class="fas fa-file-excel"></i> Export Excel
                </button>
            </div>
            <button class="btn btn-outline-primary" onclick="refreshMetrics()">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        </div>
    </div>

    <div class="alert alert-warning d-none metrics-fetch-alert" id="metricsFetchAlert">
        <i class="fas fa-exclamation-circle me-2"></i>
        <span id="metricsFetchMessage">Unable to refresh metrics.</span>
    </div>

    @if(isset($error))
        <div class="alert alert-warning">{{ $error }}</div>
    @endif

    @php
        $cdnHealth = $cdnHealth ?? [];
        $cdnSignals = collect($cdnHealth['latency_degraded_signals'] ?? []);
        $cdnHistogram = $cdnHealth['latency_histogram'] ?? [];
        $cdnHistogramLabels = $cdnHealth['latency_histogram_labels'] ?? array_keys($cdnHistogram);
        $cdnProbePercent = isset($cdnHealth['probe_success_ratio'])
            ? number_format(($cdnHealth['probe_success_ratio'] ?? 0) * 100, 1) . '%'
            : '—';
        $cdnLastAgeLabel = isset($cdnHealth['last_sample_age_seconds'])
            ? $cdnHealth['last_sample_age_seconds'] . 's'
            : '—';
    @endphp

    <!-- Real-time Metrics -->
    <div class="row g-3 mb-4">
        <div class="col-md-3">
            <div class="card stats-card" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">AI Requests Today</h6>
                            <h3 class="mb-0" id="aiRequestsToday">{{ number_format($stats['today_requests'] ?? 0) }}</h3>
                            <small class="text-white-50" id="aiTotalRequests">Total: {{ number_format($stats['total_requests'] ?? 0) }}</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-chart-line fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Cache Hit Rate</h6>
                            <h3 class="mb-0" id="cacheHitRate">{{ $cacheMetrics['cache_hit_rate'] ?? 0 }}%</h3>
                            <small class="text-white-50" id="cacheHitsLabel">{{ number_format($cacheMetrics['cache_hits'] ?? 0) }} hits</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-database fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Active Users Today</h6>
                            <h3 class="mb-0" id="activeUsersToday">{{ number_format($stats['unique_users_today'] ?? 0) }}</h3>
                            <small class="text-white-50" id="activeUsersWeek">This week: {{ number_format($stats['unique_users_this_week'] ?? 0) }}</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-users fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Error Rate</h6>
                            <h3 class="mb-0" id="errorRate">{{ $errorData['error_rate'] ?? 0 }}%</h3>
                            <small class="text-white-50" id="errorsTodayLabel">{{ number_format($errorData['today_errors'] ?? 0) }} today</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-exclamation-triangle fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Messaging CDN Health -->
    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="alert alert-danger d-flex align-items-center {{ ($cdnHealth['degraded'] ?? false) ? '' : 'd-none' }}" id="cdnAlertBanner">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <div>
                    <strong>Messaging CDN degraded.</strong>
                    <span id="cdnAlertSummary">{{ $cdnHealth['latency_degraded_summary'] ?? 'No guardrails firing' }}</span>
                </div>
            </div>
        </div>

        <div class="col-lg-8">
            <div class="card h-100 shadow-sm">
                <div class="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <h5 class="mb-0"><i class="fas fa-satellite-dish me-2" style="color:#E91E8C;"></i>Messaging CDN Health</h5>
                        <small class="text-muted">Guardrails sourced from latency sampler</small>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <span class="badge bg-secondary" id="cdnStatusBadge">{{ strtoupper($cdnHealth['status'] ?? 'unknown') }}</span>
                        <span class="badge {{ ($cdnHealth['degraded'] ?? false) ? 'bg-danger' : 'bg-success' }}" id="cdnDegradedBadge">
                            {{ ($cdnHealth['degraded'] ?? false) ? 'Degraded' : 'Healthy' }}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <p class="text-muted mb-3" id="cdnSummaryText">
                        {{ $cdnHealth['latency_degraded_summary'] ?? 'No guardrails firing.' }}
                    </p>

                    <div class="d-flex flex-wrap gap-2 mb-4" id="cdnSignalsContainer">
                        @forelse($cdnSignals as $signal)
                            <span class="cdn-signal-badge" data-signal="{{ $signal }}">
                                {{ ucfirst(str_replace('_', ' ', $signal)) }}
                            </span>
                        @empty
                            <span class="cdn-signal-badge healthy">All guardrails clear</span>
                        @endforelse
                    </div>

                    <div class="row g-3">
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Rolling Latency</small>
                            <div class="value" id="cdnRollingLatency">{{ $cdnHealth['rolling_latency_ms'] ?? '—' }} ms</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Success Ratio</small>
                            <div class="value" id="cdnProbeRatio">{{ $cdnProbePercent }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Failure Streak</small>
                            <div class="value" id="cdnFailureStreak">{{ $cdnHealth['failure_streak'] ?? 0 }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Window Samples</small>
                            <div class="value" id="cdnSampleCount">{{ $cdnHealth['window_sample_count'] ?? 0 }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Last Sample Age</small>
                            <div class="value" id="cdnLastSampleAge">{{ $cdnLastAgeLabel }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Last Probe</small>
                            <div class="value" id="cdnLastProbeCode">{{ $cdnHealth['last_probe_status_code'] ?? '—' }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Probe Attempts</small>
                            <div class="value" id="cdnLastProbeAttempts">{{ $cdnHealth['last_probe_attempts'] ?? '—' }}</div>
                        </div>
                        <div class="col-md-3 col-6 cdn-mini-metric">
                            <small>Stale Flag</small>
                            <div class="value" id="cdnStaleFlag">{{ ($cdnHealth['latency_stale'] ?? false) ? 'Yes' : 'No' }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100 shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-wave-square me-2" style="color:#8B5CF6;"></i>Latency Distribution</h5>
                </div>
                <div class="card-body" id="cdnHistogramList">
                    @forelse($cdnHistogramLabels as $label)
                        <div class="cdn-hist-row py-2 d-flex justify-content-between align-items-center">
                            <div class="text-muted">{{ $label }}</div>
                            <div class="fw-semibold">{{ $cdnHistogram[$label] ?? 0 }}</div>
                        </div>
                    @empty
                        <p class="text-muted mb-0">No samples recorded in the current window.</p>
                    @endforelse
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Row -->
    <div class="row g-3 mb-4">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-chart-area me-2" style="color: #E91E8C;"></i>AI Usage Trends (Last 7 Days)</h5>
                </div>
                <div class="card-body">
                    <canvas id="aiUsageChart" height="80"></canvas>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-trophy me-2" style="color: #8B5CF6;"></i>Popular Features</h5>
                </div>
                <div class="card-body">
                    <canvas id="featuresChart" height="200"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Feature Usage Breakdown -->
    <div class="row g-3 mb-4">
        <div class="col-md-6">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-list-check me-2" style="color: #E91E8C;"></i>Feature Usage Statistics</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Usage Count</th>
                                    <th>Percentage</th>
                                    <th>Trend</th>
                                </tr>
                            </thead>
                            <tbody id="featureUsageBody">
                                @foreach($popularFeatures ?? [] as $feature)
                                <tr>
                                    <td><strong>{{ $feature['name'] }}</strong></td>
                                    <td>{{ number_format($feature['usage_count']) }}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar" style="width: {{ $feature['percentage'] }}%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);">
                                                {{ $feature['percentage'] }}%
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        @if($feature['trend'] === 'up')
                                            <span class="badge bg-success"><i class="fas fa-arrow-up"></i> Up</span>
                                        @elseif($feature['trend'] === 'down')
                                            <span class="badge bg-danger"><i class="fas fa-arrow-down"></i> Down</span>
                                        @else
                                            <span class="badge bg-secondary"><i class="fas fa-minus"></i> Stable</span>
                                        @endif
                                    </td>
                                </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-bug me-2" style="color: #EF4444;"></i>Error Tracking</h5>
                </div>
                <div class="card-body">
                    <div class="mb-4">
                        <div class="row text-center">
                            <div class="col-4">
                                <div class="p-3" style="background: #FFF5F8; border-radius: 10px;">
                                    <h4 class="mb-1" style="color: #E91E8C;" id="errorSummaryToday">{{ number_format($errorData['today_errors'] ?? 0) }}</h4>
                                    <small class="text-muted">Today</small>
                                </div>
                            </div>
                            <div class="col-4">
                                <div class="p-3" style="background: #F5F3FF; border-radius: 10px;">
                                    <h4 class="mb-1" style="color: #8B5CF6;" id="errorSummaryWeek">{{ number_format($errorData['this_week_errors'] ?? 0) }}</h4>
                                    <small class="text-muted">This Week</small>
                                </div>
                            </div>
                            <div class="col-4">
                                <div class="p-3" style="background: #FFF5F8; border-radius: 10px;">
                                    <h4 class="mb-1" style="color: #E91E8C;" id="errorSummaryTotal">{{ number_format($errorData['total_errors'] ?? 0) }}</h4>
                                    <small class="text-muted">Total</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h6 class="mb-3">Most Common Errors</h6>
                    <div class="list-group" id="errorList">
                        @foreach($errorData['most_common_errors'] ?? [] as $error)
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <span>{{ $error['error'] }}</span>
                            <span class="badge bg-danger rounded-pill">{{ $error['count'] }}</span>
                        </div>
                        @endforeach
                    </div>
                </div>
            </div>
        </div>
    </div>

    @php
        $initialClientAlertStats = $clientAlertStats ?? [
            'severity' => ['critical' => 0, 'error' => 0, 'warning' => 0, 'info' => 0],
            'acknowledgement' => ['open' => 0, 'acknowledged' => 0],
            'trend' => [
                'window' => [
                    'label' => 'last 60m',
                    'current' => 0,
                    'previous' => 0,
                    'change_pct' => 0,
                ],
            ],
        ];
        $initialClientAlertStats['resolution'] = $initialClientAlertStats['resolution'] ?? [
            'window' => [
                'label' => 'ack (24h)',
                'average_minutes' => null,
                'max_minutes' => null,
                'sample_size' => 0,
                'percentiles' => [
                    'p90_minutes' => null,
                    'p99_minutes' => null,
                ],
            ],
            'stale_open' => [
                'threshold_minutes' => 60,
                'count' => 0,
                'oldest_open_minutes' => null,
            ],
            'sla' => [
                'threshold_minutes' => [
                    'warning' => 15,
                    'critical' => 45,
                ],
                'breaches' => [
                    'warning' => 0,
                    'critical' => 0,
                ],
            ],
        ];
    @endphp

    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="card h-100">
                <div class="card-header bg-white">
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <h5 class="mb-0"><i class="fas fa-bell me-2" style="color:#E91E8C;"></i>Recent Client Alerts</h5>
                            <small class="text-muted">Last few watchdog signals reported from browser dashboards</small>
                        </div>
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            <div>
                                <label for="clientAlertSeverityFilter" class="form-label small mb-1">Severity</label>
                                <select id="clientAlertSeverityFilter" class="form-select form-select-sm">
                                    <option value="all">All severities</option>
                                    <option value="critical">Critical</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                </select>
                            </div>
                            <div class="form-check form-switch mt-3 mt-sm-0">
                                <input class="form-check-input" type="checkbox" role="switch" id="clientAlertHideAck">
                                <label class="form-check-label small" for="clientAlertHideAck">Hide acknowledged</label>
                            </div>
                            <button class="btn btn-sm btn-outline-primary" type="button" id="clientAlertRefresh">
                                <i class="fas fa-sync-alt"></i> Refresh feed
                            </button>
                            <span class="badge bg-light text-muted" id="clientAlertCount">{{ count($clientAlerts ?? []) }} tracked</span>
                        </div>
                        <div class="w-100">
                            <div class="d-flex flex-wrap gap-2 align-items-center small" id="clientAlertSeverityStats">
                                <span class="badge bg-dark text-white">Critical <span id="clientAlertStatCritical">{{ $initialClientAlertStats['severity']['critical'] ?? 0 }}</span></span>
                                <span class="badge bg-danger">Error <span id="clientAlertStatError">{{ $initialClientAlertStats['severity']['error'] ?? 0 }}</span></span>
                                <span class="badge bg-warning text-dark">Warning <span id="clientAlertStatWarning">{{ $initialClientAlertStats['severity']['warning'] ?? 0 }}</span></span>
                                <span class="badge bg-info text-dark">Info <span id="clientAlertStatInfo">{{ $initialClientAlertStats['severity']['info'] ?? 0 }}</span></span>
                            </div>
                            <div class="d-flex flex-wrap gap-2 align-items-center small mt-2" id="clientAlertAckStats">
                                <span class="badge bg-secondary">Open <span id="clientAlertStatOpen">{{ $initialClientAlertStats['acknowledgement']['open'] ?? 0 }}</span></span>
                                <span class="badge bg-success">Acknowledged <span id="clientAlertStatAcknowledged">{{ $initialClientAlertStats['acknowledgement']['acknowledged'] ?? 0 }}</span></span>
                            </div>
                            <div class="d-flex flex-wrap gap-2 align-items-center small mt-2" id="clientAlertTrendStats">
                                <span class="badge bg-light text-dark">{{ $initialClientAlertStats['trend']['window']['label'] ?? 'last 60m' }}: <span id="clientAlertTrendCurrent">{{ $initialClientAlertStats['trend']['window']['current'] ?? 0 }}</span></span>
                                <span class="badge bg-light text-muted">Prev: <span id="clientAlertTrendPrevious">{{ $initialClientAlertStats['trend']['window']['previous'] ?? 0 }}</span></span>
                                <span class="badge bg-light" id="clientAlertTrendDelta" data-value="{{ $initialClientAlertStats['trend']['window']['change_pct'] ?? 0 }}">
                                    <span id="clientAlertTrendDeltaLabel">{{ $initialClientAlertStats['trend']['window']['change_pct'] ?? 0 }}%</span>
                                </span>
                            </div>
                            @php
                                $avgMinutes = $initialClientAlertStats['resolution']['window']['average_minutes'] ?? null;
                                $maxMinutes = $initialClientAlertStats['resolution']['window']['max_minutes'] ?? null;
                                $defaultThreshold = $initialClientAlertStats['resolution']['stale_open']['threshold_minutes'] ?? 60;
                                $formatMinutes = function ($value) {
                                    if ($value === null) {
                                        return '—';
                                    }
                                    $rounded = round((float) $value, 1);
                                    $label = rtrim(rtrim(number_format($rounded, 1), '0'), '.');
                                    return $label . 'm';
                                };
                            @endphp
                            <div class="d-flex flex-wrap gap-2 align-items-center small mt-2" id="clientAlertResolutionStats">
                                <span class="badge bg-light text-primary" title="Average acknowledgement time across the last 24h sample">
                                    Avg ack (24h): <span id="clientAlertResolutionAverage">{{ $formatMinutes($avgMinutes) }}</span>
                                </span>
                                <span class="badge bg-light text-primary" title="Slowest acknowledgement in the last 24h sample">
                                    Max ack: <span id="clientAlertResolutionMax">{{ $formatMinutes($maxMinutes) }}</span>
                                </span>
                                <span class="badge bg-light text-danger" id="clientAlertResolutionStaleWrapper" title="Oldest open alert age">
                                    Stale &gt; <span id="clientAlertResolutionThreshold" data-threshold="{{ $defaultThreshold }}">{{ $defaultThreshold }}</span>m:
                                    <span id="clientAlertResolutionStale">{{ $initialClientAlertStats['resolution']['stale_open']['count'] ?? 0 }}</span>
                                </span>
                            </div>
                            @php
                                $initialPercentiles = $initialClientAlertStats['resolution']['window']['percentiles'] ?? [];
                                $initialSlaThresholds = $initialClientAlertStats['resolution']['sla']['threshold_minutes'] ?? [];
                                $initialSlaBreaches = $initialClientAlertStats['resolution']['sla']['breaches'] ?? [];
                            @endphp
                            <div class="d-flex flex-wrap gap-2 align-items-center small mt-2" id="clientAlertPercentileStats">
                                <span class="badge bg-light text-secondary" title="90th percentile acknowledgement time">
                                    P90: <span id="clientAlertResolutionP90">{{ $formatMinutes($initialPercentiles['p90_minutes'] ?? null) }}</span>
                                </span>
                                <span class="badge bg-light text-secondary" title="99th percentile acknowledgement time">
                                    P99: <span id="clientAlertResolutionP99">{{ $formatMinutes($initialPercentiles['p99_minutes'] ?? null) }}</span>
                                </span>
                                <span class="badge bg-light text-muted" title="Sample size in the rolling 24h window">
                                    Samples: <span id="clientAlertResolutionSamples">{{ number_format($initialClientAlertStats['resolution']['window']['sample_size'] ?? 0) }}</span>
                                </span>
                            </div>
                            <div class="d-flex flex-wrap gap-2 align-items-center small mt-2" id="clientAlertSlaStats">
                                <span class="badge bg-light text-warning" id="clientAlertSlaWarningBadge">
                                    &gt; <span id="clientAlertSlaWarningThreshold">{{ $initialSlaThresholds['warning'] ?? 15 }}</span>m breaches:
                                    <span id="clientAlertSlaWarningCount">{{ $initialSlaBreaches['warning'] ?? 0 }}</span>
                                </span>
                                <span class="badge bg-light text-danger" id="clientAlertSlaCriticalBadge">
                                    &gt; <span id="clientAlertSlaCriticalThreshold">{{ $initialSlaThresholds['critical'] ?? 45 }}</span>m breaches:
                                    <span id="clientAlertSlaCriticalCount">{{ $initialSlaBreaches['critical'] ?? 0 }}</span>
                                </span>
                            </div>
                            <div class="alert alert-danger d-none mt-2" id="clientAlertResolutionAlert">
                                <i class="fas fa-bell-exclamation me-2"></i>
                                <span id="clientAlertResolutionAlertText">Resolution SLA breached</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush" id="clientAlertFeed">
                        @forelse(($clientAlerts ?? []) as $alert)
                            @php
                                $severity = $alert['severity'] ?? 'warning';
                                $badgeClasses = match ($severity) {
                                    'info' => 'badge bg-info text-dark',
                                    'error' => 'badge bg-danger',
                                    'critical' => 'badge bg-dark',
                                    default => 'badge bg-warning text-dark',
                                };
                                $received = isset($alert['received_at'])
                                    ? \Illuminate\Support\Carbon::parse($alert['received_at'])->diffForHumans()
                                    : 'just now';
                                $acknowledged = !empty($alert['acknowledged_at']);
                            @endphp
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center gap-2">
                                    <div class="d-flex gap-2 align-items-center">
                                        <span class="{{ $badgeClasses }}">{{ strtoupper($severity) }}</span>
                                        @if($acknowledged)
                                            <span class="badge bg-success">Acknowledged</span>
                                        @endif
                                    </div>
                                    <div class="d-flex gap-2 align-items-center">
                                        <small class="text-muted">{{ $received }}</small>
                                        <button class="btn btn-sm btn-outline-secondary" type="button" disabled>
                                            <i class="fas fa-check"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="fw-semibold mt-2">{{ $alert['message'] ?? 'No message provided' }}</div>
                                <div class="text-muted small">Source: {{ $alert['source'] ?? 'unknown' }}</div>
                            </div>
                        @empty
                            <div class="list-group-item text-center text-muted py-4">No recent client alerts.</div>
                        @endforelse
                    </div>
                </div>
                <div class="card-footer text-center bg-white border-0">
                    <button class="btn btn-outline-secondary btn-sm" type="button" id="clientAlertLoadMore" disabled>
                        Load more
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="card h-100">
                <div class="card-header bg-white d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0"><i class="fas fa-chart-line me-2" style="color:#10B981;"></i>Resolution Percentile Trend</h5>
                        <small class="text-muted">P90 vs P99 acknowledgement times</small>
                    </div>
                    <span class="badge bg-light text-muted" id="resolutionTrendWindowLabel"></span>
                </div>
                <div class="card-body">
                    <canvas id="resolutionTrendChart" height="120"></canvas>
                    <div class="text-muted small mt-2" id="resolutionTrendEmpty" style="display: none;">
                        Insufficient acknowledgement samples to compute percentile trend.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Cache Performance -->
    <div class="row g-3 mb-4">
        <div class="col-md-12">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-server me-2" style="color: #8B5CF6;"></i>Cache Performance</h5>
                </div>
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-md-3">
                            <div class="p-4" style="background: linear-gradient(135deg, #FFF5F8 0%, #FFE5EE 100%); border-radius: 15px;">
                                <h3 class="mb-2" style="color: #E91E8C;" id="cacheHitsMetric">{{ number_format($cacheMetrics['cache_hits'] ?? 0) }}</h3>
                                <p class="mb-0 text-muted">Cache Hits</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="p-4" style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 15px;">
                                <h3 class="mb-2" style="color: #8B5CF6;" id="cacheMissesMetric">{{ number_format($cacheMetrics['cache_misses'] ?? 0) }}</h3>
                                <p class="mb-0 text-muted">Cache Misses</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="p-4" style="background: linear-gradient(135deg, #FFF5F8 0%, #FFE5EE 100%); border-radius: 15px;">
                                <h3 class="mb-2" style="color: #E91E8C;" id="cacheSizeMetric">{{ $cacheMetrics['cache_size'] ?? 'N/A' }}</h3>
                                <p class="mb-0 text-muted">Cache Size</p>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="p-4" style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 15px;">
                                <h3 class="mb-2" style="color: #8B5CF6;" id="cacheKeysMetric">{{ number_format($cacheMetrics['cache_keys_count'] ?? 0) }}</h3>
                                <p class="mb-0 text-muted">Cached Keys</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- System Health Indicators -->
    <div class="row g-3">
        <div class="col-md-12">
            <div class="card">
                <div class="card-header bg-white">
                    <h5 class="mb-0"><i class="fas fa-heartbeat me-2" style="color: #10B981;"></i>System Health</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-3">
                            <div class="text-center p-3">
                                <div class="mb-2">
                                    <i class="fas fa-check-circle fa-3x" style="color: {{ ($cacheMetrics['cache_hit_rate'] ?? 0) > 70 ? '#10B981' : '#EF4444' }};"></i>
                                </div>
                                <h6>Cache System</h6>
                                <small class="text-muted">{{ ($cacheMetrics['cache_hit_rate'] ?? 0) > 70 ? 'Healthy' : 'Needs Attention' }}</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-3">
                                <div class="mb-2">
                                    <i class="fas fa-check-circle fa-3x" style="color: {{ ($errorData['error_rate'] ?? 0) < 5 ? '#10B981' : '#EF4444' }};"></i>
                                </div>
                                <h6>Error Rate</h6>
                                <small class="text-muted">{{ ($errorData['error_rate'] ?? 0) < 5 ? 'Excellent' : 'High' }}</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-3">
                                <div class="mb-2">
                                    <i class="fas fa-check-circle fa-3x" style="color: #10B981;"></i>
                                </div>
                                <h6>AI Services</h6>
                                <small class="text-muted">Operational</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="text-center p-3">
                                <div class="mb-2">
                                    <i class="fas fa-check-circle fa-3x" style="color: #10B981;"></i>
                                </div>
                                <h6>Rate Limiting</h6>
                                <small class="text-muted">Active</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
    const metricsEndpoint = '{{ route("admin.ai-analytics.metrics") }}';
    const numberFormatter = new Intl.NumberFormat('en-US');
    const alertEndpoint = '{{ route("admin.ai-analytics.alerts") }}';
    const alertHistoryEndpoint = '{{ route("admin.ai-analytics.alerts.history") }}';
    const alertAckBaseUrl = '{{ url("admin/ai-analytics/alerts") }}';
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const alertDispatchState = { lastSent: {} };
    const ALERT_THROTTLE_MS = 60000;
    const MAX_CLIENT_ALERTS = 200;
    const notificationState = { requested: false };
    const resolutionAlertState = {
        warningBreaches: 0,
        criticalBreaches: 0,
        staleCount: 0,
    };
    const resolutionTrendThresholds = {
        warning: null,
        critical: null,
    };
    const resolutionTrendPalette = {
        p90: {
            base: '#0ea5e9',
            warning: '#fbbf24',
            critical: '#ef4444',
        },
        p99: {
            base: '#f97316',
            warning: '#facc15',
            critical: '#ef4444',
        },
    };
    const initialClientAlerts = @json($clientAlerts ?? []);
    const initialClientAlertStats = @json($clientAlertStats ?? null);
    const initialResolutionStats = initialClientAlertStats?.resolution ?? null;
    const clientAlertState = {
        items: [],
        filters: {
            severity: 'all',
            hideAcknowledged: false,
        },
        pagination: {
            currentPage: 0,
            lastPage: 1,
            hasMore: true,
            perPage: 20,
        },
        loading: false,
        stats: initialClientAlertStats,
    };
    const cdnElements = {
        alertBanner: document.getElementById('cdnAlertBanner'),
        alertSummary: document.getElementById('cdnAlertSummary'),
        statusBadge: document.getElementById('cdnStatusBadge'),
        degradedBadge: document.getElementById('cdnDegradedBadge'),
        summaryText: document.getElementById('cdnSummaryText'),
        signalsContainer: document.getElementById('cdnSignalsContainer'),
        histogramList: document.getElementById('cdnHistogramList'),
        rollingLatency: document.getElementById('cdnRollingLatency'),
        probeRatio: document.getElementById('cdnProbeRatio'),
        failureStreak: document.getElementById('cdnFailureStreak'),
        sampleCount: document.getElementById('cdnSampleCount'),
        lastSampleAge: document.getElementById('cdnLastSampleAge'),
        lastProbeCode: document.getElementById('cdnLastProbeCode'),
        lastProbeAttempts: document.getElementById('cdnLastProbeAttempts'),
        staleFlag: document.getElementById('cdnStaleFlag')
    };

    function setResolutionTrendThresholds(warning, critical) {
        const warningValue = Number(warning);
        const criticalValue = Number(critical);
        resolutionTrendThresholds.warning = Number.isFinite(warningValue) ? warningValue : null;
        resolutionTrendThresholds.critical = Number.isFinite(criticalValue) ? criticalValue : null;
    }

    function deriveTrendSeverity(value) {
        if (value === null || value === undefined) {
            return 'base';
        }

        if (resolutionTrendThresholds.critical !== null && value >= resolutionTrendThresholds.critical) {
            return 'critical';
        }

        if (resolutionTrendThresholds.warning !== null && value >= resolutionTrendThresholds.warning) {
            return 'warning';
        }

        return 'base';
    }

    function getTrendColor(datasetKey, value, alpha = 1) {
        const palette = resolutionTrendPalette[datasetKey] || resolutionTrendPalette.p90;
        const severity = deriveTrendSeverity(value);
        const color = palette[severity] || palette.base;
        return alpha === 1 ? color : hexToRgba(color, alpha);
    }

    function hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') {
            return hex;
        }

        const normalized = hex.replace('#', '');
        if (normalized.length !== 6) {
            return hex;
        }

        const r = parseInt(normalized.substring(0, 2), 16);
        const g = parseInt(normalized.substring(2, 4), 16);
        const b = parseInt(normalized.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const lastUpdateState = {
        pill: document.getElementById('dashboardLastUpdatePill'),
        text: document.getElementById('dashboardLastUpdateText'),
        timestamp: null,
        staleThresholdMs: 45000,
    };

    const metricsFetchAlert = {
        container: document.getElementById('metricsFetchAlert'),
        message: document.getElementById('metricsFetchMessage')
    };

    const dashboardElements = {
        aiRequestsToday: document.getElementById('aiRequestsToday'),
        aiTotalRequests: document.getElementById('aiTotalRequests'),
        cacheHitRate: document.getElementById('cacheHitRate'),
        cacheHitsLabel: document.getElementById('cacheHitsLabel'),
        activeUsersToday: document.getElementById('activeUsersToday'),
        activeUsersWeek: document.getElementById('activeUsersWeek'),
        errorRate: document.getElementById('errorRate'),
        errorsTodayLabel: document.getElementById('errorsTodayLabel'),
        errorSummaryToday: document.getElementById('errorSummaryToday'),
        errorSummaryWeek: document.getElementById('errorSummaryWeek'),
        errorSummaryTotal: document.getElementById('errorSummaryTotal'),
        errorList: document.getElementById('errorList'),
        cacheHitsMetric: document.getElementById('cacheHitsMetric'),
        cacheMissesMetric: document.getElementById('cacheMissesMetric'),
        cacheSizeMetric: document.getElementById('cacheSizeMetric'),
        cacheKeysMetric: document.getElementById('cacheKeysMetric'),
        featureUsageBody: document.getElementById('featureUsageBody'),
        clientAlertFeed: document.getElementById('clientAlertFeed'),
        clientAlertCount: document.getElementById('clientAlertCount'),
        clientAlertSeverity: document.getElementById('clientAlertSeverityFilter'),
        clientAlertHideAck: document.getElementById('clientAlertHideAck'),
        clientAlertRefresh: document.getElementById('clientAlertRefresh'),
        clientAlertLoadMore: document.getElementById('clientAlertLoadMore'),
        clientAlertStats: {
            severity: {
                critical: document.getElementById('clientAlertStatCritical'),
                error: document.getElementById('clientAlertStatError'),
                warning: document.getElementById('clientAlertStatWarning'),
                info: document.getElementById('clientAlertStatInfo'),
            },
            acknowledgement: {
                open: document.getElementById('clientAlertStatOpen'),
                acknowledged: document.getElementById('clientAlertStatAcknowledged'),
            },
            trend: {
                current: document.getElementById('clientAlertTrendCurrent'),
                previous: document.getElementById('clientAlertTrendPrevious'),
                delta: document.getElementById('clientAlertTrendDelta'),
                deltaLabel: document.getElementById('clientAlertTrendDeltaLabel'),
            },
            resolution: {
                average: document.getElementById('clientAlertResolutionAverage'),
                max: document.getElementById('clientAlertResolutionMax'),
                staleCount: document.getElementById('clientAlertResolutionStale'),
                threshold: document.getElementById('clientAlertResolutionThreshold'),
                staleWrapper: document.getElementById('clientAlertResolutionStaleWrapper'),
                p90: document.getElementById('clientAlertResolutionP90'),
                p99: document.getElementById('clientAlertResolutionP99'),
                samples: document.getElementById('clientAlertResolutionSamples'),
                sla: {
                    warning: {
                        badge: document.getElementById('clientAlertSlaWarningBadge'),
                        threshold: document.getElementById('clientAlertSlaWarningThreshold'),
                        count: document.getElementById('clientAlertSlaWarningCount'),
                    },
                    critical: {
                        badge: document.getElementById('clientAlertSlaCriticalBadge'),
                        threshold: document.getElementById('clientAlertSlaCriticalThreshold'),
                        count: document.getElementById('clientAlertSlaCriticalCount'),
                    }
                }
            }
        }
    };

    dashboardElements.resolutionTrend = {
        windowLabel: document.getElementById('resolutionTrendWindowLabel'),
        emptyState: document.getElementById('resolutionTrendEmpty'),
    };

    let resolutionTrendChart = null;

    dashboardElements.clientAlertResolutionAlert = {
        container: document.getElementById('clientAlertResolutionAlert'),
        text: document.getElementById('clientAlertResolutionAlertText')
    };

    if (dashboardElements.clientAlertSeverity) {
        dashboardElements.clientAlertSeverity.addEventListener('change', event => {
            clientAlertState.filters.severity = event.target.value || 'all';
            renderClientAlertList();
            fetchClientAlerts({ reset: true });
        });
    }

    if (dashboardElements.clientAlertHideAck) {
        dashboardElements.clientAlertHideAck.addEventListener('change', event => {
            clientAlertState.filters.hideAcknowledged = Boolean(event.target.checked);
            renderClientAlertList();
            fetchClientAlerts({ reset: true });
        });
    }

    if (dashboardElements.clientAlertRefresh) {
        dashboardElements.clientAlertRefresh.addEventListener('click', () => fetchClientAlerts({ reset: true }));
    }

    if (dashboardElements.clientAlertLoadMore) {
        dashboardElements.clientAlertLoadMore.addEventListener('click', () => fetchClientAlerts());
    }

    function formatPercent(value) {
        if (typeof value !== 'number') {
            return '—';
        }
        return `${(value * 100).toFixed(1)}%`;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            return value;
        }

        return numberFormatter.format(numeric);
    }

    function formatMinutesLabel(value) {
        if (value === null || value === undefined) {
            return '—';
        }

        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            return `${value}m`;
        }

        const rounded = Math.round(numeric * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}m` : `${rounded.toFixed(1)}m`;
    }

    function formatLatency(value) {
        if (!value && value !== 0) {
            return '—';
        }
        return `${value} ms`;
    }

    function renderClientAlertList() {
        if (!dashboardElements.clientAlertFeed) {
            return;
        }

        const entries = getFilteredClientAlerts();

        if (dashboardElements.clientAlertCount) {
            dashboardElements.clientAlertCount.textContent = `${clientAlertState.items.length} tracked`;
        }

        if (!entries.length) {
            dashboardElements.clientAlertFeed.innerHTML = '<div class="list-group-item text-center text-muted py-4">No client alerts match the selected filters.</div>';
            updateClientAlertControls();
            updateClientAlertStatsDisplay();
            return;
        }

        dashboardElements.clientAlertFeed.innerHTML = entries.map(alert => {
            const severity = (alert.severity || 'warning').toLowerCase();
            const badgeClass = getSeverityBadgeClasses(severity);
            const timestamp = formatRelativeTimestamp(alert.received_at);
            const message = alert.message || 'No message provided';
            const source = alert.source || 'unknown';
            const acknowledged = Boolean(alert.acknowledged_at);
            const ackLabel = acknowledged ? 'Acknowledged' : 'Acknowledge';
            const ackButtonClass = acknowledged ? 'btn-success' : 'btn-outline-secondary';
            const ackDisabled = acknowledged ? 'disabled' : '';

            return `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <div class="d-flex gap-2 align-items-center">
                            <span class="${badgeClass}">${severity.toUpperCase()}</span>
                            ${acknowledged ? '<span class="badge bg-success">Acknowledged</span>' : ''}
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                            <small class="text-muted">${timestamp}</small>
                            <button class="btn btn-sm ${ackButtonClass}" ${ackDisabled} onclick="acknowledgeClientAlert(${alert.id})">
                                <i class="fas fa-check"></i> ${ackLabel}
                            </button>
                        </div>
                    </div>
                    <div class="fw-semibold mt-2">${message}</div>
                    <div class="text-muted small">Source: ${source}</div>
                </div>
            `;
        }).join('');

        updateClientAlertControls();
        updateClientAlertStatsDisplay();
    }

    function getFilteredClientAlerts() {
        const severityFilter = clientAlertState.filters.severity;
        const hideAcknowledged = clientAlertState.filters.hideAcknowledged;

        return clientAlertState.items.filter(alert => {
            const severity = (alert.severity || 'warning').toLowerCase();
            const acknowledged = Boolean(alert.acknowledged_at);

            const matchesSeverity = severityFilter === 'all' || severity === severityFilter;
            const matchesAck = hideAcknowledged ? !acknowledged : true;

            return matchesSeverity && matchesAck;
        });
    }

    function setClientAlerts(alerts, { reset = true, silent = false } = {}) {
        if (reset) {
            clientAlertState.items = [];
        }

        const entries = Array.isArray(alerts) ? alerts : [];
        entries.forEach(alert => insertOrUpdateAlert(clientAlertState.items, alert));
        clientAlertState.items.sort(sortAlertsByMostRecent);
        clientAlertState.items = clientAlertState.items.slice(0, MAX_CLIENT_ALERTS);

        if (!silent) {
            renderClientAlertList();
        }
    }

    function mergeClientAlert(alert) {
        if (!alert || !alert.id) {
            return;
        }

        insertOrUpdateAlert(clientAlertState.items, alert);
        clientAlertState.items.sort(sortAlertsByMostRecent);
        clientAlertState.items = clientAlertState.items.slice(0, MAX_CLIENT_ALERTS);
        renderClientAlertList();
    }

    function insertOrUpdateAlert(collection, alert) {
        const index = collection.findIndex(item => item.id === alert.id);
        if (index >= 0) {
            collection[index] = alert;
        } else {
            collection.push(alert);
        }
    }

    function sortAlertsByMostRecent(a, b) {
        const getTime = entry => Date.parse(entry?.received_at || entry?.created_at || Date.now());
        const aTime = getTime(a);
        const bTime = getTime(b);
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
            return 0;
        }
        if (Number.isNaN(aTime)) {
            return 1;
        }
        if (Number.isNaN(bTime)) {
            return -1;
        }
        return bTime - aTime;
    }

    function updateClientAlertControls() {
        if (dashboardElements.clientAlertLoadMore) {
            if (clientAlertState.loading) {
                dashboardElements.clientAlertLoadMore.textContent = 'Loading…';
                dashboardElements.clientAlertLoadMore.disabled = true;
            } else if (!clientAlertState.pagination.hasMore) {
                dashboardElements.clientAlertLoadMore.textContent = 'No more results';
                dashboardElements.clientAlertLoadMore.disabled = true;
            } else {
                dashboardElements.clientAlertLoadMore.textContent = 'Load more';
                dashboardElements.clientAlertLoadMore.disabled = false;
            }
        }

        if (dashboardElements.clientAlertRefresh) {
            dashboardElements.clientAlertRefresh.disabled = clientAlertState.loading;
        }
    }

    function computeClientAlertStatsFallback() {
        const stats = {
            severity: {
                critical: 0,
                error: 0,
                warning: 0,
                info: 0,
            },
            acknowledgement: {
                open: 0,
                acknowledged: 0,
            },
            trend: null,
            resolution: null,
        };

        clientAlertState.items.forEach(alert => {
            const severity = (alert.severity || 'warning').toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(stats.severity, severity)) {
                stats.severity[severity] = 0;
            }
            stats.severity[severity] += 1;

            if (alert.acknowledged_at) {
                stats.acknowledgement.acknowledged += 1;
            } else {
                stats.acknowledgement.open += 1;
            }
        });

        return stats;
    }

    function updateClientAlertStatsDisplay() {
        const statRefs = dashboardElements.clientAlertStats;
        if (!statRefs) {
            return;
        }

        const stats = clientAlertState.stats || computeClientAlertStatsFallback();

        if (statRefs.severity && stats?.severity) {
            Object.entries(stats.severity).forEach(([level, count]) => {
                if (statRefs.severity[level]) {
                    statRefs.severity[level].textContent = count;
                }
            });
        }

        if (statRefs.acknowledgement && stats?.acknowledgement) {
            if (statRefs.acknowledgement.open) {
                statRefs.acknowledgement.open.textContent = stats.acknowledgement.open ?? 0;
            }
            if (statRefs.acknowledgement.acknowledged) {
                statRefs.acknowledgement.acknowledged.textContent = stats.acknowledgement.acknowledged ?? 0;
            }
        }

        updateClientAlertTrendDisplay(stats?.trend?.window);
        updateClientAlertResolutionDisplay(stats?.resolution);
    }

    function updateClientAlertTrendDisplay(trendWindow) {
        const trendRefs = dashboardElements.clientAlertStats?.trend;
        if (!trendRefs) {
            return;
        }

        if (!trendWindow) {
            if (trendRefs.current) {
                trendRefs.current.textContent = '—';
            }
            if (trendRefs.previous) {
                trendRefs.previous.textContent = '—';
            }
            if (trendRefs.deltaLabel) {
                trendRefs.deltaLabel.textContent = '0%';
            }
            if (trendRefs.delta) {
                trendRefs.delta.classList.remove('bg-success', 'bg-danger', 'bg-light', 'text-dark', 'text-white');
                trendRefs.delta.classList.add('bg-light', 'text-dark');
            }
            return;
        }

        if (trendRefs.current) {
            trendRefs.current.textContent = trendWindow.current ?? 0;
        }
        if (trendRefs.previous) {
            trendRefs.previous.textContent = trendWindow.previous ?? 0;
        }
        if (trendRefs.deltaLabel) {
            const delta = Number(trendWindow.change_pct ?? 0);
            const symbol = delta > 0 ? '+' : '';
            trendRefs.deltaLabel.textContent = `${symbol}${delta}%`;
        }
        if (trendRefs.delta) {
            const delta = Number(trendWindow.change_pct ?? 0);
            trendRefs.delta.classList.remove('bg-success', 'bg-danger', 'bg-light', 'text-dark', 'text-white');
            if (delta > 0) {
                trendRefs.delta.classList.add('bg-success', 'text-white');
            } else if (delta < 0) {
                trendRefs.delta.classList.add('bg-danger', 'text-white');
            } else {
                trendRefs.delta.classList.add('bg-light', 'text-dark');
            }
        }
    }

    function updateClientAlertResolutionDisplay(resolutionStats) {
        const resolutionRefs = dashboardElements.clientAlertStats?.resolution;
        if (!resolutionRefs) {
            return;
        }

        const windowStats = resolutionStats?.window;
        const averageBadge = resolutionRefs.average?.closest('.badge');
        const maxBadge = resolutionRefs.max?.closest('.badge');

        if (!windowStats) {
            if (resolutionRefs.average) {
                resolutionRefs.average.textContent = '—';
                averageBadge?.setAttribute('title', 'Awaiting acknowledgement samples');
            }
            if (resolutionRefs.max) {
                resolutionRefs.max.textContent = '—';
                maxBadge?.setAttribute('title', 'Awaiting acknowledgement samples');
            }
        } else {
            if (resolutionRefs.average) {
                resolutionRefs.average.textContent = formatMinutesLabel(windowStats.average_minutes);
                const sampleSize = windowStats.sample_size ?? 0;
                averageBadge?.setAttribute('title', `Average acknowledgement across ${formatNumber(sampleSize)} sample${sampleSize === 1 ? '' : 's'}`);
            }
            if (resolutionRefs.max) {
                resolutionRefs.max.textContent = formatMinutesLabel(windowStats.max_minutes);
                maxBadge?.setAttribute('title', 'Slowest acknowledgement in the last 24h sample');
            }
            if (resolutionRefs.samples) {
                resolutionRefs.samples.textContent = formatNumber(windowStats.sample_size ?? 0);
            }
            if (resolutionRefs.p90) {
                resolutionRefs.p90.textContent = formatMinutesLabel(windowStats.percentiles?.p90_minutes);
            }
            if (resolutionRefs.p99) {
                resolutionRefs.p99.textContent = formatMinutesLabel(windowStats.percentiles?.p99_minutes);
            }
        }

        const staleStats = resolutionStats?.stale_open ?? resolutionStats?.staleOpen;
        const thresholdMinutes = staleStats?.threshold_minutes ?? staleStats?.thresholdMinutes;
        if (resolutionRefs.threshold) {
            const fallbackThreshold = Number(resolutionRefs.threshold.dataset.threshold || 60);
            const appliedThreshold = thresholdMinutes ?? fallbackThreshold;
            resolutionRefs.threshold.textContent = appliedThreshold;
            resolutionRefs.threshold.dataset.threshold = appliedThreshold;
        }

        if (resolutionRefs.staleCount) {
            resolutionRefs.staleCount.textContent = formatNumber(staleStats?.count ?? staleStats?.total ?? 0);
            const staleBadge = resolutionRefs.staleWrapper;
            if (staleBadge) {
                toggleBreachBadge(staleBadge, (staleStats?.count ?? 0) > 0, 'danger');
            }
        }

        if (resolutionRefs.staleWrapper) {
            const oldestMinutes = staleStats?.oldest_open_minutes ?? staleStats?.oldestOpenMinutes;
            const title = oldestMinutes !== null && oldestMinutes !== undefined
                ? `Oldest open alert age: ${formatMinutesLabel(oldestMinutes)}`
                : 'Oldest open alert age unavailable';
            resolutionRefs.staleWrapper.setAttribute('title', title);
        }

        const slaStats = resolutionStats?.sla;
        updateSlaBadge(resolutionRefs.sla?.warning, slaStats?.threshold_minutes?.warning, slaStats?.breaches?.warning, 'warning');
        updateSlaBadge(resolutionRefs.sla?.critical, slaStats?.threshold_minutes?.critical, slaStats?.breaches?.critical, 'critical');

        updateClientAlertResolutionAlert(slaStats, staleStats);
        handleResolutionNotifications(resolutionStats);
        updateResolutionTrendChart(resolutionStats);
    }

    function updateSlaBadge(refGroup, threshold, count, severity) {
        if (!refGroup?.badge) {
            return;
        }

        if (refGroup.threshold) {
            refGroup.threshold.textContent = threshold ?? '—';
        }

        if (refGroup.count) {
            refGroup.count.textContent = formatNumber(count ?? 0);
        }

        const hasBreach = (count ?? 0) > 0;
        toggleBreachBadge(refGroup.badge, hasBreach, severity === 'critical' ? 'danger' : 'warning');
    }

    function toggleBreachBadge(element, isBreached, severityClass) {
        if (!element) {
            return;
        }

        element.classList.remove('bg-light', 'bg-warning', 'bg-danger', 'text-warning', 'text-danger', 'text-primary', 'text-white');

        if (isBreached) {
            const bgClass = severityClass === 'danger' ? 'bg-danger' : 'bg-warning';
            element.classList.add(bgClass, 'text-white');
        } else {
            element.classList.add('bg-light');
            element.classList.add(severityClass === 'danger' ? 'text-danger' : 'text-warning');
        }
    }

    function updateClientAlertResolutionAlert(slaStats, staleStats) {
        const alertRefs = dashboardElements.clientAlertResolutionAlert;
        if (!alertRefs?.container) {
            return;
        }

        const warningBreaches = slaStats?.breaches?.warning ?? 0;
        const criticalBreaches = slaStats?.breaches?.critical ?? 0;
        const staleCount = staleStats?.count ?? 0;

        const messages = [];
        if (criticalBreaches > 0) {
            const threshold = slaStats?.threshold_minutes?.critical ?? 45;
            messages.push(`${formatNumber(criticalBreaches)} critical SLA breach${criticalBreaches === 1 ? '' : 'es'} (>${threshold}m)`);
        }
        if (warningBreaches > 0) {
            const threshold = slaStats?.threshold_minutes?.warning ?? 15;
            messages.push(`${formatNumber(warningBreaches)} warning breach${warningBreaches === 1 ? '' : 'es'} (>${threshold}m)`);
        }
        if (staleCount > 0) {
            messages.push(`${formatNumber(staleCount)} stale alert${staleCount === 1 ? '' : 's'} beyond cache window`);
        }

        if (!messages.length) {
            alertRefs.container.classList.add('d-none');
            return;
        }

        alertRefs.container.classList.remove('d-none');
        if (alertRefs.text) {
            alertRefs.text.textContent = messages.join(' • ');
        }
    }

    function handleResolutionNotifications(resolutionStats) {
        if (!resolutionStats) {
            return;
        }

        const slaBreaches = resolutionStats.sla?.breaches || {};
        const warningBreaches = slaBreaches.warning ?? 0;
        const criticalBreaches = slaBreaches.critical ?? 0;
        const staleCount = resolutionStats.stale_open?.count ?? resolutionStats.staleOpen?.count ?? 0;

        if (criticalBreaches > resolutionAlertState.criticalBreaches) {
            emitClientAlert({
                source: 'ai-analytics.dashboard.sla',
                severity: 'critical',
                message: `${formatNumber(criticalBreaches)} client alerts breached the critical SLA threshold`,
                context: {
                    threshold_minutes: resolutionStats.sla?.threshold_minutes?.critical ?? 45,
                    breaches: criticalBreaches,
                }
            });
        }

        if (warningBreaches > resolutionAlertState.warningBreaches) {
            emitClientAlert({
                source: 'ai-analytics.dashboard.sla',
                severity: 'warning',
                message: `${formatNumber(warningBreaches)} client alerts exceeded the warning SLA threshold`,
                context: {
                    threshold_minutes: resolutionStats.sla?.threshold_minutes?.warning ?? 15,
                    breaches: warningBreaches,
                }
            });
        }

        if (staleCount > resolutionAlertState.staleCount) {
            emitClientAlert({
                source: 'ai-analytics.dashboard.sla',
                severity: 'warning',
                message: `${formatNumber(staleCount)} client alerts are stale beyond ${resolutionStats.stale_open?.threshold_minutes ?? 60} minutes`,
                context: {
                    stale_count: staleCount,
                }
            });
        }

        resolutionAlertState.warningBreaches = warningBreaches;
        resolutionAlertState.criticalBreaches = criticalBreaches;
        resolutionAlertState.staleCount = staleCount;
    }

    function updateResolutionTrendChart(resolutionData) {
        const resolutionStats = Array.isArray(resolutionData)
            ? { trend_series: resolutionData }
            : (resolutionData ?? null);

        const dataSeries = Array.isArray(resolutionStats?.trend_series)
            ? resolutionStats.trend_series
            : [];

        if (!resolutionTrendChart) {
            toggleResolutionTrendEmpty(!dataSeries.length);
            updateResolutionTrendWindowLabel(dataSeries);
            return;
        }

        if (!dataSeries.length) {
            resolutionTrendChart.data.labels = [];
            resolutionTrendChart.data.datasets.forEach(dataset => { dataset.data = []; });
            resolutionTrendChart.update('none');
            toggleResolutionTrendEmpty(true);
            updateResolutionTrendWindowLabel(null);
            return;
        }

        const warningThreshold = resolutionStats?.sla?.threshold_minutes?.warning
            ?? resolutionStats?.sla?.thresholdMinutes?.warning
            ?? null;
        const criticalThreshold = resolutionStats?.sla?.threshold_minutes?.critical
            ?? resolutionStats?.sla?.thresholdMinutes?.critical
            ?? null;

        setResolutionTrendThresholds(warningThreshold, criticalThreshold);

        const buildThresholdSeries = (threshold) => {
            if (threshold === null || threshold === undefined) {
                return dataSeries.map(() => null);
            }
            return dataSeries.map(() => threshold);
        };

        resolutionTrendChart.data.labels = dataSeries.map(point => formatTrendLabel(point));
        const p90Series = dataSeries.map(point => point.p90_minutes ?? null);
        const p99Series = dataSeries.map(point => point.p99_minutes ?? null);
        const warningSeries = buildThresholdSeries(warningThreshold);
        const criticalSeries = buildThresholdSeries(criticalThreshold);

        if (resolutionTrendChart.data.datasets[0]) {
            resolutionTrendChart.data.datasets[0].data = p90Series;
        }
        if (resolutionTrendChart.data.datasets[1]) {
            resolutionTrendChart.data.datasets[1].data = p99Series;
        }
        if (resolutionTrendChart.data.datasets[2]) {
            resolutionTrendChart.data.datasets[2].data = warningSeries;
        }
        if (resolutionTrendChart.data.datasets[3]) {
            resolutionTrendChart.data.datasets[3].data = criticalSeries;
        }

        resolutionTrendChart.update('none');
        toggleResolutionTrendEmpty(false);
        updateResolutionTrendWindowLabel(dataSeries);
    }

    function toggleResolutionTrendEmpty(isEmpty) {
        const emptyState = dashboardElements.resolutionTrend?.emptyState;
        if (!emptyState) {
            return;
        }
        emptyState.style.display = isEmpty ? 'block' : 'none';
    }

    function updateResolutionTrendWindowLabel(series) {
        const labelEl = dashboardElements.resolutionTrend?.windowLabel;
        if (!labelEl) {
            return;
        }

        if (!Array.isArray(series) || !series.length) {
            labelEl.textContent = '';
            return;
        }

        const firstWindow = series[0];
        const lastWindow = series[series.length - 1];
        const formatTime = value => {
            if (!value) {
                return '';
            }
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const startLabel = formatTime(firstWindow.start);
        const endLabel = formatTime(lastWindow.end);
        labelEl.textContent = startLabel && endLabel ? `${startLabel} – ${endLabel}` : '';
    }

    function formatTrendLabel(point) {
        if (point?.label) {
            return point.label;
        }

        if (point?.end) {
            const date = new Date(point.end);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }

        return '';
    }

    function setClientAlertStats(stats) {
        if (!stats) {
            return;
        }

        const mergedStats = {
            severity: {
                critical: 0,
                error: 0,
                warning: 0,
                info: 0,
                ...(stats.severity || {}),
            },
            acknowledgement: {
                open: 0,
                acknowledged: 0,
                ...(stats.acknowledgement || {}),
            },
            trend: stats.trend || null,
            resolution: stats.resolution || null,
        };

        clientAlertState.stats = mergedStats;
        updateClientAlertStatsDisplay();
    }

    async function fetchClientAlerts({ reset = false } = {}) {
        if (!alertHistoryEndpoint) {
            return;
        }

        if (clientAlertState.loading && !reset) {
            return;
        }

        if (reset) {
            clientAlertState.pagination.currentPage = 0;
            clientAlertState.pagination.lastPage = 1;
            clientAlertState.pagination.hasMore = true;
        }

        const targetPage = reset ? 1 : clientAlertState.pagination.currentPage + 1;
        if (!reset && !clientAlertState.pagination.hasMore) {
            updateClientAlertControls();
            return;
        }

        clientAlertState.loading = true;
        updateClientAlertControls();

        const params = new URLSearchParams({
            per_page: clientAlertState.pagination.perPage,
            page: targetPage,
        });

        if (clientAlertState.filters.severity !== 'all') {
            params.set('severity', clientAlertState.filters.severity);
        }

        if (clientAlertState.filters.hideAcknowledged) {
            params.set('acknowledged', 'false');
        }

        try {
            const response = await fetch(`${alertHistoryEndpoint}?${params.toString()}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`History request failed (${response.status})`);
            }

            const payload = await response.json();
            const alerts = payload?.data ?? [];
            setClientAlerts(alerts, { reset });

            const meta = payload?.meta || {};
            clientAlertState.pagination.currentPage = meta.current_page ?? targetPage;
            clientAlertState.pagination.lastPage = meta.last_page ?? meta.current_page ?? targetPage;
            clientAlertState.pagination.perPage = meta.per_page ?? clientAlertState.pagination.perPage;
            clientAlertState.pagination.hasMore = clientAlertState.pagination.currentPage < clientAlertState.pagination.lastPage;
        } catch (error) {
            console.error('Failed to fetch alert history:', error);
            emitClientAlert({
                source: 'ai-analytics.dashboard.alert-history',
                severity: 'warning',
                message: 'Unable to load full alert history. Please retry shortly.',
                context: { error: String(error) }
            });
        } finally {
            clientAlertState.loading = false;
            updateClientAlertControls();
        }
    }

    function acknowledgeClientAlert(alertId) {
        if (!alertAckBaseUrl || !alertId) {
            return;
        }

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }

        fetch(`${alertAckBaseUrl}/${alertId}/acknowledge`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Acknowledge request failed (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                if (data?.alert) {
                    mergeClientAlert(data.alert);
                }
            })
            .catch(error => {
                console.error('Failed to acknowledge alert:', error);
                emitClientAlert({
                    source: 'ai-analytics.dashboard.ack',
                    severity: 'error',
                    message: 'Unable to acknowledge alert. Please retry.',
                    context: { error: String(error), alertId }
                });
            });
    }

    function getSeverityBadgeClasses(severity) {
        switch (severity) {
            case 'info':
                return 'badge bg-info text-dark';
            case 'error':
                return 'badge bg-danger';
            case 'critical':
                return 'badge bg-dark';
            default:
                return 'badge bg-warning text-dark';
        }
    }

    function setMetricsFetchError(message = null) {
        if (!metricsFetchAlert.container) {
            return;
        }

        if (!message) {
            metricsFetchAlert.container.classList.add('d-none');
            return;
        }

        metricsFetchAlert.container.classList.remove('d-none');
        if (metricsFetchAlert.message) {
            metricsFetchAlert.message.textContent = message;
        }
    }

    function formatRelativeDuration(milliseconds) {
        const seconds = Math.max(0, Math.floor(milliseconds / 1000));

        if (seconds < 1) {
            return 'just now';
        }

        if (seconds < 60) {
            return `${seconds}s ago`;
        }

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            const remainingSeconds = seconds % 60;
            return remainingSeconds ? `${minutes}m ${remainingSeconds}s ago` : `${minutes}m ago`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
    }

    function formatRelativeTimestamp(timestamp) {
        if (!timestamp) {
            return 'just now';
        }

        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) {
            return 'just now';
        }

        return formatRelativeDuration(Date.now() - parsed.getTime());
    }

    function refreshDashboardLastUpdate() {
        if (!lastUpdateState.text || !lastUpdateState.pill) {
            return;
        }

        if (!lastUpdateState.timestamp) {
            lastUpdateState.text.textContent = 'Awaiting latest metrics…';
            lastUpdateState.pill.classList.remove('stale');
            return;
        }

        const diff = Date.now() - lastUpdateState.timestamp.getTime();
        lastUpdateState.text.textContent = `Last update ${formatRelativeDuration(diff)}`;
        lastUpdateState.pill.classList.toggle('stale', diff > lastUpdateState.staleThresholdMs);
    }

    function setDashboardLastUpdateTimestamp(timestamp) {
        if (!lastUpdateState.text) {
            return;
        }

        if (!timestamp && timestamp !== 0) {
            lastUpdateState.timestamp = new Date();
        } else {
            const parsed = new Date(timestamp);
            lastUpdateState.timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        }

        refreshDashboardLastUpdate();
    }

    function notifyBrowser(body) {
        if (typeof Notification === 'undefined') {
            return;
        }

        if (Notification.permission === 'granted') {
            new Notification('AI Analytics Alert', { body });
            return;
        }

        if (Notification.permission === 'default' && !notificationState.requested) {
            notificationState.requested = true;
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('AI Analytics Alert', { body });
                }
            }).catch(() => {});
        }
    }

    function sendAlertToServer(payload) {
        if (!alertEndpoint) {
            return;
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }

        fetch(alertEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(error => console.error('Failed to log client alert:', error));
    }

    function emitClientAlert({ source, severity = 'warning', message, context = {} }) {
        if (!source || !message) {
            return;
        }

        const key = `${source}:${severity}`;
        const now = Date.now();
        if (alertDispatchState.lastSent[key] && (now - alertDispatchState.lastSent[key]) < ALERT_THROTTLE_MS) {
            return;
        }

        alertDispatchState.lastSent[key] = now;

        notifyBrowser(message);
        sendAlertToServer({
            source,
            severity,
            message,
            context,
            occurred_at: new Date().toISOString(),
        });
    }

    function getMetricPayload(data, keys) {
        for (const key of keys) {
            if (data && Object.prototype.hasOwnProperty.call(data, key)) {
                return data[key];
            }
        }

        return undefined;
    }

    function updateStatsCards(stats = {}) {
        if (!stats) {
            return;
        }

        const todayRequests = stats.today_requests ?? stats.todayRequests;
        const totalRequests = stats.total_requests ?? stats.totalRequests;
        const uniqueUsersToday = stats.unique_users_today ?? stats.uniqueUsersToday;
        const uniqueUsersWeek = stats.unique_users_this_week ?? stats.uniqueUsersThisWeek;

        if (dashboardElements.aiRequestsToday && todayRequests !== undefined) {
            dashboardElements.aiRequestsToday.textContent = formatNumber(todayRequests);
        }

        if (dashboardElements.aiTotalRequests && totalRequests !== undefined) {
            dashboardElements.aiTotalRequests.textContent = `Total: ${formatNumber(totalRequests)}`;
        }

        if (dashboardElements.activeUsersToday && uniqueUsersToday !== undefined) {
            dashboardElements.activeUsersToday.textContent = formatNumber(uniqueUsersToday);
        }

        if (dashboardElements.activeUsersWeek && uniqueUsersWeek !== undefined) {
            dashboardElements.activeUsersWeek.textContent = `This week: ${formatNumber(uniqueUsersWeek)}`;
        }
    }

    function normalizeRealtimeStats(realtimeRequests = {}) {
        return {
            today_requests: realtimeRequests.today,
            total_requests: realtimeRequests.total,
            unique_users_today: realtimeRequests.active_users,
            unique_users_this_week: undefined,
        };
    }

    function normalizeRealtimeCache(realtimeCache = {}) {
        return {
            cache_hit_rate: realtimeCache.hit_rate,
            cache_hits: realtimeCache.hits,
            cache_misses: realtimeCache.misses,
            cache_size: realtimeCache.size,
            cache_keys_count: realtimeCache.keys,
        };
    }

    function normalizeRealtimeErrors(realtimeErrors = {}) {
        return {
            error_rate: realtimeErrors.rate,
            today_errors: realtimeErrors.count,
            this_week_errors: realtimeErrors.week,
            total_errors: realtimeErrors.total,
            most_common_errors: realtimeErrors.recent_errors ?? [],
        };
    }

    function updateCacheMetrics(metrics = {}) {
        if (!metrics) {
            return;
        }

        const hitRate = metrics.cache_hit_rate ?? metrics.hit_rate ?? metrics.cacheHitRate;
        const hits = metrics.cache_hits ?? metrics.hits;
        const misses = metrics.cache_misses ?? metrics.misses;
        const cacheSize = metrics.cache_size ?? metrics.size;
        const cacheKeys = metrics.cache_keys_count ?? metrics.cacheKeysCount;

        if (dashboardElements.cacheHitRate && hitRate !== undefined) {
            const numeric = Number(hitRate);
            const label = Number.isNaN(numeric) ? hitRate : `${numeric}%`;
            dashboardElements.cacheHitRate.textContent = label;
        }

        if (dashboardElements.cacheHitsLabel && hits !== undefined) {
            dashboardElements.cacheHitsLabel.textContent = `${formatNumber(hits)} hits`;
        }

        if (dashboardElements.cacheHitsMetric && hits !== undefined) {
            dashboardElements.cacheHitsMetric.textContent = formatNumber(hits);
        }

        if (dashboardElements.cacheMissesMetric && misses !== undefined) {
            dashboardElements.cacheMissesMetric.textContent = formatNumber(misses);
        }

        if (dashboardElements.cacheSizeMetric && cacheSize !== undefined) {
            dashboardElements.cacheSizeMetric.textContent = typeof cacheSize === 'string'
                ? cacheSize
                : `${formatNumber(cacheSize)} MB`;
        }

        if (dashboardElements.cacheKeysMetric && cacheKeys !== undefined) {
            dashboardElements.cacheKeysMetric.textContent = formatNumber(cacheKeys);
        }
    }

    function updateErrorMetrics(errorData = {}) {
        if (!errorData) {
            return;
        }

        const errorRate = errorData.error_rate ?? errorData.errorRate;
        const todayErrors = errorData.today_errors ?? errorData.todayErrors;
        const weekErrors = errorData.this_week_errors ?? errorData.thisWeekErrors;
        const totalErrors = errorData.total_errors ?? errorData.totalErrors;

        if (dashboardElements.errorRate && errorRate !== undefined) {
            const numeric = Number(errorRate);
            dashboardElements.errorRate.textContent = Number.isNaN(numeric)
                ? `${errorRate}`
                : `${numeric}%`;
        }

        if (dashboardElements.errorsTodayLabel && todayErrors !== undefined) {
            dashboardElements.errorsTodayLabel.textContent = `${formatNumber(todayErrors)} today`;
        }

        if (dashboardElements.errorSummaryToday && todayErrors !== undefined) {
            dashboardElements.errorSummaryToday.textContent = formatNumber(todayErrors);
        }

        if (dashboardElements.errorSummaryWeek && weekErrors !== undefined) {
            dashboardElements.errorSummaryWeek.textContent = formatNumber(weekErrors);
        }

        if (dashboardElements.errorSummaryTotal && totalErrors !== undefined) {
            dashboardElements.errorSummaryTotal.textContent = formatNumber(totalErrors);
        }

        const mostCommon = errorData.most_common_errors ?? errorData.mostCommonErrors;
        updateErrorList(mostCommon);
    }

    function updateErrorList(errors) {
        if (!dashboardElements.errorList || !Array.isArray(errors)) {
            return;
        }

        if (!errors.length) {
            dashboardElements.errorList.innerHTML = '<div class="text-muted text-center py-2">No errors to display</div>';
            return;
        }

        dashboardElements.errorList.innerHTML = errors.map(error => {
            const label = error.error || error.type || 'Unknown';
            const count = error.count ?? error.total ?? 0;
            return `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${label}</span>
                    <span class="badge bg-danger rounded-pill">${formatNumber(count)}</span>
                </div>
            `;
        }).join('');
    }

    function renderTrendBadge(trend) {
        switch (trend) {
            case 'up':
                return '<span class="badge bg-success"><i class="fas fa-arrow-up"></i> Up</span>';
            case 'down':
                return '<span class="badge bg-danger"><i class="fas fa-arrow-down"></i> Down</span>';
            default:
                return '<span class="badge bg-secondary"><i class="fas fa-minus"></i> Stable</span>';
        }
    }

    function updateFeatureUsage(features) {
        if (!features) {
            return;
        }

        if (Array.isArray(features) && features.length && featuresChart) {
            featuresChart.data.labels = features.map(feature => feature.name || 'Feature');
            featuresChart.data.datasets[0].data = features.map(feature => feature.percentage ?? 0);
            featuresChart.update('none');
        }

        if (!dashboardElements.featureUsageBody) {
            return;
        }

        if (!Array.isArray(features) || !features.length) {
            dashboardElements.featureUsageBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">Feature usage data unavailable.</td>
                </tr>`;
            return;
        }

        dashboardElements.featureUsageBody.innerHTML = features.map(feature => {
            const usageCount = formatNumber(feature.usage_count ?? feature.usageCount ?? 0);
            const percentage = feature.percentage ?? 0;
            return `
                <tr>
                    <td><strong>${feature.name || 'Feature'}</strong></td>
                    <td>${usageCount}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" style="width: ${percentage}%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);">
                                ${percentage}%
                            </div>
                        </div>
                    </td>
                    <td>${renderTrendBadge(feature.trend)}</td>
                </tr>
            `;
        }).join('');
    }

    function updateUsageTrends(performanceData) {
        if (!Array.isArray(performanceData) || !performanceData.length || !usageChart) {
            return;
        }

        usageChart.data.labels = performanceData.map(entry => entry.date || '');
        usageChart.data.datasets[0].data = performanceData.map(entry => entry.requests ?? 0);
        usageChart.data.datasets[1].data = performanceData.map(entry => entry.errors ?? 0);
        usageChart.update('none');
    }

    function updateCdnPanel(cdn = {}) {
        if (!cdnElements.alertBanner) {
            return;
        }

        const degraded = Boolean(cdn.degraded);
        const signals = cdn.latency_degraded_signals || [];
        const histogram = cdn.latency_histogram || {};
        const histogramLabels = cdn.latency_histogram_labels || Object.keys(histogram);

        cdnElements.alertBanner.classList.toggle('d-none', !degraded);
        cdnElements.alertSummary.textContent = cdn.latency_degraded_summary || 'No guardrails firing';
        cdnElements.summaryText.textContent = cdn.latency_degraded_summary || 'No guardrails firing.';
        cdnElements.statusBadge.textContent = (cdn.status || 'unknown').toUpperCase();
        cdnElements.degradedBadge.textContent = degraded ? 'Degraded' : 'Healthy';
        cdnElements.degradedBadge.classList.toggle('bg-danger', degraded);
        cdnElements.degradedBadge.classList.toggle('bg-success', !degraded);
        cdnElements.rollingLatency.textContent = formatLatency(cdn.rolling_latency_ms);
        cdnElements.probeRatio.textContent = formatPercent(
            typeof cdn.probe_success_ratio === 'number' ? cdn.probe_success_ratio : null
        );
        cdnElements.failureStreak.textContent = cdn.failure_streak ?? 0;
        cdnElements.sampleCount.textContent = cdn.window_sample_count ?? 0;
        cdnElements.lastSampleAge.textContent = cdn.last_sample_age_seconds !== undefined
            ? `${cdn.last_sample_age_seconds}s`
            : '—';
        cdnElements.lastProbeCode.textContent = cdn.last_probe_status_code ?? '—';
        cdnElements.lastProbeAttempts.textContent = cdn.last_probe_attempts ?? '—';
        cdnElements.staleFlag.textContent = cdn.latency_stale ? 'Yes' : 'No';

        // render signals
        cdnElements.signalsContainer.innerHTML = '';
        if (signals.length) {
            signals.forEach(signal => {
                const pill = document.createElement('span');
                pill.className = 'cdn-signal-badge';
                pill.dataset.signal = signal;
                pill.textContent = signal
                    .replace(/_/g, ' ')
                    .replace(/^\w/, letter => letter.toUpperCase());
                cdnElements.signalsContainer.appendChild(pill);
            });
        } else {
            const pill = document.createElement('span');
            pill.className = 'cdn-signal-badge healthy';
            pill.textContent = 'All guardrails clear';
            cdnElements.signalsContainer.appendChild(pill);
        }

        // render histogram rows
        cdnElements.histogramList.innerHTML = '';
        if (histogramLabels.length) {
            histogramLabels.forEach(label => {
                const row = document.createElement('div');
                row.className = 'cdn-hist-row py-2 d-flex justify-content-between align-items-center';

                const labelEl = document.createElement('div');
                labelEl.className = 'text-muted';
                labelEl.textContent = label;

                const valueEl = document.createElement('div');
                valueEl.className = 'fw-semibold';
                valueEl.textContent = histogram[label] ?? 0;

                row.appendChild(labelEl);
                row.appendChild(valueEl);
                cdnElements.histogramList.appendChild(row);
            });
        } else {
            const empty = document.createElement('p');
            empty.className = 'text-muted mb-0';
            empty.textContent = 'No samples recorded in the current window.';
            cdnElements.histogramList.appendChild(empty);
        }
    }

    // AI Usage Trends Chart
    const usageCanvas = document.getElementById('aiUsageChart');
    const usageData = @json($performanceData ?? []);

    const usageChart = usageCanvas
        ? new Chart(usageCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: usageData.map(d => d.date),
            datasets: [
                {
                    label: 'AI Requests',
                    data: usageData.map(d => d.requests),
                    borderColor: '#E91E8C',
                    backgroundColor: 'rgba(233, 30, 140, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Errors',
                    data: usageData.map(d => d.errors),
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        })
        : null;

    // Popular Features Pie Chart
    const featuresCanvas = document.getElementById('featuresChart');
    const featuresData = @json($popularFeatures ?? []);

    const featuresChart = featuresCanvas
        ? new Chart(featuresCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: featuresData.map(f => f.name),
            datasets: [{
                data: featuresData.map(f => f.percentage),
                backgroundColor: [
                    '#E91E8C',
                    '#8B5CF6',
                    '#10B981',
                    '#F59E0B'
                ]
            }]
        },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        })
        : null;

    const resolutionTrendCanvas = document.getElementById('resolutionTrendChart');
    if (resolutionTrendCanvas) {
        resolutionTrendChart = new Chart(resolutionTrendCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'P90 (minutes)',
                        data: [],
                        borderColor(context) {
                            return getTrendColor('p90', context?.parsed?.y ?? null);
                        },
                        backgroundColor(context) {
                            return getTrendColor('p90', context?.parsed?.y ?? null, 0.18);
                        },
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 5,
                        pointBackgroundColor(context) {
                            return getTrendColor('p90', context?.parsed?.y ?? null);
                        },
                        pointBorderColor(context) {
                            return getTrendColor('p90', context?.parsed?.y ?? null);
                        },
                        segment: {
                            borderColor(ctx) {
                                return getTrendColor('p90', ctx?.p1?.parsed?.y ?? null);
                            },
                            backgroundColor(ctx) {
                                return getTrendColor('p90', ctx?.p1?.parsed?.y ?? null, 0.18);
                            },
                        },
                    },
                    {
                        label: 'P99 (minutes)',
                        data: [],
                        borderColor(context) {
                            return getTrendColor('p99', context?.parsed?.y ?? null);
                        },
                        backgroundColor(context) {
                            return getTrendColor('p99', context?.parsed?.y ?? null, 0.18);
                        },
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 5,
                        pointBackgroundColor(context) {
                            return getTrendColor('p99', context?.parsed?.y ?? null);
                        },
                        pointBorderColor(context) {
                            return getTrendColor('p99', context?.parsed?.y ?? null);
                        },
                        segment: {
                            borderColor(ctx) {
                                return getTrendColor('p99', ctx?.p1?.parsed?.y ?? null);
                            },
                            backgroundColor(ctx) {
                                return getTrendColor('p99', ctx?.p1?.parsed?.y ?? null, 0.18);
                            },
                        },
                    },
                    {
                        label: 'Warning SLA',
                        data: [],
                        borderColor: '#facc15',
                        borderDash: [6, 6],
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                    },
                    {
                        label: 'Critical SLA',
                        data: [],
                        borderColor: '#ef4444',
                        borderDash: [4, 4],
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y ?? context.parsed;
                                return `${label}: ${value ?? '—'}m`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes',
                        },
                    },
                },
            },
        });

        updateResolutionTrendChart(initialResolutionStats);
    } else {
        toggleResolutionTrendEmpty(true);
    }

    // Refresh Metrics
    function refreshMetrics() {
        location.reload();
    }

    // Auto-refresh every 30 seconds
    function pullMetrics() {
        fetch(metricsEndpoint)
            .then(response => response.json())
            .then(data => {
                if (!data) {
                    return;
                }

                setMetricsFetchError(null);
                setDashboardLastUpdateTimestamp(data.timestamp || Date.now());

                if (data.cdn) {
                    updateCdnPanel(data.cdn);
                }

                const stats = getMetricPayload(data, ['stats', 'usage_stats', 'usageStats']);
                if (stats) {
                    updateStatsCards(stats);
                }

                const cacheMetrics = getMetricPayload(data, ['cacheMetrics', 'cache_metrics']);
                if (cacheMetrics) {
                    updateCacheMetrics(cacheMetrics);
                }

                const errorData = getMetricPayload(data, ['errorData', 'error_data']);
                if (errorData) {
                    updateErrorMetrics(errorData);
                }

                const featureUsage = getMetricPayload(data, ['popularFeatures', 'popular_features']);
                if (featureUsage) {
                    updateFeatureUsage(featureUsage);
                }

                const performanceData = getMetricPayload(data, ['performanceData', 'performance_data']);
                if (performanceData) {
                    updateUsageTrends(performanceData);
                }

                if (Array.isArray(data.clientAlerts)) {
                    setClientAlerts(data.clientAlerts);
                }

                if (data.clientAlertStats) {
                    setClientAlertStats(data.clientAlertStats);
                }

                const realtimeSnapshot = getMetricPayload(data, ['realtime']);
                if (realtimeSnapshot) {
                    if (!stats && realtimeSnapshot.requests) {
                        updateStatsCards(normalizeRealtimeStats(realtimeSnapshot.requests));
                    }

                    if (!cacheMetrics && realtimeSnapshot.cache) {
                        updateCacheMetrics(normalizeRealtimeCache(realtimeSnapshot.cache));
                    }

                    if (!errorData && realtimeSnapshot.errors) {
                        updateErrorMetrics(normalizeRealtimeErrors(realtimeSnapshot.errors));
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching metrics:', error);
                const message = `Unable to refresh metrics (${new Date().toLocaleTimeString()}). Retrying…`;
                setMetricsFetchError(message);
                emitClientAlert({
                    source: 'ai-analytics.dashboard.fetch',
                    severity: 'warning',
                    message,
                    context: { error: String(error) }
                });
            });
    }

    // Prime CDN panel in case backend returns new snapshot
    pullMetrics();
    setInterval(pullMetrics, 30000);
    refreshDashboardLastUpdate();
    setInterval(refreshDashboardLastUpdate, 5000);
    setClientAlerts(initialClientAlerts, { reset: true });
    setClientAlertStats(initialClientAlertStats);
    updateClientAlertStatsDisplay();
    fetchClientAlerts({ reset: true });
</script>
@endpush


