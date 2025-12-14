@extends('admin.layouts.master')

@section('title', 'Analytics Dashboard')

@section('contents')
<div class="dashboard-analytics">
    <!-- Header -->
    <div class="row mb-4">
        <div class="col-md-6">
            <h2 class="mb-0">📊 Analytics Dashboard</h2>
            <p class="text-muted">Real-time platform insights and metrics</p>
        </div>
        <div class="col-md-6 text-end">
            <button class="btn btn-outline-primary me-2" onclick="refreshCache()">
                <i class="fas fa-sync-alt"></i> Refresh Data
            </button>
            <div class="btn-group">
                <button type="button" class="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown">
                    <i class="fas fa-download"></i> Export
                </button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="{{ route('admin.analytics.export', ['format' => 'json']) }}">Export as JSON</a></li>
                    <li><a class="dropdown-item" href="{{ route('admin.analytics.export', ['format' => 'csv']) }}">Export as CSV</a></li>
                </ul>
            </div>
        </div>
    </div>

    <!-- Overview Cards -->
    <div class="row g-3 mb-4">
        <div class="col-md-3">
            <div class="card stats-card bg-primary text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Total Jobs</h6>
                            <h3 class="mb-0">{{ number_format($overview['total_jobs']) }}</h3>
                            <small class="text-white-50">{{ $overview['active_jobs'] }} active</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-briefcase fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white bg-opacity-10 text-white-50">
                    <i class="fas fa-plus-circle"></i> {{ $overview['new_jobs_today'] }} new today
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card bg-success text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Applications</h6>
                            <h3 class="mb-0">{{ number_format($overview['total_applications']) }}</h3>
                            <small class="text-white-50">{{ $overview['pending_applications'] }} pending</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-file-alt fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white bg-opacity-10 text-white-50">
                    <i class="fas fa-plus-circle"></i> {{ $overview['new_applications_today'] }} new today
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card bg-info text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Total Users</h6>
                            <h3 class="mb-0">{{ number_format($overview['total_candidates'] + $overview['total_companies']) }}</h3>
                            <small class="text-white-50">{{ $overview['total_candidates'] }} members</small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-users fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white bg-opacity-10 text-white-50">
                    <i class="fas fa-plus-circle"></i> {{ $overview['new_users_today'] }} new today
                </div>
            </div>
        </div>

        <div class="col-md-3">
            <div class="card stats-card bg-warning text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="text-white-50 mb-2">Total Revenue</h6>
                            <h3 class="mb-0">${{ number_format($overview['total_revenue'], 2) }}</h3>
                            <small class="text-white-50">
                                @if($monthlyRevenue['growth_percentage'] >= 0)
                                    <i class="fas fa-arrow-up"></i> {{ $monthlyRevenue['growth_percentage'] }}%
                                @else
                                    <i class="fas fa-arrow-down"></i> {{ abs($monthlyRevenue['growth_percentage']) }}%
                                @endif
                            </small>
                        </div>
                        <div class="stats-icon">
                            <i class="fas fa-dollar-sign fa-3x opacity-50"></i>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white bg-opacity-10 text-white-50">
                    This month: ${{ number_format($monthlyRevenue['current_month'], 2) }}
                </div>
            </div>
        </div>
    </div>

    <!-- Conversion Metrics -->
    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="card">
                <div class="card-body text-center">
                    <h5 class="text-muted">Avg Applications/Job</h5>
                    <h2 class="text-primary">{{ $conversionMetrics['avg_applications_per_job'] }}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card">
                <div class="card-body text-center">
                    <h5 class="text-muted">Hire Rate</h5>
                    <h2 class="text-success">{{ $conversionMetrics['hire_rate'] }}%</h2>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card">
                <div class="card-body text-center">
                    <h5 class="text-muted">Total Hired</h5>
                    <h2 class="text-info">{{ number_format($conversionMetrics['total_hired']) }}</h2>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="row g-3 mb-4">
        <div class="col-lg-8">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">📈 Jobs & Applications Over Time</h5>
                    <select class="form-select form-select-sm" style="width: auto;" id="timeSeriesPeriod" onchange="updateTimeSeriesChart()">
                        <option value="7days">Last 7 Days</option>
                        <option value="30days" selected>Last 30 Days</option>
                        <option value="90days">Last 90 Days</option>
                        <option value="year">Last Year</option>
                    </select>
                </div>
                <div class="card-body">
                    <canvas id="timeSeriesChart" height="80"></canvas>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">🎯 Application Status</h5>
                </div>
                <div class="card-body">
                    <canvas id="applicationStatusChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="row g-3 mb-4">
        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">📂 Top Job Categories</h5>
                </div>
                <div class="card-body">
                    <canvas id="categoriesChart" height="120"></canvas>
                </div>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">💰 Revenue Over Time</h5>
                </div>
                <div class="card-body">
                    <canvas id="revenueChart" height="120"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Row 3 -->
    <div class="row g-3 mb-4">
        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">🏢 Job Type Distribution</h5>
                </div>
                <div class="card-body">
                    <canvas id="jobTypeChart"></canvas>
                </div>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">🌍 Geographic Distribution</h5>
                </div>
                <div class="card-body">
                    <canvas id="geographicChart" height="120"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Tables Row -->
    <div class="row g-3 mb-4">
        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">📨 Recent Applications</h5>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Candidate</th>
                                    <th>Job</th>
                                    <th>Company</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($recentApplications as $app)
                                <tr>
                                    <td>
                                        <strong>{{ $app['candidate_name'] }}</strong><br>
                                        <small class="text-muted">{{ $app['candidate_title'] }}</small>
                                    </td>
                                    <td>{{ \Str::limit($app['job_title'], 30) }}</td>
                                    <td>{{ $app['company_name'] }}</td>
                                    <td>
                                        <span class="badge bg-{{ $app['status'] === 'hired' ? 'success' : ($app['status'] === 'rejected' ? 'danger' : 'warning') }}">
                                            {{ ucfirst($app['status']) }}
                                        </span>
                                    </td>
                                    <td><small>{{ $app['applied_at'] }}</small></td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="5" class="text-center text-muted">No recent applications</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">💳 Recent Transactions</h5>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>Plan</th>
                                    <th>Amount</th>
                                    <th>Provider</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($recentTransactions as $transaction)
                                <tr>
                                    <td>{{ $transaction['company_name'] }}</td>
                                    <td>{{ $transaction['plan_name'] }}</td>
                                    <td><strong>${{ number_format($transaction['amount'], 2) }}</strong></td>
                                    <td>
                                        <span class="badge bg-info">{{ ucfirst($transaction['payment_provider']) }}</span>
                                    </td>
                                    <td><small>{{ $transaction['paid_at'] }}</small></td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="5" class="text-center text-muted">No recent transactions</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Top Companies -->
    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">🏆 Top Companies by Jobs Posted</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        @foreach($topCompanies as $company)
                        <div class="col-md-2-4 mb-3">
                            <div class="text-center">
                                <img src="{{ asset($company['logo'] ?? 'default-logo.png') }}" alt="{{ $company['name'] }}" class="rounded-circle mb-2" style="width: 60px; height: 60px; object-fit: cover;">
                                <h6 class="mb-1">{{ \Str::limit($company['name'], 20) }}</h6>
                                <span class="badge bg-primary">{{ $company['jobs_count'] }} jobs</span>
                            </div>
                        </div>
                        @endforeach
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Onboarding Support Insights -->
    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="card" id="supportInsightsCard">
                <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0">🧭 Onboarding Support Engagement</h5>
                        <small class="text-muted" id="supportInsightsRange">Loading engagement…</small>
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <select class="form-select form-select-sm" id="supportInsightsWindow" onchange="loadSupportInsights()">
                            <option value="14">Last 14 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="60">Last 60 days</option>
                        </select>
                        <select class="form-select form-select-sm" id="supportInsightsPersona" onchange="loadSupportInsights()">
                            <option value="">All personas</option>
                            @foreach(array_keys(config('womenrise.personas', [])) as $persona)
                                <option value="{{ $persona }}">{{ \Illuminate\Support\Str::title(str_replace('-', ' ', $persona)) }}</option>
                            @endforeach
                        </select>
                        <button class="btn btn-sm btn-outline-secondary" type="button" onclick="loadSupportInsights()" id="supportInsightsRefresh">
                            <i class="fas fa-sync-alt me-1"></i>Refresh
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="supportInsightsEmpty" class="text-center text-muted py-4 d-none">
                        No onboarding engagement recorded for this window yet.
                    </div>
                    <div id="supportInsightsContent" class="d-none">
                        <div class="row row-cols-1 row-cols-md-4 g-3 mb-3">
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small">Total events</div>
                                    <div class="fs-5 fw-semibold" id="supportInsightsTotal">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small">CTA clicks</div>
                                    <div class="fs-5 fw-semibold" id="supportInsightsCta">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small">Nudges dismissed</div>
                                    <div class="fs-5 fw-semibold" id="supportInsightsDismissed">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small">Unique members</div>
                                    <div class="fs-5 fw-semibold" id="supportInsightsUsers">—</div>
                                </div>
                            </div>
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-lg-6">
                                <div class="border rounded p-3 h-100">
                                    <h6 class="text-muted text-uppercase small mb-2">Support distribution</h6>
                                    <ul class="list-group list-group-flush small" id="supportInsightsSupportList">
                                        <li class="list-group-item text-muted">Loading…</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-lg-6">
                                <div class="border rounded p-3 h-100">
                                    <h6 class="text-muted text-uppercase small mb-2">Persona distribution</h6>
                                    <ul class="list-group list-group-flush small" id="supportInsightsPersonaList">
                                        <li class="list-group-item text-muted">Loading…</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-lg-6">
                                <div class="border rounded p-3 h-100">
                                    <h6 class="text-muted text-uppercase small mb-2">CTA trend</h6>
                                    <canvas id="supportInsightsTimeline" height="140"></canvas>
                                </div>
                            </div>
                            <div class="col-lg-6">
                                <div class="border rounded p-3 h-100">
                                    <h6 class="text-muted text-uppercase small mb-2">Persona mix</h6>
                                    <canvas id="supportInsightsPersonaChart" height="140"></canvas>
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-sm mb-0">
                                <thead>
                                    <tr>
                                        <th>Support</th>
                                        <th>Total</th>
                                        <th>CTA total</th>
                                        <th>Highlight CTA %</th>
                                        <th>Nudges dismissed</th>
                                        <th>Top CTA</th>
                                        <th class="text-end">Details</th>
                                    </tr>
                                </thead>
                                <tbody id="supportInsightsTable">
                                    <tr>
                                        <td colspan="7" class="text-center text-muted py-3">Loading…</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

<!-- Support Engagement Drilldown Modal -->
<div class="modal fade" id="supportInsightsDrilldownModal" tabindex="-1" aria-labelledby="supportInsightsDrilldownLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="supportInsightsDrilldownLabel">Support Engagement Drilldown</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                    <select class="form-select form-select-sm" id="supportInsightsDrilldownWindow">
                        <option value="14">Last 14 days</option>
                        <option value="30" selected>Last 30 days</option>
                        <option value="60">Last 60 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                    <select class="form-select form-select-sm" id="supportInsightsDrilldownPersona">
                        <option value="">All personas</option>
                        @foreach(array_keys(config('womenrise.personas', [])) as $persona)
                            <option value="{{ $persona }}">{{ \Illuminate\Support\Str::title(str_replace('-', ' ', $persona)) }}</option>
                        @endforeach
                    </select>
                    <select class="form-select form-select-sm" id="supportInsightsDrilldownInteraction">
                        <option value="">All interactions</option>
                        <option value="cta_clicked">CTA clicks</option>
                        <option value="nudge_dismissed">Nudges dismissed</option>
                    </select>
                    <div class="form-check form-switch ms-2">
                        <input class="form-check-input" type="checkbox" role="switch" id="supportInsightsDrilldownHighlight">
                        <label class="form-check-label small" for="supportInsightsDrilldownHighlight">Highlighted CTA only</label>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary" type="button" id="supportInsightsDrilldownRefresh">
                        <i class="fas fa-sync-alt me-1"></i>Refresh
                    </button>
                </div>
                <div class="mb-3">
                    <small class="text-muted" id="supportInsightsDrilldownSummary">Select a support to review recent engagement events.</small>
                </div>
                <div class="row row-cols-1 row-cols-md-3 g-2 mb-3" id="supportInsightsDrilldownStats">
                    <div class="col">
                        <div class="border rounded p-3 bg-light h-100 text-center">
                            <div class="text-uppercase text-muted small">CTA clicks</div>
                            <div class="fs-6 fw-semibold" id="supportInsightsDrilldownCtaTotal">—</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="border rounded p-3 bg-light h-100 text-center">
                            <div class="text-uppercase text-muted small">Nudges dismissed</div>
                            <div class="fs-6 fw-semibold" id="supportInsightsDrilldownNudgeTotal">—</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="border rounded p-3 bg-light h-100 text-center">
                            <div class="text-uppercase text-muted small">Highlighted CTA</div>
                            <div class="fs-6 fw-semibold" id="supportInsightsDrilldownHighlightTotal">—</div>
                        </div>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Occurred</th>
                                <th>Interaction</th>
                                <th>Persona flags</th>
                                <th>CTA label</th>
                                <th>User</th>
                                <th>Highlighted</th>
                            </tr>
                        </thead>
                        <tbody id="supportInsightsDrilldownTable">
                            <tr>
                                <td colspan="6" class="text-center text-muted py-3">Choose a support to view events.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="supportInsightsDrilldownEmpty" class="text-center text-muted py-3 d-none">
                    No engagement events recorded for this support within the selected window.
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div class="small text-muted" id="supportInsightsDrilldownPaginationMeta"></div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary" id="supportInsightsDrilldownPrev">Previous</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" id="supportInsightsDrilldownNext">Next</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

    <!-- Lead Telemetry -->
    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="card" id="leadTelemetryCard">
                <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0">🧭 Lead Form Telemetry</h5>
                        <small class="text-muted" id="leadTelemetryRange">Loading recent activity…</small>
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <select class="form-select form-select-sm" id="leadTelemetryEvent" onchange="loadLeadTelemetrySummary()">
                            <option value="">All events</option>
                        </select>
                        <select class="form-select form-select-sm" id="leadTelemetryWindow" onchange="loadLeadTelemetrySummary()">
                            <option value="7">Last 7 days</option>
                            <option value="14">Last 14 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="60">Last 60 days</option>
                        </select>
                        <button class="btn btn-sm btn-outline-primary" type="button"
                            data-bs-toggle="modal"
                            data-bs-target="#leadTelemetryDrilldownModal"
                            id="leadTelemetryDrilldownButton">
                            <i class="fas fa-search-plus me-1"></i>Drilldown
                        </button>
                        <button type="button"  class="btn btn-sm btn-outline-primary" data-href="#" id="leadTelemetryExport" target="_blank" rel="noopener">
                            <i class="fas fa-file-download me-1"></i>Download CSV
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" type="button" onclick="loadLeadTelemetrySummary()" id="leadTelemetryRefresh">
                            <i class="fas fa-sync-alt me-1"></i>Refresh
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="leadTelemetryEmpty" class="text-center text-muted py-4 d-none">
                        No lead events recorded for this window yet.
                    </div>
                    <div id="leadTelemetryContent">
                        <div class="row row-cols-1 row-cols-md-4 g-3 mb-3">
                            <div class="col">
                                <div class="border rounded p-3 bg-light">
                                    <div class="text-uppercase text-muted small">Total Events</div>
                                    <div class="fs-5 fw-semibold" id="leadTelemetryTotal">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light">
                                    <div class="text-uppercase text-muted small">Average / Day</div>
                                    <div class="fs-5 fw-semibold" id="leadTelemetryAverage">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light">
                                    <div class="text-uppercase text-muted small">Top Event</div>
                                    <div class="fs-5 fw-semibold" id="leadTelemetryTopEvent">—</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light">
                                    <div class="text-uppercase text-muted small">Conversion Rate</div>
                                    <div class="fs-5 fw-semibold" id="leadTelemetryConversion">—</div>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive mb-3">
                            <table class="table table-sm mb-0">
                                <thead>
                                    <tr>
                                        <th class="text-uppercase text-muted small">Event</th>
                                        <th class="text-uppercase text-muted small" style="width: 120px;">Total</th>
                                        <th class="text-uppercase text-muted small" style="width: 200px;">Last Seen</th>
                                    </tr>
                                </thead>
                                <tbody id="leadTelemetryEvents">
                                    <tr>
                                        <td colspan="3" class="text-center text-muted py-3">Loading…</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <canvas id="leadTelemetryTimeline" height="80"></canvas>
                        <div class="row row-cols-1 row-cols-md-2 g-3 mt-3">
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small mb-2">Top Sources</div>
                                    <ul class="list-group list-group-flush small" id="leadTelemetryTopSources">
                                        <li class="list-group-item text-muted">Loading…</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col">
                                <div class="border rounded p-3 bg-light h-100">
                                    <div class="text-uppercase text-muted small mb-2">Top Organizations</div>
                                    <ul class="list-group list-group-flush small" id="leadTelemetryTopOrganizations">
                                        <li class="list-group-item text-muted">Loading…</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="mt-3">
                            <h6 class="text-muted text-uppercase small mb-2">Recent Lead Activity</h6>
                            <ul class="list-group list-group-flush" id="leadTelemetryRecent">
                                <li class="list-group-item text-muted small">Loading recent events…</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Lead Telemetry Drilldown Modal -->
<div class="modal fade" id="leadTelemetryDrilldownModal" tabindex="-1" aria-labelledby="leadTelemetryDrilldownLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="leadTelemetryDrilldownLabel">Lead Event Drilldown</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="d-flex gap-2 flex-wrap align-items-center mb-3">
                    <select class="form-select form-select-sm" id="leadTelemetryDrilldownEvent">
                        <option value="">All events</option>
                    </select>
                    <select class="form-select form-select-sm" id="leadTelemetryDrilldownWindow">
                        <option value="7">Last 7 days</option>
                        <option value="14">Last 14 days</option>
                        <option value="30" selected>Last 30 days</option>
                        <option value="60">Last 60 days</option>
                    </select>
                    <input type="text" class="form-control form-control-sm" id="leadTelemetryDrilldownSource" placeholder="Filter by source">
                    <input type="text" class="form-control form-control-sm" id="leadTelemetryDrilldownOrganization" placeholder="Filter by organization">
                    <button class="btn btn-sm btn-outline-secondary" type="button" onclick="loadLeadTelemetryDrilldown()" id="leadTelemetryDrilldownRefresh">
                        <i class="fas fa-sync-alt me-1"></i>Refresh
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Occurred</th>
                                <th>Source</th>
                                <th>Organization</th>
                            </tr>
                        </thead>
                        <tbody id="leadTelemetryDrilldownTable">
                            <tr>
                                <td colspan="4" class="text-center text-muted py-3">Loading events…</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>


@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
// Time Series Chart (Jobs & Applications)
let timeSeriesChart;
let leadTelemetryChart;
let leadTelemetryState = {
    focusEvent: null,
    availableEvents: [],
};
let leadTelemetryDrilldownState = {
    focusEvent: null,
    availableEvents: [],
};
let supportTimelineChart;
let supportPersonaChart;
let supportDrilldownModalInstance;
let supportDrilldownState = {
    supportType: null,
    supportLabel: null,
    page: 1,
    hasMore: false,
    windowDays: 30,
    interaction: null,
    highlighted: false,
};
const supportInsightsEndpoint = @json(route('admin.analytics.support-insights'));
const supportInsightsEventsEndpoint = @json(route('admin.analytics.support-insights.events'));
const leadTelemetrySummaryEndpoint = @json(route('admin.analytics.lead-telemetry.summary'));
function initTimeSeriesChart() {
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');

    fetch('{{ route("admin.analytics.chart") }}?type=jobs_over_time&period=30days')
        .then(res => res.json())
        .then(jobsData => {
            fetch('{{ route("admin.analytics.chart") }}?type=applications_over_time&period=30days')
                .then(res => res.json())
                .then(appsData => {
                    timeSeriesChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: jobsData.labels,
                            datasets: [{
                                label: 'Jobs Posted',
                                data: jobsData.data,
                                borderColor: 'rgb(54, 162, 235)',
                                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                                tension: 0.3
                            }, {
                                label: 'Applications',
                                data: appsData.data,
                                borderColor: 'rgb(75, 192, 192)',
                                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                                tension: 0.3
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    position: 'top',
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }
                    });
                });
        });
}

function updateTimeSeriesChart() {
    const period = document.getElementById('timeSeriesPeriod').value;

    fetch(`{{ route("admin.analytics.chart") }}?type=jobs_over_time&period=${period}`)
        .then(res => res.json())
        .then(jobsData => {
            fetch(`{{ route("admin.analytics.chart") }}?type=applications_over_time&period=${period}`)
                .then(res => res.json())
                .then(appsData => {
                    timeSeriesChart.data.labels = jobsData.labels;
                    timeSeriesChart.data.datasets[0].data = jobsData.data;
                    timeSeriesChart.data.datasets[1].data = appsData.data;
                    timeSeriesChart.update();
                });
        });
}

// Application Status Chart
function initApplicationStatusChart() {
    const ctx = document.getElementById('applicationStatusChart').getContext('2d');
    const data = {!! json_encode($applicationStatus) !!};

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
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
    });
}

// Categories Chart
function initCategoriesChart() {
    const ctx = document.getElementById('categoriesChart').getContext('2d');
    const data = {!! json_encode($topCategories) !!};

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Jobs Count',
                data: data.data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Revenue Chart
function initRevenueChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');

    fetch('{{ route("admin.analytics.chart") }}?type=revenue_over_time&period=30days')
        .then(res => res.json())
        .then(data => {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Revenue ($)',
                        data: data.data,
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.2)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        });
}

// Job Type Chart
function initJobTypeChart() {
    const ctx = document.getElementById('jobTypeChart').getContext('2d');
    const data = {!! json_encode($jobTypeDistribution) !!};

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Geographic Chart
function initGeographicChart() {
    const ctx = document.getElementById('geographicChart').getContext('2d');
    const data = {!! json_encode($geographicDistribution) !!};

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Jobs by Location',
                data: data.data,
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function loadSupportInsights() {
    const rangeLabel = document.getElementById('supportInsightsRange');
    const totalEl = document.getElementById('supportInsightsTotal');
    const ctaEl = document.getElementById('supportInsightsCta');
    const dismissedEl = document.getElementById('supportInsightsDismissed');
    const usersEl = document.getElementById('supportInsightsUsers');
    const supportList = document.getElementById('supportInsightsSupportList');
    const personaList = document.getElementById('supportInsightsPersonaList');
    const tableBody = document.getElementById('supportInsightsTable');
    const emptyState = document.getElementById('supportInsightsEmpty');
    const content = document.getElementById('supportInsightsContent');
    const refreshButton = document.getElementById('supportInsightsRefresh');
    const windowSelect = document.getElementById('supportInsightsWindow');
    const personaSelect = document.getElementById('supportInsightsPersona');

    if (!rangeLabel || !totalEl || !ctaEl || !dismissedEl || !usersEl || !supportList || !personaList || !tableBody || !emptyState || !content) {
        return;
    }

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    emptyState.classList.add('d-none');
    content.classList.add('d-none');
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Loading…</td></tr>';
    supportList.innerHTML = '<li class="list-group-item text-muted">Loading…</li>';
    personaList.innerHTML = '<li class="list-group-item text-muted">Loading…</li>';
    rangeLabel.textContent = 'Loading engagement…';

    const params = new URLSearchParams();
    const windowValue = windowSelect ? windowSelect.value : '30';
    const personaValue = personaSelect ? personaSelect.value : '';

    const now = new Date();
    const fromDate = new Date(now.getTime() - Number(windowValue) * 24 * 60 * 60 * 1000);
    params.set('from', fromDate.toISOString());

    if (personaValue) {
        params.set('persona', personaValue);
    }

    const endpointUrl = new URL(supportInsightsEndpoint, window.location.origin);
    params.forEach((value, key) => {
        endpointUrl.searchParams.set(key, value);
    });

    fetch(endpointUrl.toString(), {
        headers: {
            'Accept': 'application/json',
        },
        credentials: 'same-origin',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to load support insights');
            }

            return response.json();
        })
        .then((payload) => {
            const totals = payload?.summary?.totals ?? {};
            const distribution = payload?.summary?.distribution ?? {};
            const supports = Array.isArray(payload?.supports) ? payload.supports : [];
            const totalEvents = totals.events ?? 0;

            rangeLabel.textContent = payload?.range
                ? `${formatShortDate(payload.range.from)} – ${formatShortDate(payload.range.to)}`
                : 'Recent engagement window';

            totalEl.textContent = totalEvents.toLocaleString();
            ctaEl.textContent = (totals.cta_clicks ?? 0).toLocaleString();
            dismissedEl.textContent = (totals.nudge_dismissed ?? 0).toLocaleString();
            usersEl.textContent = (totals.unique_users ?? 0).toLocaleString();

            renderSupportInsightsList(supportList, distribution.supports ?? []);
            renderPersonaInsightsList(personaList, distribution.personas ?? []);
            renderSupportInsightsTable(tableBody, supports);
            renderSupportTimelineChart(payload?.timeline ?? []);
            renderSupportPersonaChart(distribution.personas ?? []);

            if (totalEvents === 0) {
                emptyState.classList.remove('d-none');
                content.classList.add('d-none');
            } else {
                emptyState.classList.add('d-none');
                content.classList.remove('d-none');
            }
        })
        .catch((error) => {
            console.error(error);
            rangeLabel.textContent = 'Unable to load engagement. Try again soon.';
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-3">Failed to load insights.</td></tr>';
            supportList.innerHTML = '<li class="list-group-item text-danger">Failed to load distribution.</li>';
            personaList.innerHTML = '<li class="list-group-item text-danger">Failed to load distribution.</li>';
            emptyState.classList.remove('d-none');
            content.classList.add('d-none');
        })
        .finally(() => {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        });
}

function renderSupportInsightsList(container, items) {
    if (!container) {
        return;
    }

    if (!Array.isArray(items) || !items.length) {
        container.innerHTML = '<li class="list-group-item text-muted">No support activity yet.</li>';
        return;
    }

    container.innerHTML = '';

    items.forEach((item) => {
        const total = item.total ?? 0;
        const percentage = item.percentage !== null && item.percentage !== undefined
            ? `${item.percentage}%`
            : '—';

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${formatSupportLabel(item.support_type)}</span>
            <span>
                <span class="badge bg-primary rounded-pill">${total.toLocaleString()}</span>
                <small class="text-muted ms-1">${percentage}</small>
            </span>
        `;
        container.appendChild(li);
    });
}

function renderPersonaInsightsList(container, items) {
    if (!container) {
        return;
    }

    if (!Array.isArray(items) || !items.length) {
        container.innerHTML = '<li class="list-group-item text-muted">No persona signals recorded.</li>';
        return;
    }

    container.innerHTML = '';

    items.forEach((item) => {
        const total = item.total ?? 0;
        const percentage = item.percentage !== null && item.percentage !== undefined
            ? `${item.percentage}%`
            : '—';

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${formatPersonaLabel(item.persona)}</span>
            <span>
                <span class="badge bg-secondary rounded-pill">${total.toLocaleString()}</span>
                <small class="text-muted ms-1">${percentage}</small>
            </span>
        `;
        container.appendChild(li);
    });
}

function renderSupportInsightsTable(container, supports) {
    if (!container) {
        return;
    }

    if (!Array.isArray(supports) || !supports.length) {
        container.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No support engagement recorded.</td></tr>';
        return;
    }

    container.innerHTML = '';

    supports.forEach((support) => {
        const metrics = support.metrics ?? {};
        const insights = support.insights ?? {};
        const topCta = Array.isArray(insights.top_cta_labels) && insights.top_cta_labels.length
            ? insights.top_cta_labels[0].label
            : '—';

        const highlightRate = metrics.cta_highlight_rate !== null && metrics.cta_highlight_rate !== undefined
            ? `${metrics.cta_highlight_rate}%`
            : '—';

        const label = support.label ?? formatSupportLabel(support.support_type);

        const row = document.createElement('tr');

        const supportCell = document.createElement('td');
        supportCell.textContent = label;
        row.appendChild(supportCell);

        const totalCell = document.createElement('td');
        totalCell.textContent = (metrics.total_events ?? 0).toLocaleString();
        row.appendChild(totalCell);

        const ctaCell = document.createElement('td');
        ctaCell.textContent = (metrics.cta_total ?? 0).toLocaleString();
        row.appendChild(ctaCell);

        const highlightCell = document.createElement('td');
        highlightCell.textContent = highlightRate;
        row.appendChild(highlightCell);

        const dismissedCell = document.createElement('td');
        dismissedCell.textContent = (metrics.nudge_dismissed_total ?? 0).toLocaleString();
        row.appendChild(dismissedCell);

        const topCtaCell = document.createElement('td');
        topCtaCell.textContent = topCta;
        row.appendChild(topCtaCell);

        const actionCell = document.createElement('td');
        actionCell.className = 'text-end';

        const triggerButton = document.createElement('button');
        triggerButton.type = 'button';
        triggerButton.className = 'btn btn-sm btn-outline-primary support-drilldown-trigger';
        triggerButton.dataset.supportDrilldown = support.support_type ?? '';
        triggerButton.dataset.supportLabel = label;
        triggerButton.textContent = 'View events';
        actionCell.appendChild(triggerButton);

        row.appendChild(actionCell);
        container.appendChild(row);
    });
}

function renderSupportTimelineChart(points) {
    const canvas = document.getElementById('supportInsightsTimeline');

    if (!canvas || typeof Chart === 'undefined') {
        return;
    }

    if (supportTimelineChart) {
        supportTimelineChart.destroy();
        supportTimelineChart = null;
    }

    if (!Array.isArray(points) || !points.length) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const labels = points.map((point) => formatShortDate(point.date));
    const ctaData = points.map((point) => point.cta_clicks ?? 0);
    const dismissedData = points.map((point) => point.nudge_dismissed ?? 0);

    supportTimelineChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'CTA clicks',
                    data: ctaData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.15)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                },
                {
                    label: 'Nudges dismissed',
                    data: dismissedData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.15)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                    },
                },
            },
        },
    });
}

function renderSupportPersonaChart(personas) {
    const canvas = document.getElementById('supportInsightsPersonaChart');

    if (!canvas || typeof Chart === 'undefined') {
        return;
    }

    if (supportPersonaChart) {
        supportPersonaChart.destroy();
        supportPersonaChart = null;
    }

    if (!Array.isArray(personas) || !personas.length) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const palette = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
    ];

    const labels = personas.map((item) => formatPersonaLabel(item.persona));
    const data = personas.map((item) => item.total ?? 0);

    supportPersonaChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: palette,
                    hoverOffset: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
            },
        },
    });
}

function setSupportDrilldownSummary(message) {
    const summary = document.getElementById('supportInsightsDrilldownSummary');

    if (summary) {
        summary.textContent = message;
    }
}

function syncHighlightToggleAvailability() {
    const interactionSelect = document.getElementById('supportInsightsDrilldownInteraction');
    const highlightToggle = document.getElementById('supportInsightsDrilldownHighlight');

    syncHighlightToggleAvailability();

    if (!highlightToggle) {
        return;
    }

    const allowsHighlight = !interactionSelect || interactionSelect.value === '' || interactionSelect.value === 'cta_clicked';

    highlightToggle.disabled = !allowsHighlight;

    if (!allowsHighlight && highlightToggle.checked) {
        highlightToggle.checked = false;
    }
}

function syncSupportDrilldownFilters() {
    const sourceWindow = document.getElementById('supportInsightsWindow');
    const sourcePersona = document.getElementById('supportInsightsPersona');
    const drilldownWindow = document.getElementById('supportInsightsDrilldownWindow');
    const drilldownPersona = document.getElementById('supportInsightsDrilldownPersona');
    const drilldownInteraction = document.getElementById('supportInsightsDrilldownInteraction');
    const drilldownHighlight = document.getElementById('supportInsightsDrilldownHighlight');

    if (sourceWindow && drilldownWindow) {
        drilldownWindow.value = sourceWindow.value ?? '30';
    }

    if (sourcePersona && drilldownPersona) {
        drilldownPersona.value = sourcePersona.value ?? '';
    }

    if (drilldownInteraction) {
        drilldownInteraction.value = '';
    }

    if (drilldownHighlight) {
        drilldownHighlight.checked = false;
        drilldownHighlight.disabled = false;
    }

    syncHighlightToggleAvailability();
}

function openSupportDrilldown(supportType, supportLabel) {
    if (!supportType) {
        return;
    }

    const normalizedLabel = supportLabel && typeof supportLabel === 'string'
        ? supportLabel
        : formatSupportLabel(supportType);

    supportDrilldownState.supportType = supportType;
    supportDrilldownState.supportLabel = normalizedLabel;
    supportDrilldownState.page = 1;
    supportDrilldownState.hasMore = false;
    supportDrilldownState.windowDays = 30;
    supportDrilldownState.interaction = null;
    supportDrilldownState.highlighted = false;

    const title = document.getElementById('supportInsightsDrilldownLabel');
    if (title) {
        title.textContent = `Support Engagement · ${normalizedLabel}`;
    }

    syncSupportDrilldownFilters();
    setSupportDrilldownSummary('Loading engagement events…');

    const modalElement = document.getElementById('supportInsightsDrilldownModal');
    if (!modalElement || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        return;
    }

    supportDrilldownModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    supportDrilldownModalInstance.show();
    loadSupportDrilldown(1);
}

function loadSupportDrilldown(page = 1) {
    if (!supportDrilldownState.supportType) {
        return;
    }

    const tableBody = document.getElementById('supportInsightsDrilldownTable');
    const emptyState = document.getElementById('supportInsightsDrilldownEmpty');
    const paginationMeta = document.getElementById('supportInsightsDrilldownPaginationMeta');
    const refreshButton = document.getElementById('supportInsightsDrilldownRefresh');
    const windowSelect = document.getElementById('supportInsightsDrilldownWindow');
    const personaSelect = document.getElementById('supportInsightsDrilldownPersona');
    const interactionSelect = document.getElementById('supportInsightsDrilldownInteraction');
    const highlightToggle = document.getElementById('supportInsightsDrilldownHighlight');

    const windowDays = Number.parseInt(windowSelect?.value ?? '30', 10);
    const effectiveWindow = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 30;

    supportDrilldownState.windowDays = effectiveWindow;

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading events…</td></tr>';
    }

    if (emptyState) {
        emptyState.classList.add('d-none');
    }

    if (paginationMeta) {
        paginationMeta.textContent = '';
    }

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (effectiveWindow - 1));

    const params = new URLSearchParams();
    params.set('support', supportDrilldownState.supportType);
    params.set('from', fromDate.toISOString());
    params.set('page', page.toString());
    params.set('limit', '25');

    const personaValue = personaSelect?.value ?? '';
    if (personaValue) {
        params.set('persona', personaValue);
    }

    const interactionValue = interactionSelect?.value ?? '';
    if (interactionValue) {
        params.set('interaction', interactionValue);
    }

    const highlightActive = Boolean(highlightToggle?.checked) && (interactionValue === '' || interactionValue === 'cta_clicked') && !highlightToggle.disabled;
    if (highlightActive) {
        params.set('highlighted', '1');
    }

    supportDrilldownState.interaction = interactionValue || null;
    supportDrilldownState.highlighted = highlightActive;

    setSupportDrilldownSummary(`Loading ${supportDrilldownState.supportLabel ?? 'support'} engagement…`);

    const endpointUrl = new URL(supportInsightsEventsEndpoint, window.location.origin);
    params.forEach((value, key) => {
        endpointUrl.searchParams.set(key, value);
    });

    fetch(endpointUrl.toString(), {
        headers: {
            'Accept': 'application/json',
        },
        credentials: 'same-origin',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to load support drilldown');
            }

            return response.json();
        })
        .then((payload) => {
            const events = Array.isArray(payload?.events) ? payload.events : [];
            const pagination = payload?.pagination ?? {};
            const range = payload?.range ?? null;
            const personaFilter = payload?.filters?.persona ?? null;
            const interactionFilter = payload?.filters?.interaction ?? null;
            const highlightedFilter = Boolean(payload?.filters?.highlighted ?? false);
            const totalEvents = Number(payload?.meta?.total_events ?? NaN);
            const counts = payload?.meta?.counts ?? null;

            const currentPage = Number.isFinite(pagination?.current_page)
                ? Number(pagination.current_page)
                : page;
            const hasMore = Boolean(pagination?.has_more);

            supportDrilldownState.page = currentPage;
            supportDrilldownState.hasMore = hasMore;

            renderSupportDrilldownEvents(tableBody, events);

            if (emptyState) {
                if (!events.length) {
                    emptyState.classList.remove('d-none');
                } else {
                    emptyState.classList.add('d-none');
                }
            }

            updateSupportDrilldownPagination({
                current_page: currentPage,
                has_more: hasMore,
            });

            if (paginationMeta) {
                paginationMeta.textContent = hasMore
                    ? `Page ${currentPage} · more available`
                    : `Page ${currentPage}`;
            }

            if (range) {
                const personaSegment = personaFilter
                    ? ` · Persona: ${formatPersonaLabel(personaFilter)}`
                    : '';
                const interactionSegment = interactionFilter
                    ? ` · Interaction: ${formatSupportInteraction(interactionFilter)}`
                    : '';
                const highlightSegment = highlightedFilter
                    ? ' · Highlighted CTA only'
                    : '';
                const totalSegment = Number.isFinite(totalEvents)
                    ? ` · ${Number(totalEvents).toLocaleString()} events`
                    : '';

                setSupportDrilldownSummary(`${supportDrilldownState.supportLabel ?? 'Support'} · ${formatReadableDate(range.from)} → ${formatReadableDate(range.to)}${personaSegment}${interactionSegment}${highlightSegment}${totalSegment}`);
            } else {
                setSupportDrilldownSummary(`Showing recent engagement for ${supportDrilldownState.supportLabel ?? 'support'}.`);
            }

            updateSupportDrilldownCounts(counts);
        })
        .catch((error) => {
            console.error(error);

            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Unable to load events.</td></tr>';
            }

            if (emptyState) {
                emptyState.classList.add('d-none');
            }

            updateSupportDrilldownPagination({ current_page: page, has_more: false });
            setSupportDrilldownSummary('Unable to load engagement events. Try again soon.');
            updateSupportDrilldownCounts(null);
        })
        .finally(() => {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        });
}

function renderSupportDrilldownEvents(container, events) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!Array.isArray(events) || !events.length) {
        container.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No events recorded.</td></tr>';
        return;
    }

    events.forEach((event) => {
        const row = document.createElement('tr');

        const occurredCell = document.createElement('td');
        occurredCell.textContent = formatReadableDateTime(event.occurred_at);
        row.appendChild(occurredCell);

        const interactionCell = document.createElement('td');
        interactionCell.textContent = formatSupportInteraction(event.interaction);
        row.appendChild(interactionCell);

        const personaCell = document.createElement('td');
        personaCell.textContent = formatPersonaList(event.persona_flags);
        row.appendChild(personaCell);

        const ctaCell = document.createElement('td');
        ctaCell.textContent = event.cta_label ?? '—';
        row.appendChild(ctaCell);

        const userCell = document.createElement('td');
        userCell.textContent = event.user_id ? `#${event.user_id}` : '—';
        row.appendChild(userCell);

        const highlightCell = document.createElement('td');
        if (event.highlighted) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-warning text-dark';
            badge.textContent = 'Yes';
            highlightCell.appendChild(badge);
        } else {
            highlightCell.textContent = 'No';
        }
        row.appendChild(highlightCell);

        container.appendChild(row);
    });
}

function updateSupportDrilldownCounts(counts) {
    const ctaElement = document.getElementById('supportInsightsDrilldownCtaTotal');
    const nudgeElement = document.getElementById('supportInsightsDrilldownNudgeTotal');
    const highlightElement = document.getElementById('supportInsightsDrilldownHighlightTotal');

    const safeCounts = counts && typeof counts === 'object'
        ? counts
        : null;

    if (ctaElement) {
        ctaElement.textContent = safeCounts?.cta_clicks !== undefined
            ? Number(safeCounts.cta_clicks).toLocaleString()
            : '—';
    }

    if (nudgeElement) {
        nudgeElement.textContent = safeCounts?.nudge_dismissed !== undefined
            ? Number(safeCounts.nudge_dismissed).toLocaleString()
            : '—';
    }

    if (highlightElement) {
        highlightElement.textContent = safeCounts?.highlighted_cta !== undefined
            ? Number(safeCounts.highlighted_cta).toLocaleString()
            : '—';
    }
}

function updateSupportDrilldownPagination(pagination) {
    const prevButton = document.getElementById('supportInsightsDrilldownPrev');
    const nextButton = document.getElementById('supportInsightsDrilldownNext');

    const currentPage = Number.isFinite(pagination?.current_page)
        ? Number(pagination.current_page)
        : 1;
    const hasMore = Boolean(pagination?.has_more);

    if (prevButton) {
        prevButton.disabled = currentPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = !hasMore;
    }
}

function formatPersonaList(flags) {
    if (!Array.isArray(flags) || !flags.length) {
        return '—';
    }

    return flags
        .map((persona) => formatPersonaLabel(persona))
        .join(', ');
}

function formatSupportInteraction(interaction) {
    if (!interaction) {
        return '—';
    }

    return interaction
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSupportLabel(type) {
    if (!type) {
        return '—';
    }

    const map = {
        @foreach(config('womenrise.supports', []) as $key => $support)
            '{{ $key }}': @json($support['label'] ?? ucfirst($key)),
        @endforeach
    };

    return map[type] ?? type.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPersonaLabel(persona) {
    if (!persona) {
        return '—';
    }

    const map = {
        @foreach(config('womenrise.personas', []) as $key => $persona)
            '{{ $key }}': @json($persona['label'] ?? ucfirst(str_replace('-', ' ', $key))),
        @endforeach
    };

    return map[persona] ?? persona.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatShortDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function loadLeadTelemetrySummary() {
    const rangeLabel = document.getElementById('leadTelemetryRange');
    const eventsBody = document.getElementById('leadTelemetryEvents');
    const emptyState = document.getElementById('leadTelemetryEmpty');
    const content = document.getElementById('leadTelemetryContent');
    const refreshButton = document.getElementById('leadTelemetryRefresh');
    const canvas = document.getElementById('leadTelemetryTimeline');
    const windowSelect = document.getElementById('leadTelemetryWindow');
    const eventSelect = document.getElementById('leadTelemetryEvent');
    const exportLink = document.getElementById('leadTelemetryExport');

    if (!rangeLabel || !eventsBody || !emptyState || !content || !canvas || !eventSelect) {
        return;
    }

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    const windowDays = Number.parseInt(windowSelect?.value ?? '30', 10);
    const effectiveDays = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 30;

    const focusEventValue = eventSelect.value !== '' ? eventSelect.value : null;

    rangeLabel.textContent = focusEventValue
        ? `Refreshing last ${effectiveDays} days for ${normalizeEventName(focusEventValue)}…`
        : `Refreshing last ${effectiveDays} days…`;

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (effectiveDays - 1));

    const summaryUrl = new URL(leadTelemetrySummaryEndpoint, window.location.origin);
    summaryUrl.searchParams.set('from', fromDate.toISOString());
    if (focusEventValue) {
        summaryUrl.searchParams.set('event', focusEventValue);
    }

    const summaryEndpoint = summaryUrl.toString();

    const exportUrl = new URL(summaryEndpoint);
    exportUrl.searchParams.set('format', 'csv');
    const exportEndpoint = exportUrl.toString();

    if (exportLink) {
        exportLink.href = exportEndpoint;
    }

    const headers = {
        'X-Requested-With': 'XMLHttpRequest',
    };

    const csrf = document.querySelector('meta[name="csrf-token"]');
    if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf.getAttribute('content') || '';
    }

    fetch(summaryEndpoint, {
        method: 'GET',
        headers,
        credentials: 'include',
    })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load lead telemetry')))
        .then(data => {
            const fromBound = data?.range?.from ?? fromDate.toISOString();
            const toBound = data?.range?.to ?? now.toISOString();
            const meta = data?.meta ?? {};
            const focusEvent = meta.focus_event ?? null;
            const availableEvents = Array.isArray(meta.available_events) ? meta.available_events : [];
            const recentEvents = Array.isArray(data.recent) ? data.recent : [];
            const topSources = Array.isArray(meta.top_sources) ? meta.top_sources : [];
            const topOrganizations = Array.isArray(meta.top_organizations) ? meta.top_organizations : [];
            const activeFilters = meta.active_filters && typeof meta.active_filters === 'object'
                ? meta.active_filters
                : {};

            const baseRange = focusEvent
                ? `Window: ${formatReadableDate(fromBound)} → ${formatReadableDate(toBound)} · Focus: ${normalizeEventName(focusEvent)}`
                : `Window: ${formatReadableDate(fromBound)} → ${formatReadableDate(toBound)}`;

            const filterSegments = [];
            if (activeFilters.source) {
                filterSegments.push(`Source: ${activeFilters.source}`);
            }
            if (activeFilters.organization) {
                filterSegments.push(`Organization: ${activeFilters.organization}`);
            }

            rangeLabel.textContent = filterSegments.length
                ? `${baseRange} · ${filterSegments.join(' · ')}`
                : baseRange;

            const allEvents = Array.isArray(data.events) ? data.events : [];
            const filteredEvents = focusEvent
                ? allEvents.filter(item => item.event === focusEvent)
                : allEvents;
            const events = filteredEvents.slice(0, 6);
            const timelinePoints = Array.isArray(data.timeline) ? data.timeline : [];

            const totalEvents = Number.isFinite(meta.total) ? Number(meta.total) : allEvents.reduce((sum, item) => {
                const numericValue = Number(item?.total ?? 0);
                return sum + (Number.isFinite(numericValue) ? numericValue : 0);
            }, 0);

            const averagePerDay = Number.isFinite(meta.average_per_day)
                ? Number(meta.average_per_day)
                : (timelinePoints.length > 0
                    ? totalEvents / timelinePoints.length
                    : (totalEvents > 0 ? totalEvents : 0));

            const topEventName = focusEvent
                ? focusEvent
                : (filteredEvents[0]?.event ?? null);

            leadTelemetryState = {
                focusEvent,
                availableEvents,
            };
            updateLeadTelemetryEventOptions(availableEvents, focusEvent, document.getElementById('leadTelemetryDrilldownEvent'));
            updateLeadTelemetryEventOptions(availableEvents, focusEvent, eventSelect);

            updateLeadTelemetryHighlights(totalEvents, averagePerDay, topEventName, meta.conversion_rate ?? null);
            updateLeadTelemetryRecent(recentEvents);
            updateLeadTelemetryTopSources(topSources);
            updateLeadTelemetryTopOrganizations(topOrganizations);

            eventsBody.innerHTML = '';

            if (!events.length) {
                emptyState.classList.remove('d-none');
                content.classList.add('d-none');
                eventsBody.innerHTML = '';
            } else {
                emptyState.classList.add('d-none');
                content.classList.remove('d-none');

                events.forEach(item => {
                    const row = document.createElement('tr');
                    const eventCell = document.createElement('td');
                    eventCell.textContent = normalizeEventName(item.event);
                    row.appendChild(eventCell);

                    const totalCell = document.createElement('td');
                    totalCell.textContent = item.total?.toLocaleString?.() ?? item.total;
                    row.appendChild(totalCell);

                    const lastSeenCell = document.createElement('td');
                    lastSeenCell.textContent = item.last_seen ? formatReadableDateTime(item.last_seen) : '—';
                    row.appendChild(lastSeenCell);

                    eventsBody.appendChild(row);
                });
            }

            const labels = timelinePoints.map(point => point.date);
            const totals = timelinePoints.map(point => Number(point.total ?? 0));

            if (!labels.length) {
                labels.push('No data');
                totals.push(0);
            }

            const context = canvas.getContext('2d');

            if (!leadTelemetryChart) {
                leadTelemetryChart = new Chart(context, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Lead Events',
                            data: totals,
                            borderColor: 'rgb(126, 58, 242)',
                            backgroundColor: 'rgba(126, 58, 242, 0.15)',
                            fill: true,
                            tension: 0.3,
                        }],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0,
                                },
                            },
                        },
                    },
                });
            } else {
                leadTelemetryChart.data.labels = labels;
                leadTelemetryChart.data.datasets[0].data = totals;
                leadTelemetryChart.update();
            }
        })
        .catch(() => {
            rangeLabel.textContent = 'Unable to load lead telemetry.';
            eventsBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Unable to retrieve lead telemetry.</td></tr>';
            emptyState.classList.add('d-none');
            content.classList.remove('d-none');
            updateLeadTelemetryHighlights(null, null, null, null);
            updateLeadTelemetryRecent(null);
        })
        .finally(() => {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        });
}

function updateLeadTelemetryEventOptions(availableEvents, focusEvent, eventSelect) {
    if (!eventSelect) {
        return;
    }

    const existingOptions = Array.from(eventSelect.options).map(option => option.value);
    const normalizedAvailable = Array.isArray(availableEvents) ? availableEvents : [];

    const shouldRebuild = normalizedAvailable.length + 1 !== existingOptions.length
        || normalizedAvailable.some(event => !existingOptions.includes(event));

    if (shouldRebuild) {
        eventSelect.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All events';
        eventSelect.appendChild(allOption);

        normalizedAvailable.forEach(eventName => {
            const option = document.createElement('option');
            option.value = eventName;
            option.textContent = normalizeEventName(eventName);
            eventSelect.appendChild(option);
        });
    }

    const desiredValue = focusEvent ?? '';

    if (eventSelect.value !== desiredValue) {
        eventSelect.value = desiredValue;
    }
}

function loadLeadTelemetryDrilldown() {
    const modal = document.getElementById('leadTelemetryDrilldownModal');
    if (!modal) {
        return;
    }

    const rangeSelect = document.getElementById('leadTelemetryDrilldownWindow');
    const eventSelect = document.getElementById('leadTelemetryDrilldownEvent');
    const tableBody = document.getElementById('leadTelemetryDrilldownTable');
    const refreshButton = document.getElementById('leadTelemetryDrilldownRefresh');
    const sourceFilter = document.getElementById('leadTelemetryDrilldownSource');
    const orgFilter = document.getElementById('leadTelemetryDrilldownOrganization');

    if (!rangeSelect || !eventSelect || !tableBody) {
        return;
    }

    const totalDays = Number.parseInt(rangeSelect.value ?? '30', 10);
    const effectiveDays = Number.isFinite(totalDays) && totalDays > 0 ? totalDays : 30;
    const focusEvent = eventSelect.value !== '' ? eventSelect.value : null;
    const sourceValue = sourceFilter?.value ? sourceFilter.value.trim() : '';
    const organizationValue = orgFilter?.value ? orgFilter.value.trim() : '';

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Loading events…</td></tr>';

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (effectiveDays - 1));

    const drilldownUrl = new URL(leadTelemetrySummaryEndpoint, window.location.origin);
    drilldownUrl.searchParams.set('from', fromDate.toISOString());
    drilldownUrl.searchParams.set('limit', '500');
    if (focusEvent) {
        drilldownUrl.searchParams.set('event', focusEvent);
    }
    if (sourceValue) {
        drilldownUrl.searchParams.set('source', sourceValue);
    }
    if (organizationValue) {
        drilldownUrl.searchParams.set('organization', organizationValue);
    }

    const endpoint = drilldownUrl.toString();

    fetch(endpoint, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
    })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load drilldown data')))
        .then(data => {
            const recentEvents = Array.isArray(data.recent) ? data.recent : [];
            const availableEvents = Array.isArray(data.meta?.available_events) ? data.meta.available_events : [];
            const focus = data.meta?.focus_event ?? null;

            leadTelemetryDrilldownState = {
                focusEvent: focus,
                availableEvents,
            };

            updateLeadTelemetryEventOptions(availableEvents, focus, eventSelect);

            if (recentEvents.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No events found for this window.</td></tr>';
                return;
            }

            tableBody.innerHTML = '';

            recentEvents.forEach(entry => {
                const row = document.createElement('tr');

                const eventCell = document.createElement('td');
                eventCell.textContent = normalizeEventName(entry.event);
                row.appendChild(eventCell);

                const occurredCell = document.createElement('td');
                occurredCell.textContent = formatReadableDateTime(entry.occurred_at);
                row.appendChild(occurredCell);

                const sourceCell = document.createElement('td');
                sourceCell.textContent = entry.source ?? '—';
                row.appendChild(sourceCell);

                const organizationCell = document.createElement('td');
                organizationCell.textContent = extractTelemetryOrganization(entry.properties) ?? '—';
                row.appendChild(organizationCell);

                tableBody.appendChild(row);
            });
        })
        .catch(() => {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Unable to load events.</td></tr>';
        })
        .finally(() => {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        });
}

function updateLeadTelemetryHighlights(total, average, topEventName, conversionRate) {
    const totalElement = document.getElementById('leadTelemetryTotal');
    const averageElement = document.getElementById('leadTelemetryAverage');
    const topEventElement = document.getElementById('leadTelemetryTopEvent');
    const conversionElement = document.getElementById('leadTelemetryConversion');

    if (totalElement) {
        totalElement.textContent = Number.isFinite(total)
            ? Number(total).toLocaleString(undefined, { maximumFractionDigits: 0 })
            : '—';
    }

    if (averageElement) {
        averageElement.textContent = Number.isFinite(average)
            ? Number(average).toLocaleString(undefined, { maximumFractionDigits: 1 })
            : '—';
    }

    if (topEventElement) {
        topEventElement.textContent = topEventName
            ? normalizeEventName(topEventName)
            : '—';
    }

    if (conversionElement) {
        conversionElement.textContent = Number.isFinite(conversionRate)
            ? `${Number(conversionRate).toFixed(1)}%`
            : '—';
    }
}

function updateLeadTelemetryRecent(recentEvents) {
    const container = document.getElementById('leadTelemetryRecent');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!recentEvents || !Array.isArray(recentEvents) || recentEvents.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'list-group-item text-muted small';
        emptyItem.textContent = 'No recent lead events in this window.';
        container.appendChild(emptyItem);
        return;
    }

    recentEvents.forEach(entry => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex justify-content-between align-items-start flex-wrap gap-2';

    const primary = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = normalizeEventName(entry.event);
    primary.appendChild(title);

        const secondary = document.createElement('div');
        secondary.className = 'text-muted small text-end';
    secondary.textContent = formatReadableDateTime(entry.occurred_at);

        const metaLine = document.createElement('div');
        metaLine.className = 'small text-muted mt-1';
        const details = [];

        const organization = extractTelemetryOrganization(entry.properties);
        if (organization) {
            details.push(`Org: ${organization}`);
        }

        if (entry.source) {
            details.push(`Source: ${entry.source}`);
        }

        if (details.length === 0) {
            details.push('No additional metadata');
        }

        metaLine.textContent = details.join(' • ');

        primary.appendChild(metaLine);

        wrapper.appendChild(primary);
        wrapper.appendChild(secondary);

        listItem.appendChild(wrapper);
        container.appendChild(listItem);
    });
}

function extractTelemetryOrganization(properties) {
    if (!properties || typeof properties !== 'object') {
        return null;
    }

    const candidates = ['org_slug', 'organization', 'company', 'company_name'];

    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key]) {
            return String(properties[key]);
        }
    }

    return null;
}

function updateLeadTelemetryTopSources(topSources) {
    updateLeadTelemetryAggregationList('leadTelemetryTopSources', topSources, 'source');
}

function updateLeadTelemetryTopOrganizations(topOrganizations) {
    updateLeadTelemetryAggregationList('leadTelemetryTopOrganizations', topOrganizations, 'organization');
}

function updateLeadTelemetryAggregationList(elementId, items, labelKey) {
    const container = document.getElementById(elementId);

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!Array.isArray(items) || items.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'list-group-item text-muted small';
        emptyItem.textContent = 'No data for this window.';
        container.appendChild(emptyItem);
        return;
    }

    items.forEach(entry => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

        const label = entry && entry[labelKey] ? String(entry[labelKey]) : 'Unknown';
        const total = Number.isFinite(entry?.total)
            ? Number(entry.total).toLocaleString(undefined, { maximumFractionDigits: 0 })
            : '—';
        const percentage = Number.isFinite(entry?.percentage)
            ? `${Number(entry.percentage).toFixed(1)}%`
            : null;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        listItem.appendChild(labelSpan);

        const metricsSpan = document.createElement('span');
        metricsSpan.className = 'small text-muted';
        metricsSpan.textContent = percentage ? `${total} · ${percentage}` : total;
        listItem.appendChild(metricsSpan);

        container.appendChild(listItem);
    });
}

function normalizeEventName(eventName) {
    if (typeof eventName !== 'string') {
        return '—';
    }

    return eventName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatReadableDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatReadableDateTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Refresh cache
function refreshCache() {
    if (confirm('This will refresh all analytics data. Continue?')) {
        window.location.href = '{{ route("admin.analytics.refresh") }}';
    }
}

// Initialize all charts
document.addEventListener('DOMContentLoaded', function() {
    initTimeSeriesChart();
    initApplicationStatusChart();
    initCategoriesChart();
    initRevenueChart();
    initJobTypeChart();
    initGeographicChart();
    loadSupportInsights();
    loadLeadTelemetrySummary();

    const supportTable = document.getElementById('supportInsightsTable');
    if (supportTable) {
        supportTable.addEventListener('click', function (event) {
            const trigger = event.target.closest('.support-drilldown-trigger');
            if (!trigger) {
                return;
            }

            event.preventDefault();
            const supportType = trigger.dataset.supportDrilldown ?? '';
            const supportLabel = trigger.dataset.supportLabel ?? '';
            openSupportDrilldown(supportType, supportLabel);
        });
    }

    const supportRefresh = document.getElementById('supportInsightsDrilldownRefresh');
    if (supportRefresh) {
        supportRefresh.addEventListener('click', function () {
            loadSupportDrilldown(1);
        });
    }

    const supportPrev = document.getElementById('supportInsightsDrilldownPrev');
    if (supportPrev) {
        supportPrev.addEventListener('click', function () {
            if (supportDrilldownState.page > 1) {
                loadSupportDrilldown(supportDrilldownState.page - 1);
            }
        });
    }

    const supportNext = document.getElementById('supportInsightsDrilldownNext');
    if (supportNext) {
        supportNext.addEventListener('click', function () {
            if (supportDrilldownState.hasMore) {
                loadSupportDrilldown(supportDrilldownState.page + 1);
            }
        });
    }

    const supportPersonaSelect = document.getElementById('supportInsightsDrilldownPersona');
    if (supportPersonaSelect) {
        supportPersonaSelect.addEventListener('change', function () {
            if (supportDrilldownState.supportType) {
                loadSupportDrilldown(1);
            }
        });
    }

    const supportWindowSelect = document.getElementById('supportInsightsDrilldownWindow');
    if (supportWindowSelect) {
        supportWindowSelect.addEventListener('change', function () {
            if (supportDrilldownState.supportType) {
                loadSupportDrilldown(1);
            }
        });
    }

    const supportInteractionSelect = document.getElementById('supportInsightsDrilldownInteraction');
    if (supportInteractionSelect) {
        supportInteractionSelect.addEventListener('change', function () {
            syncHighlightToggleAvailability();
            if (supportDrilldownState.supportType) {
                loadSupportDrilldown(1);
            }
        });
    }

    const supportHighlightToggle = document.getElementById('supportInsightsDrilldownHighlight');
    if (supportHighlightToggle) {
        supportHighlightToggle.addEventListener('change', function () {
            if (supportDrilldownState.supportType) {
                loadSupportDrilldown(1);
            }
        });
    }

    const supportModalElement = document.getElementById('supportInsightsDrilldownModal');
    if (supportModalElement) {
        supportModalElement.addEventListener('hidden.bs.modal', function () {
            supportDrilldownState.supportType = null;
            supportDrilldownState.supportLabel = null;
            supportDrilldownState.page = 1;
            supportDrilldownState.hasMore = false;
            supportDrilldownState.interaction = null;
            supportDrilldownState.highlighted = false;
            setSupportDrilldownSummary('Select a support to review recent engagement events.');

            const tableBody = document.getElementById('supportInsightsDrilldownTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Choose a support to view events.</td></tr>';
            }

            const emptyState = document.getElementById('supportInsightsDrilldownEmpty');
            if (emptyState) {
                emptyState.classList.add('d-none');
            }

            const paginationMeta = document.getElementById('supportInsightsDrilldownPaginationMeta');
            if (paginationMeta) {
                paginationMeta.textContent = '';
            }

            updateSupportDrilldownCounts(null);
        });
    }

    const drilldownModal = document.getElementById('leadTelemetryDrilldownModal');
    if (drilldownModal) {
        drilldownModal.addEventListener('shown.bs.modal', function () {
            syncDrilldownSelectors();
            loadLeadTelemetryDrilldown();
        });
    }
});

function syncDrilldownSelectors() {
    const summaryEventSelect = document.getElementById('leadTelemetryEvent');
    const summaryWindowSelect = document.getElementById('leadTelemetryWindow');
    const drilldownEventSelect = document.getElementById('leadTelemetryDrilldownEvent');
    const drilldownWindowSelect = document.getElementById('leadTelemetryDrilldownWindow');
    const drilldownSource = document.getElementById('leadTelemetryDrilldownSource');
    const drilldownOrganization = document.getElementById('leadTelemetryDrilldownOrganization');

    if (summaryEventSelect && drilldownEventSelect) {
        drilldownEventSelect.value = summaryEventSelect.value ?? '';
        updateLeadTelemetryEventOptions(leadTelemetryState.availableEvents, leadTelemetryState.focusEvent, drilldownEventSelect);
    }

    if (summaryWindowSelect && drilldownWindowSelect) {
        drilldownWindowSelect.value = summaryWindowSelect.value ?? '30';
    }

    if (drilldownSource) {
        drilldownSource.value = '';
    }

    if (drilldownOrganization) {
        drilldownOrganization.value = '';
    }
}
</script>
@endpush



