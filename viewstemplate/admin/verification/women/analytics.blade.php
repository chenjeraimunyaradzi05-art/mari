@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Women Verification Analytics</h1>
            <div class="section-header-button">
                <button type="button" class="btn btn-outline-primary" id="analytics-refresh">
                    <i class="fas fa-sync-alt"></i> Refresh Now
                </button>
            </div>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
                <div class="breadcrumb-item">Women Verification</div>
                <div class="breadcrumb-item active">Analytics</div>
            </div>
        </div>

        @php
            $sla = $summary['sla'];
            $dropouts = $summary['dropouts'];
            $formatHours = static fn (?float $value): string => $value === null ? '—' : number_format($value, 2);
            $formatPercent = static fn (?float $value): string => $value === null ? '—' : number_format($value * 100, 1) . '%';
            $summaryForJs = $summary;
            $summaryForJs['generated_at'] = $summary['generated_at']->toIso8601String();
        @endphp

        <div class="section-body">
            <div class="row">
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-primary">
                            <i class="fas fa-hourglass-half"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Avg. Time to First Review</h4>
                            </div>
                            <div class="card-body" id="analytics-avg-hours">
                                {{ $formatHours($sla['average_hours'] ?? null) }} hrs
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-success">
                            <i class="fas fa-stopwatch"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Within {{ $summary['sla_threshold_hours'] }}h SLA</h4>
                            </div>
                            <div class="card-body" id="analytics-within-sla">
                                {{ $sla['within_sla'] }} / {{ $sla['total_reviewed'] }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Backlog &gt; SLA (Pending)</h4>
                            </div>
                            <div class="card-body" id="analytics-backlog-pending">
                                {{ $sla['backlog_over_sla'] }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-danger">
                            <i class="fas fa-balance-scale"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Compliance Backlog &gt; SLA</h4>
                            </div>
                            <div class="card-body" id="analytics-backlog-compliance">
                                {{ $sla['backlog_pending_compliance'] }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-info">
                            <i class="fas fa-user-slash"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Dropout Rate</h4>
                            </div>
                            <div class="card-body" id="analytics-dropout-rate">
                                {{ $formatPercent($dropouts['dropout_rate'] ?? null) }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-secondary">
                            <i class="fas fa-user-clock"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Pending &gt; {{ $summary['dropout_threshold_hours'] }}h</h4>
                            </div>
                            <div class="card-body" id="analytics-pending-threshold">
                                {{ $dropouts['pending_over_threshold'] }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-secondary">
                            <i class="fas fa-user-edit"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Info Requests &gt; {{ $summary['dropout_threshold_hours'] }}h</h4>
                            </div>
                            <div class="card-body" id="analytics-info-threshold">
                                {{ $dropouts['pending_information_over_threshold'] }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-md-6 col-sm-6 col-12">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-dark">
                            <i class="fas fa-times-circle"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Total Rejections</h4>
                            </div>
                            <div class="card-body" id="analytics-rejected-total">
                                {{ $dropouts['rejected_total'] }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>SLA Attainment</h4>
                        </div>
                        <div class="card-body">
                            <canvas id="analytics-sla-chart" height="220"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Dropout Composition</h4>
                        </div>
                        <div class="card-body">
                            <canvas id="analytics-dropout-chart" height="220"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Status Distribution</h4>
                        </div>
                        <div class="card-body">
                            <canvas id="analytics-status-chart" height="220"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Stage Distribution</h4>
                        </div>
                        <div class="card-body">
                            <canvas id="analytics-stage-chart" height="220"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Status Breakdown</h4>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-striped mb-0">
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th class="text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody id="analytics-status-tbody">
                                        @forelse($summary['status_breakdown'] as $status => $total)
                                            <tr>
                                                <td>{{ ucwords(str_replace('_', ' ', $status)) }}</td>
                                                <td class="text-right">{{ $total }}</td>
                                            </tr>
                                        @empty
                                            <tr>
                                                <td colspan="2" class="text-center">No data yet.</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 col-12">
                    <div class="card">
                        <div class="card-header">
                            <h4>Stage Breakdown</h4>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-striped mb-0">
                                    <thead>
                                        <tr>
                                            <th>Stage</th>
                                            <th class="text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody id="analytics-stage-tbody">
                                        @forelse($summary['stage_breakdown'] as $stage => $total)
                                            <tr>
                                                <td>{{ ucwords(str_replace('_', ' ', $stage)) }}</td>
                                                <td class="text-right">{{ $total }}</td>
                                            </tr>
                                        @empty
                                            <tr>
                                                <td colspan="2" class="text-center">No data yet.</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    <div class="alert alert-light">
                        <i class="fas fa-info-circle"></i>
                        Analytics refreshed at <span id="analytics-generated-at">{{ $summary['generated_at']->format('Y-m-d H:i:s') }}</span>.
                        SLA threshold <span id="analytics-sla-threshold">{{ $summary['sla_threshold_hours'] }}</span>h · Dropout threshold <span id="analytics-dropout-threshold">{{ $summary['dropout_threshold_hours'] }}</span>h.
                        Auto refresh every {{ (int) ($refreshIntervalMs / 1000) }}s.
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const summaryEndpoint = @json(route('admin.women.verification.analytics'));
            const refreshInterval = {{ (int) $refreshIntervalMs }};
            let state = @json($summaryForJs);
            const charts = {};
            let isFetching = false;

            const toNumber = (value) => {
                if (value === null || value === undefined) {
                    return null;
                }

                const numeric = Number(value);

                return Number.isFinite(numeric) ? numeric : null;
            };

            const formatHours = (value) => {
                const numeric = toNumber(value);

                return numeric === null ? '—' : numeric.toFixed(2);
            };

            const formatPercent = (value) => {
                const numeric = toNumber(value);

                return numeric === null ? '—' : (numeric * 100).toFixed(1) + '%';
            };

            const formatLabel = (value) => value
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (letter) => letter.toUpperCase());

            const updateCards = (summary) => {
                const sla = summary.sla ?? {};
                const dropouts = summary.dropouts ?? {};

                const avgHoursEl = document.getElementById('analytics-avg-hours');
                if (avgHoursEl) {
                    avgHoursEl.textContent = formatHours(sla.average_hours) + ' hrs';
                }

                const withinSlaEl = document.getElementById('analytics-within-sla');
                if (withinSlaEl) {
                    const within = toNumber(sla.within_sla) ?? 0;
                    const total = toNumber(sla.total_reviewed) ?? 0;
                    withinSlaEl.textContent = `${within} / ${total}`;
                }

                const backlogPendingEl = document.getElementById('analytics-backlog-pending');
                if (backlogPendingEl) {
                    backlogPendingEl.textContent = String(toNumber(sla.backlog_over_sla) ?? 0);
                }

                const backlogComplianceEl = document.getElementById('analytics-backlog-compliance');
                if (backlogComplianceEl) {
                    backlogComplianceEl.textContent = String(toNumber(sla.backlog_pending_compliance) ?? 0);
                }

                const dropoutRateEl = document.getElementById('analytics-dropout-rate');
                if (dropoutRateEl) {
                    dropoutRateEl.textContent = formatPercent(dropouts.dropout_rate ?? null);
                }

                const pendingThresholdEl = document.getElementById('analytics-pending-threshold');
                if (pendingThresholdEl) {
                    pendingThresholdEl.textContent = String(toNumber(dropouts.pending_over_threshold) ?? 0);
                }

                const infoThresholdEl = document.getElementById('analytics-info-threshold');
                if (infoThresholdEl) {
                    infoThresholdEl.textContent = String(toNumber(dropouts.pending_information_over_threshold) ?? 0);
                }

                const rejectedEl = document.getElementById('analytics-rejected-total');
                if (rejectedEl) {
                    rejectedEl.textContent = String(toNumber(dropouts.rejected_total) ?? 0);
                }

                const generatedAtEl = document.getElementById('analytics-generated-at');
                if (generatedAtEl) {
                    const timestamp = summary.generated_at;
                    const parsed = timestamp ? new Date(timestamp) : null;

                    generatedAtEl.textContent = parsed && !Number.isNaN(parsed.valueOf())
                        ? parsed.toLocaleString()
                        : '—';
                }

                const slaThresholdEl = document.getElementById('analytics-sla-threshold');
                if (slaThresholdEl) {
                    slaThresholdEl.textContent = String(toNumber(summary.sla_threshold_hours) ?? 0);
                }

                const dropoutThresholdEl = document.getElementById('analytics-dropout-threshold');
                if (dropoutThresholdEl) {
                    dropoutThresholdEl.textContent = String(toNumber(summary.dropout_threshold_hours) ?? 0);
                }
            };

            const renderTable = (elementId, breakdown) => {
                const tbody = document.getElementById(elementId);

                if (!tbody) {
                    return;
                }

                const entries = Object.entries(breakdown ?? {});

                if (entries.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="2" class="text-center">No data yet.</td></tr>';

                    return;
                }

                tbody.innerHTML = entries
                    .map(([key, total]) => {
                        const formattedLabel = formatLabel(String(key));
                        const formattedTotal = String(toNumber(total) ?? 0);

                        return `<tr><td>${formattedLabel}</td><td class="text-right">${formattedTotal}</td></tr>`;
                    })
                    .join('');
            };

            const updateTables = (summary) => {
                renderTable('analytics-status-tbody', summary.status_breakdown);
                renderTable('analytics-stage-tbody', summary.stage_breakdown);
            };

            const updateCharts = (summary) => {
                const sla = summary.sla ?? {};
                const dropouts = summary.dropouts ?? {};

                if (charts.sla) {
                    const within = toNumber(sla.within_sla) ?? 0;
                    const total = toNumber(sla.total_reviewed) ?? 0;
                    const breaches = Math.max(total - within, 0);

                    charts.sla.data.datasets[0].data = [within, breaches];
                    charts.sla.update();
                }

                if (charts.dropout) {
                    charts.dropout.data.datasets[0].data = [
                        toNumber(dropouts.pending_over_threshold) ?? 0,
                        toNumber(dropouts.pending_information_over_threshold) ?? 0,
                        toNumber(dropouts.rejected_total) ?? 0,
                    ];
                    charts.dropout.update();
                }

                if (charts.status) {
                    const entries = Object.entries(summary.status_breakdown ?? {});
                    charts.status.data.labels = entries.map(([label]) => formatLabel(String(label)));
                    charts.status.data.datasets[0].data = entries.map(([, value]) => toNumber(value) ?? 0);
                    charts.status.update();
                }

                if (charts.stage) {
                    const entries = Object.entries(summary.stage_breakdown ?? {});
                    charts.stage.data.labels = entries.map(([label]) => formatLabel(String(label)));
                    charts.stage.data.datasets[0].data = entries.map(([, value]) => toNumber(value) ?? 0);
                    charts.stage.update();
                }
            };

            const render = (summary) => {
                updateCards(summary);
                updateTables(summary);
                updateCharts(summary);
            };

            const initCharts = (summary) => {
                if (typeof Chart === 'undefined') {
                    console.warn('Chart.js is not loaded, skipping analytics charts.');

                    return;
                }

                const slaCanvas = document.getElementById('analytics-sla-chart');
                if (slaCanvas) {
                    charts.sla = new Chart(slaCanvas.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Within SLA', 'Breached SLA'],
                            datasets: [{
                                data: [0, 0],
                                backgroundColor: ['#47c363', '#fc544b'],
                                borderWidth: 0,
                            }],
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

                const dropoutCanvas = document.getElementById('analytics-dropout-chart');
                if (dropoutCanvas) {
                    charts.dropout = new Chart(dropoutCanvas.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Pending > threshold', 'Info request > threshold', 'Rejected'],
                            datasets: [{
                                data: [0, 0, 0],
                                backgroundColor: ['#6777ef', '#ffa426', '#fc544b'],
                                borderWidth: 0,
                            }],
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

                const statusCanvas = document.getElementById('analytics-status-chart');
                if (statusCanvas) {
                    charts.status = new Chart(statusCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: [],
                            datasets: [{
                                label: 'Agents',
                                backgroundColor: '#47c363',
                                borderColor: '#47c363',
                                data: [],
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        precision: 0,
                                    },
                                },
                            },
                            plugins: {
                                legend: {
                                    display: false,
                                },
                            },
                        },
                    });
                }

                const stageCanvas = document.getElementById('analytics-stage-chart');
                if (stageCanvas) {
                    charts.stage = new Chart(stageCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: [],
                            datasets: [{
                                label: 'Agents',
                                backgroundColor: '#ffa426',
                                borderColor: '#ffa426',
                                data: [],
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        precision: 0,
                                    },
                                },
                            },
                            plugins: {
                                legend: {
                                    display: false,
                                },
                            },
                        },
                    });
                }

                updateCharts(summary);
            };

            initCharts(state);
            render(state);

            const refreshButton = document.getElementById('analytics-refresh');

            const refreshSummary = async () => {
                if (isFetching) {
                    return;
                }

                isFetching = true;

                if (refreshButton) {
                    refreshButton.disabled = true;
                    refreshButton.classList.add('disabled');
                }

                try {
                    const response = await fetch(summaryEndpoint, {
                        headers: {
                            'Accept': 'application/json',
                        },
                    });

                    if (!response.ok) {
                        throw new Error(`Analytics summary request failed with status ${response.status}`);
                    }

                    const data = await response.json();

                    state = {
                        ...data,
                    };

                    render(state);
                } catch (error) {
                    console.error('Failed to refresh women verification analytics summary', error);
                } finally {
                    isFetching = false;

                    if (refreshButton) {
                        refreshButton.disabled = false;
                        refreshButton.classList.remove('disabled');
                    }
                }
            };

            refreshButton?.addEventListener('click', (event) => {
                event.preventDefault();
                refreshSummary();
            });

            if (refreshInterval > 0) {
                setInterval(refreshSummary, refreshInterval);
            }
        });
    </script>
@endpush
