@extends('admin.layouts.master')



@section('contents')
<div class="realtime-dashboard">
    <!-- Connection Status -->
    <div class="connection-status disconnected" id="connectionStatus">
        <i class="fas fa-circle" id="statusIcon"></i>
        <span id="statusText">Connecting...</span>
    </div>

    <div class="alert alert-warning d-none hydration-alert" id="realtimeHydrationAlert">
        <i class="fas fa-exclamation-circle me-2"></i>
        <span id="realtimeHydrationMessage">Unable to refresh metrics.</span>
    </div>

    <!-- Header -->
    <div class="row mb-4">
        <div class="col-md-8">
            <h2 class="mb-0">
                <i class="fas fa-broadcast-tower" style="color: #E91E8C;"></i>
                Real-Time AI Performance Dashboard
            </h2>
            <p class="text-muted">Live monitoring of AI system metrics (updates every 5 seconds)</p>
            <div class="last-update-pill" id="lastUpdatePill">
                <i class="fas fa-clock"></i>
                <span id="lastUpdateText">Awaiting first update…</span>
            </div>
        </div>
        <div class="col-md-4 text-end">
            <button class="btn btn-outline-secondary" onclick="pauseUpdates()">
                <i class="fas fa-pause" id="pauseIcon"></i>
                <span id="pauseText">Pause</span>
            </button>
            <a href="{{ route('admin.ai-analytics.index') }}" class="btn btn-outline-primary">
                <i class="fas fa-chart-bar"></i> Analytics
            </a>
        </div>
    </div>

    <!-- Real-time Metrics Cards -->
    <div class="row g-3 mb-4">
        <!-- Requests Per Minute -->
        <div class="col-md-3">
            <div class="metric-card">
                <div class="metric-label">
                    <i class="fas fa-tachometer-alt"></i> Requests/Minute
                </div>
                <div class="metric-value" id="requestsPerMinute">0</div>
                <div class="metric-change" id="requestsChange">
                    <i class="fas fa-minus"></i> No change
                </div>
            </div>
        </div>

        <!-- Response Time -->
        <div class="col-md-3">
            <div class="metric-card">
                <div class="metric-label">
                    <i class="fas fa-clock"></i> Avg Response Time
                </div>
                <div class="metric-value" id="responseTime">0ms</div>
                <div class="metric-change" id="responseChange">
                    <i class="fas fa-minus"></i> No change
                </div>
            </div>
        </div>

        <!-- Cache Hit Rate -->
        <div class="col-md-3">
            <div class="metric-card">
                <div class="metric-label">
                    <i class="fas fa-database"></i> Cache Hit Rate
                </div>
                <div class="metric-value" id="cacheHitRate">0%</div>
                <div class="metric-change" id="cacheChange">
                    <i class="fas fa-minus"></i> No change
                </div>
            </div>
        </div>

        <!-- Error Rate -->
        <div class="col-md-3">
            <div class="metric-card">
                <div class="metric-label">
                    <i class="fas fa-exclamation-triangle"></i> Error Rate
                </div>
                <div class="metric-value" id="errorRate">0%</div>
                <div class="metric-change" id="errorChange">
                    <i class="fas fa-minus"></i> No change
                </div>
            </div>
        </div>
    </div>

    <!-- System Status -->
    <div class="row g-3 mb-4">
        <div class="col-md-12">
            <div class="metric-card">
                <h5>
                    <i class="fas fa-heartbeat"></i> System Status
                    <span class="status-indicator" id="systemStatusIndicator"></span>
                    <span id="systemStatusText">Loading...</span>
                </h5>
                <div class="row mt-3 gy-3">
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">Active Users</small>
                        <div class="h4 mb-0" id="activeUsers">0</div>
                    </div>
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">Concurrent Requests</small>
                        <div class="h4 mb-0" id="concurrentRequests">0</div>
                    </div>
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">Queue Size</small>
                        <div class="h4 mb-0" id="queueSize">0</div>
                    </div>
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">Memory Usage</small>
                        <div class="h4 mb-0" id="memoryUsage">—</div>
                    </div>
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">CPU Load</small>
                        <div class="h4 mb-0" id="cpuLoad">—</div>
                    </div>
                    <div class="col-6 col-md-4 col-xl-2">
                        <small class="text-muted">DB Connections</small>
                        <div class="h4 mb-0" id="databaseConnections">—</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Messaging CDN Health -->
    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="alert alert-danger d-flex align-items-center d-none" id="cdnRtAlert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <div>
                    <strong>Messaging CDN degraded.</strong>
                    <span id="cdnRtAlertSummary">No guardrails firing</span>
                </div>
            </div>
        </div>

        <div class="col-lg-8">
            <div class="metric-card h-100">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                    <div>
                        <h5 class="mb-0"><i class="fas fa-satellite-dish me-2" style="color:#E91E8C;"></i>Messaging CDN Health</h5>
                        <small class="text-muted">Guardrail signals from latency sampler</small>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <span class="badge bg-secondary" id="cdnRtStatus">UNKNOWN</span>
                        <span class="badge bg-success" id="cdnRtDegraded">Healthy</span>
                    </div>
                </div>

                <p class="text-muted mb-3" id="cdnRtSummary">No guardrails firing.</p>

                <div class="d-flex flex-wrap gap-2 mb-4" id="cdnRtSignals">
                    <span class="cdn-signal-badge healthy">All guardrails clear</span>
                </div>

                <div class="row g-3">
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Rolling Latency</small>
                        <div class="value" id="cdnRtRollingLatency">—</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Success Ratio</small>
                        <div class="value" id="cdnRtProbeRatio">—</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Failure Streak</small>
                        <div class="value" id="cdnRtFailureStreak">0</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Window Samples</small>
                        <div class="value" id="cdnRtSampleCount">0</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Last Sample Age</small>
                        <div class="value" id="cdnRtLastSampleAge">—</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Last Probe</small>
                        <div class="value" id="cdnRtLastProbeCode">—</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Probe Attempts</small>
                        <div class="value" id="cdnRtLastProbeAttempts">—</div>
                    </div>
                    <div class="col-md-3 col-6 cdn-mini-metric">
                        <small>Stale Flag</small>
                        <div class="value" id="cdnRtStaleFlag">No</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="metric-card h-100">
                <h5 class="mb-3"><i class="fas fa-wave-square me-2" style="color:#8B5CF6;"></i>Latency Distribution</h5>
                <div id="cdnRtHistogram">
                    <p class="text-muted mb-0">Awaiting samples...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Live Charts -->
    <div class="row g-3 mb-4">
        <!-- Request Rate Chart -->
        <div class="col-md-6">
            <div class="metric-card">
                <h5><i class="fas fa-chart-line"></i> Request Rate (Last 60 seconds)</h5>
                <div class="chart-container">
                    <canvas id="requestRateChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Response Time Chart -->
        <div class="col-md-6">
            <div class="metric-card">
                <h5><i class="fas fa-chart-area"></i> Response Time (Last 60 seconds)</h5>
                <div class="chart-container">
                    <canvas id="responseTimeChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Feature Usage & Error Log -->
    <div class="row g-3 mb-4">
        <!-- Feature Usage -->
        <div class="col-md-6">
            <div class="metric-card">
                <h5><i class="fas fa-tasks"></i> Feature Usage (Today)</h5>
                <div class="chart-container">
                    <canvas id="featureUsageChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Recent Errors -->
        <div class="col-md-6">
            <div class="metric-card">
                <h5><i class="fas fa-bug"></i> Recent Errors</h5>
                <div class="error-log" id="errorLog">
                    <p class="text-muted text-center">No errors to display</p>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-12">
            <div class="metric-card h-100">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
                    <div>
                        <h5 class="mb-0"><i class="fas fa-bell me-2" style="color:#E91E8C;"></i>Recent Client Alerts</h5>
                        <small class="text-muted">Latest issues surfaced directly from operator browsers</small>
                    </div>
                    <div class="d-flex flex-wrap gap-3 align-items-center">
                        <div>
                            <label for="realtimeAlertSeverityFilter" class="form-label small mb-1">Severity</label>
                            <select id="realtimeAlertSeverityFilter" class="form-select form-select-sm">
                                <option value="all">All</option>
                                <option value="critical">Critical</option>
                                <option value="error">Error</option>
                                <option value="warning">Warning</option>
                                <option value="info">Info</option>
                            </select>
                        </div>
                        <div class="form-check form-switch mt-3 mt-sm-0">
                            <input class="form-check-input" type="checkbox" role="switch" id="realtimeAlertHideAck">
                            <label class="form-check-label small" for="realtimeAlertHideAck">Hide acknowledged</label>
                        </div>
                        <span class="badge bg-light text-muted" id="clientAlertTally">{{ count($clientAlerts ?? []) }} tracked</span>
                    </div>
                </div>
                <div class="list-group" id="clientAlertStream">
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
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
<script src="https://js.pusher.com/8.2.0/pusher.min.js"></script>
<script>
    const metricsEndpoint = '{{ route('admin.ai-analytics.metrics') }}';
    const fallbackHydrationInterval = 30000;
    const numberFormatter = new Intl.NumberFormat('en-US');
    const alertEndpoint = '{{ route('admin.ai-analytics.alerts') }}';
    const alertAckBaseUrl = '{{ url("admin/ai-analytics/alerts") }}';
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const alertDispatchState = { lastSent: {} };
    const ALERT_THROTTLE_MS = 60000;
    const notificationState = { requested: false };
    const initialClientAlerts = @json($clientAlerts ?? []);
    const realtimeAlertState = {
        items: Array.isArray(initialClientAlerts) ? initialClientAlerts : [],
        filters: {
            severity: 'all',
            hideAcknowledged: false,
        }
    };

    // Initialize Pusher
    const pusher = new Pusher('{{ config('broadcasting.connections.pusher.key') }}', {
        cluster: '{{ config('broadcasting.connections.pusher.options.cluster') }}',
        encrypted: true
    });

    // Subscribe to AI metrics channel
    const channel = pusher.subscribe('ai-metrics');

    // Connection status tracking
    pusher.connection.bind('connected', function() {
        updateConnectionStatus(true);
    });

    pusher.connection.bind('disconnected', function() {
        updateConnectionStatus(false);
        emitClientAlert({
            source: 'ai-analytics.realtime.connection',
            severity: 'warning',
            message: 'Realtime dashboard lost connection to Pusher.',
            context: { timestamp: new Date().toISOString() }
        });
    });

    // Update connection status UI
    function updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');

        if (connected) {
            statusEl.className = 'connection-status connected';
            statusText.textContent = 'Connected';
            statusIcon.className = 'fas fa-circle text-success';
        } else {
            statusEl.className = 'connection-status disconnected';
            statusText.textContent = 'Disconnected';
            statusIcon.className = 'fas fa-circle text-danger';
        }
    }

    // Initialize charts
    const requestRateChart = new Chart(document.getElementById('requestRateChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Requests/min',
                data: [],
                borderColor: '#E91E8C',
                backgroundColor: 'rgba(233, 30, 140, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            animation: { duration: 500 }
        }
    });

    const responseTimeChart = new Chart(document.getElementById('responseTimeChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Response Time (ms)',
                data: [],
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            animation: { duration: 500 }
        }
    });

    const featureUsageChart = new Chart(document.getElementById('featureUsageChart'), {
        type: 'bar',
        data: {
            labels: ['Resume Parser', 'Job Matching', 'Career Insights', 'Smart Posting', 'CV Builder'],
            datasets: [{
                label: 'Usage Count',
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    '#E91E8C',
                    '#8B5CF6',
                    '#10B981',
                    '#F59E0B',
                    '#3B82F6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Previous values for change detection
    const previousValues = {
        requestsPerMinute: null,
        responseTime: null,
        cacheHitRate: null,
        errorRate: null
    };

    const lastUpdateState = {
        pill: document.getElementById('lastUpdatePill'),
        text: document.getElementById('lastUpdateText'),
        timestamp: null,
    };

    const hydrationAlert = {
        container: document.getElementById('realtimeHydrationAlert'),
        message: document.getElementById('realtimeHydrationMessage')
    };

    const clientAlertElements = {
        stream: document.getElementById('clientAlertStream'),
        tally: document.getElementById('clientAlertTally'),
        severity: document.getElementById('realtimeAlertSeverityFilter'),
        hideAck: document.getElementById('realtimeAlertHideAck')
    };

    if (clientAlertElements.severity) {
        clientAlertElements.severity.addEventListener('change', event => {
            realtimeAlertState.filters.severity = event.target.value || 'all';
            renderClientAlerts();
        });
    }

    if (clientAlertElements.hideAck) {
        clientAlertElements.hideAck.addEventListener('change', event => {
            realtimeAlertState.filters.hideAcknowledged = Boolean(event.target.checked);
            renderClientAlerts();
        });
    }

    const cdnRealtimeElements = {
        alertBanner: document.getElementById('cdnRtAlert'),
        alertSummary: document.getElementById('cdnRtAlertSummary'),
        statusBadge: document.getElementById('cdnRtStatus'),
        degradedBadge: document.getElementById('cdnRtDegraded'),
        summaryText: document.getElementById('cdnRtSummary'),
        signalsContainer: document.getElementById('cdnRtSignals'),
        histogramContainer: document.getElementById('cdnRtHistogram'),
        rollingLatency: document.getElementById('cdnRtRollingLatency'),
        probeRatio: document.getElementById('cdnRtProbeRatio'),
        failureStreak: document.getElementById('cdnRtFailureStreak'),
        sampleCount: document.getElementById('cdnRtSampleCount'),
        lastSampleAge: document.getElementById('cdnRtLastSampleAge'),
        lastProbeCode: document.getElementById('cdnRtLastProbeCode'),
        lastProbeAttempts: document.getElementById('cdnRtLastProbeAttempts'),
        staleFlag: document.getElementById('cdnRtStaleFlag')
    };

    function toNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function formatNumber(value, { decimals = 0, fallback = '—' } = {}) {
        const numeric = toNumber(value);

        if (numeric === null) {
            return fallback;
        }

        if (decimals > 0) {
            return numeric.toFixed(decimals);
        }

        return numberFormatter.format(numeric);
    }

    function formatMemoryUsage(value) {
        const numeric = toNumber(value);
        return numeric === null ? '—' : `${numeric.toFixed(1)} MB`;
    }

    function formatCpuLoad(value) {
        const numeric = toNumber(value);
        return numeric === null ? '—' : numeric.toFixed(2);
    }

    function setTextContent(elementId, value, fallback = '—') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value ?? fallback;
        }
    }

    function formatPercent(value) {
        const numeric = toNumber(value);
        if (numeric === null) {
            return '—';
        }
        return `${(numeric * 100).toFixed(1)}%`;
    }

    function formatLatency(value) {
        const numeric = toNumber(value);
        if (numeric === null) {
            return '—';
        }
        return `${Math.round(numeric)} ms`;
    }

    function renderSignalPills(container, signals) {
        container.innerHTML = '';

        if (!signals.length) {
            const pill = document.createElement('span');
            pill.className = 'cdn-signal-badge healthy';
            pill.textContent = 'All guardrails clear';
            container.appendChild(pill);
            return;
        }

        signals.forEach(signal => {
            const pill = document.createElement('span');
            pill.className = 'cdn-signal-badge';
            pill.dataset.signal = signal;
            pill.textContent = signal
                .replace(/_/g, ' ')
                .replace(/^\w/, letter => letter.toUpperCase());
            container.appendChild(pill);
        });
    }

    function renderHistogram(container, labels, histogram) {
        container.innerHTML = '';

        if (!labels.length) {
            const empty = document.createElement('p');
            empty.className = 'text-muted mb-0';
            empty.textContent = 'No samples recorded in the current window.';
            container.appendChild(empty);
            return;
        }

        labels.forEach(label => {
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
            container.appendChild(row);
        });
    }

    function setHydrationAlert(message = null) {
        if (!hydrationAlert.container) {
            return;
        }

        if (!message) {
            hydrationAlert.container.classList.add('d-none');
            return;
        }

        hydrationAlert.container.classList.remove('d-none');
        if (hydrationAlert.message) {
            hydrationAlert.message.textContent = message;
        }
    }

    function renderClientAlerts() {
        if (!clientAlertElements.stream) {
            return;
        }

        const entries = filterRealtimeAlerts();

        if (clientAlertElements.tally) {
            clientAlertElements.tally.textContent = `${realtimeAlertState.items.length} tracked`;
        }

        if (!entries.length) {
            clientAlertElements.stream.innerHTML = '<div class="list-group-item text-center text-muted py-4">No client alerts match the selected filters.</div>';
            return;
        }

        clientAlertElements.stream.innerHTML = entries.map(alert => {
            const severity = (alert.severity || 'warning').toLowerCase();
            const badgeClass = getSeverityBadgeClasses(severity);
            const timestamp = formatRelativeTimestamp(alert.received_at);
            const message = alert.message || 'No message provided';
            const source = alert.source || 'unknown';
            const acknowledged = Boolean(alert.acknowledged_at);
            const ackClass = acknowledged ? 'btn-success' : 'btn-outline-secondary';
            const ackLabel = acknowledged ? 'Acknowledged' : 'Acknowledge';
            const ackDisabled = acknowledged ? 'disabled' : '';

            return `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center gap-2">
                        <div class="d-flex gap-2 align-items-center">
                            <span class="${badgeClass}">${severity.toUpperCase()}</span>
                            ${acknowledged ? '<span class="badge bg-success">Acknowledged</span>' : ''}
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                            <small class="text-muted">${timestamp}</small>
                            <button class="btn btn-sm ${ackClass}" ${ackDisabled} onclick="acknowledgeRealtimeAlert(${alert.id})">
                                <i class="fas fa-check"></i> ${ackLabel}
                            </button>
                        </div>
                    </div>
                    <div class="fw-semibold mt-2">${message}</div>
                    <div class="text-muted small">Source: ${source}</div>
                </div>
            `;
        }).join('');
    }

    function filterRealtimeAlerts() {
        const severityFilter = realtimeAlertState.filters.severity;
        const hideAcknowledged = realtimeAlertState.filters.hideAcknowledged;

        return realtimeAlertState.items.filter(alert => {
            const severity = (alert.severity || 'warning').toLowerCase();
            const acknowledged = Boolean(alert.acknowledged_at);

            const matchesSeverity = severityFilter === 'all' || severity === severityFilter;
            const matchesAck = hideAcknowledged ? !acknowledged : true;

            return matchesSeverity && matchesAck;
        });
    }

    function setRealtimeAlerts(alerts) {
        realtimeAlertState.items = Array.isArray(alerts) ? alerts : [];
        renderClientAlerts();
    }

    function mergeRealtimeAlert(alert) {
        if (!alert || !alert.id) {
            return;
        }

        const existingIndex = realtimeAlertState.items.findIndex(item => item.id === alert.id);
        if (existingIndex >= 0) {
            realtimeAlertState.items[existingIndex] = alert;
        } else {
            realtimeAlertState.items.unshift(alert);
            realtimeAlertState.items = realtimeAlertState.items.slice(0, 50);
        }

        renderClientAlerts();
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

    function acknowledgeRealtimeAlert(alertId) {
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
                    mergeRealtimeAlert(data.alert);
                }
            })
            .catch(error => {
                console.error('Failed to acknowledge realtime alert:', error);
                emitClientAlert({
                    source: 'ai-analytics.realtime.ack',
                    severity: 'error',
                    message: 'Unable to acknowledge realtime alert. Please retry.',
                    context: { error: String(error), alertId }
                });
            });
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

    function updateCdnHealth(cdn = {}) {
        if (!cdnRealtimeElements.alertBanner) {
            return;
        }

        const degraded = Boolean(cdn.degraded);
        const signals = Array.isArray(cdn.latency_degraded_signals) ? cdn.latency_degraded_signals : [];
        const histogram = cdn.latency_histogram || {};
        const histogramLabels = Array.isArray(cdn.latency_histogram_labels) && cdn.latency_histogram_labels.length
            ? cdn.latency_histogram_labels
            : Object.keys(histogram);

        cdnRealtimeElements.alertBanner.classList.toggle('d-none', !degraded);
        cdnRealtimeElements.alertSummary.textContent = cdn.latency_degraded_summary || 'No guardrails firing';
        cdnRealtimeElements.summaryText.textContent = cdn.latency_degraded_summary || 'No guardrails firing.';
        cdnRealtimeElements.statusBadge.textContent = (cdn.status || 'unknown').toUpperCase();
        cdnRealtimeElements.degradedBadge.textContent = degraded ? 'Degraded' : 'Healthy';
        cdnRealtimeElements.degradedBadge.classList.toggle('bg-danger', degraded);
        cdnRealtimeElements.degradedBadge.classList.toggle('bg-success', !degraded);

        cdnRealtimeElements.rollingLatency.textContent = formatLatency(cdn.rolling_latency_ms);
        cdnRealtimeElements.probeRatio.textContent = formatPercent(cdn.probe_success_ratio ?? null);
        cdnRealtimeElements.failureStreak.textContent = cdn.failure_streak ?? 0;
        cdnRealtimeElements.sampleCount.textContent = cdn.window_sample_count ?? 0;
        cdnRealtimeElements.lastSampleAge.textContent = typeof cdn.last_sample_age_seconds === 'number'
            ? `${cdn.last_sample_age_seconds}s`
            : '—';
        cdnRealtimeElements.lastProbeCode.textContent = cdn.last_probe_status_code ?? '—';
        cdnRealtimeElements.lastProbeAttempts.textContent = cdn.last_probe_attempts ?? '—';
        cdnRealtimeElements.staleFlag.textContent = cdn.latency_stale ? 'Yes' : 'No';

        renderSignalPills(cdnRealtimeElements.signalsContainer, signals);
        renderHistogram(cdnRealtimeElements.histogramContainer, histogramLabels, histogram);
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
            return remainingSeconds
                ? `${minutes}m ${remainingSeconds}s ago`
                : `${minutes}m ago`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes
            ? `${hours}h ${remainingMinutes}m ago`
            : `${hours}h ago`;
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

    function refreshLastUpdateDisplay() {
        if (!lastUpdateState.text || !lastUpdateState.pill) {
            return;
        }

        if (!lastUpdateState.timestamp) {
            lastUpdateState.text.textContent = 'Awaiting first update…';
            lastUpdateState.pill.classList.remove('stale');
            return;
        }

        const diff = Date.now() - lastUpdateState.timestamp.getTime();
        lastUpdateState.text.textContent = `Last update ${formatRelativeDuration(diff)}`;
        const staleThreshold = fallbackHydrationInterval * 1.5;
        lastUpdateState.pill.classList.toggle('stale', diff > staleThreshold);
    }

    function setLastUpdateTimestamp(timestamp) {
        if (!lastUpdateState.text) {
            return;
        }

        if (!timestamp && timestamp !== 0) {
            lastUpdateState.timestamp = new Date();
        } else {
            const parsed = new Date(timestamp);
            lastUpdateState.timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        }

        refreshLastUpdateDisplay();
    }

    // Listen for metrics updates
    channel.bind('metrics.updated', function(data) {
        if (!isPaused) {
            updateMetrics(data);
        }

        setLastUpdateTimestamp(data.timestamp);

        if (Array.isArray(data.clientAlerts)) {
            setRealtimeAlerts(data.clientAlerts);
        }
    });

    // Update metrics UI
    function updateMetrics(data = {}) {
        const requests = data.requests || {};
        const performance = data.performance || {};
        const cache = data.cache || {};
        const errors = data.errors || {};
        const features = data.features || {};
        const system = data.system || {};

        updateMetric('requestsPerMinute', 'requestsChange', requests.per_minute, { precision: 0 });
        updateMetric('responseTime', 'responseChange', performance.avg_response_time, { suffix: 'ms', precision: 0 });
        updateMetric('cacheHitRate', 'cacheChange', cache.hit_rate, { suffix: '%', precision: 1 });
        updateMetric('errorRate', 'errorChange', errors.rate, { suffix: '%', precision: 2 });

        setTextContent('activeUsers', formatNumber(requests.active_users));
        setTextContent('concurrentRequests', formatNumber(requests.concurrent_requests));
        setTextContent('queueSize', formatNumber(system.queue_size));
        setTextContent('memoryUsage', formatMemoryUsage(system.memory_usage));
        setTextContent('cpuLoad', formatCpuLoad(system.cpu_load));
        setTextContent('databaseConnections', formatNumber(system.database_connections));

        updateSystemStatus(system.status);

        updateRequestRateChart(requests);
        updateResponseTimeChart(performance);
        updateFeatureUsageChart(features);
        updateErrorLog(errors.recent_errors);

        if (data.cdn) {
            updateCdnHealth(data.cdn);
        }
    }

    function updateMetric(elementId, changeElementId, rawValue, { suffix = '', precision = 1 } = {}) {
        const element = document.getElementById(elementId);
        const changeElement = document.getElementById(changeElementId);

        if (!element || !changeElement) {
            return;
        }

        const numericValue = toNumber(rawValue);

        if (numericValue === null) {
            element.textContent = '—';
            changeElement.className = 'metric-change';
            changeElement.innerHTML = '<i class="fas fa-minus"></i> No data';
            previousValues[elementId] = null;
            return;
        }

        const formattedValue = precision > 0
            ? numericValue.toFixed(precision)
            : Math.round(numericValue);

        element.textContent = `${formattedValue}${suffix}`;

        const previous = typeof previousValues[elementId] === 'number'
            ? previousValues[elementId]
            : numericValue;

        const delta = Number((numericValue - previous).toFixed(Math.max(precision, 0)));

        if (delta > 0) {
            changeElement.className = 'metric-change positive';
            changeElement.innerHTML = `<i class="fas fa-arrow-up"></i> +${Math.abs(delta).toFixed(Math.max(precision, 0))}`;
        } else if (delta < 0) {
            changeElement.className = 'metric-change negative';
            changeElement.innerHTML = `<i class="fas fa-arrow-down"></i> -${Math.abs(delta).toFixed(Math.max(precision, 0))}`;
        } else {
            changeElement.className = 'metric-change';
            changeElement.innerHTML = '<i class="fas fa-minus"></i> No change';
        }

        previousValues[elementId] = numericValue;
    }

    function updateSystemStatus(status) {
        const indicator = document.getElementById('systemStatusIndicator');
        const text = document.getElementById('systemStatusText');

        if (!indicator || !text) {
            return;
        }

        const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : 'unknown';
        indicator.className = 'status-indicator status-' + normalizedStatus;
        text.textContent = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
    }

    function updateRequestRateChart(requests = {}) {
        if (!requestRateChart) {
            return;
        }

        const time = new Date().toLocaleTimeString();

        if (requestRateChart.data.labels.length > 60) {
            requestRateChart.data.labels.shift();
            requestRateChart.data.datasets[0].data.shift();
        }

        const value = toNumber(requests.per_minute) ?? 0;
        requestRateChart.data.labels.push(time);
        requestRateChart.data.datasets[0].data.push(value);
        requestRateChart.update('none');
    }

    function updateResponseTimeChart(performance = {}) {
        if (!responseTimeChart) {
            return;
        }

        const time = new Date().toLocaleTimeString();

        if (responseTimeChart.data.labels.length > 60) {
            responseTimeChart.data.labels.shift();
            responseTimeChart.data.datasets[0].data.shift();
        }

        const value = toNumber(performance.avg_response_time) ?? 0;
        responseTimeChart.data.labels.push(time);
        responseTimeChart.data.datasets[0].data.push(value);
        responseTimeChart.update('none');
    }

    function updateFeatureUsageChart(features = {}) {
        if (!featureUsageChart) {
            return;
        }

        const orderedKeys = ['resume_parser', 'job_matching', 'career_insights', 'smart_posting', 'cv_builder'];
        const values = Array.isArray(features)
            ? orderedKeys.map((_, index) => {
                const entry = features[index] || {};
                const count = entry.usage_count ?? entry.count ?? entry.value;
                return toNumber(count) ?? 0;
            })
            : orderedKeys.map(key => toNumber(features[key]) ?? 0);

        featureUsageChart.data.datasets[0].data = values;
        featureUsageChart.update('none');
    }

    function updateErrorLog(errors) {
        const errorLog = document.getElementById('errorLog');
        if (!errorLog) {
            return;
        }

        const entries = Array.isArray(errors) ? errors : [];

        if (!entries.length) {
            errorLog.innerHTML = '<p class="text-muted text-center">No errors to display</p>';
            return;
        }

        const html = entries.map(error => {
            const criticalClass = error.critical ? 'critical' : '';
            const feature = error.feature || 'Unknown Feature';
            const type = error.type || error.code || 'Unknown';
            const timestamp = error.timestamp || '—';
            const message = error.message || error.description || 'No message provided';
            return `
                <div class="error-entry ${criticalClass}">
                    <strong>${feature}</strong> - ${type}
                    <br><small class="text-muted">${timestamp}</small>
                    <br>${message}
                </div>
            `;
        }).join('');

        errorLog.innerHTML = html;
    }

    async function hydrateRealtimeMetrics() {
        if (!metricsEndpoint) {
            return;
        }

        try {
            const response = await fetch(metricsEndpoint, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Metrics endpoint responded with ${response.status}`);
            }

            const payload = await response.json();
            if (!payload) {
                return;
            }

            if (Array.isArray(payload.clientAlerts)) {
                setRealtimeAlerts(payload.clientAlerts);
            }

            setHydrationAlert(null);
            const realtimePayload = extractRealtimePayload(payload);
            const cdnPayload = (realtimePayload && realtimePayload.cdn) || payload.cdn;

            if (cdnPayload) {
                updateCdnHealth(cdnPayload);
            }

            if (realtimePayload) {
                if (!isPaused) {
                    updateMetrics(realtimePayload);
                }

                setLastUpdateTimestamp(
                    realtimePayload.timestamp || payload.timestamp || Date.now()
                );
            } else if (payload.timestamp) {
                setLastUpdateTimestamp(payload.timestamp);
            }
        } catch (error) {
            console.error('Error hydrating realtime dashboard:', error);
            const message = `Auto-refresh failed at ${new Date().toLocaleTimeString()}. Retrying…`;
            setHydrationAlert(message);
            emitClientAlert({
                source: 'ai-analytics.realtime.fetch',
                severity: 'warning',
                message,
                context: { error: String(error) }
            });
        }
    }

    function extractRealtimePayload(payload) {
        if (!payload) {
            return null;
        }

        if (payload.realtime && Object.keys(payload.realtime).length) {
            return payload.realtime;
        }

        const hasSlices = payload.requests || payload.performance || payload.cache || payload.errors || payload.features || payload.system;
        if (!hasSlices) {
            return null;
        }

        return {
            timestamp: payload.timestamp,
            requests: payload.requests,
            performance: payload.performance,
            cache: payload.cache,
            errors: payload.errors,
            features: payload.features,
            system: payload.system,
            cdn: payload.cdn
        };
    }

    // Pause/Resume functionality
    let isPaused = false;

    hydrateRealtimeMetrics();
    setInterval(hydrateRealtimeMetrics, fallbackHydrationInterval);
    setInterval(refreshLastUpdateDisplay, 5000);
    setRealtimeAlerts(initialClientAlerts);

    function pauseUpdates() {
        isPaused = !isPaused;
        const icon = document.getElementById('pauseIcon');
        const text = document.getElementById('pauseText');

        if (isPaused) {
            icon.className = 'fas fa-play';
            text.textContent = 'Resume';
        } else {
            icon.className = 'fas fa-pause';
            text.textContent = 'Pause';
        }
    }

    // Initial connection
    console.log('Real-time dashboard initialized');
</script>
@endpush

