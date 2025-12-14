@extends('frontend.social.layout')

@section('social-content')
@php
    $highlightConnections = $connections->getCollection()->take(6);
    $pendingTotal = $pendingIncomingCount + $pendingOutgoingCount;
    $memberLabel = member_label();
    $candidateProfile = auth()->user()->candidate;
    $profileShareLink = $candidateProfile?->slug
        ? route('members.show', $candidateProfile->slug)
        : route('member.social.connections');
@endphp
<div class="connections-dashboard space-y-10">
    <section class="dashboard-hero connections-hero">
        <div class="connections-hero-grid">
            <div class="connections-hero-copy space-y-4">
                <span class="connections-hero-eyebrow">My Network</span>
                <h1 class="connections-hero-title">Curate your circle with intention</h1>
                <p class="connections-hero-text">
                    Hold space for the relationships that energise you. Track gentle momentum, nurture warm intros, and follow up with ease.
                </p>
                <div class="connections-hero-actions">
                    <a href="{{ route('member.social.connections.create') }}" class="connections-cta connections-cta--primary">
                        <i class="fas fa-user-plus"></i>
                        <span>Add Connection</span>
                    </a>
                    <a href="{{ route('member.social.connections.explore') }}" class="connections-cta connections-cta--ghost">
                        <i class="fas fa-compass"></i>
                        <span>Discover People</span>
                    </a>
                </div>
            </div>
            <div class="connections-hero-metrics">
                <article class="connections-hero-stat">
                    <span class="connections-hero-stat-label">Active</span>
                    <span class="connections-hero-stat-value">{{ number_format($connectionsCount) }}</span>
                    <span class="connections-hero-stat-hint">connections live now</span>
                </article>
                <article class="connections-hero-stat">
                    <span class="connections-hero-stat-label">New</span>
                    <span class="connections-hero-stat-value">{{ number_format($newConnectionsThisMonth) }}</span>
                    <span class="connections-hero-stat-hint">this month</span>
                </article>
                <article class="connections-hero-stat">
                    <span class="connections-hero-stat-label">Pending</span>
                    <span class="connections-hero-stat-value">{{ number_format($pendingTotal) }}</span>
                    <span class="connections-hero-stat-hint">{{ number_format($pendingIncomingCount) }} incoming • {{ number_format($pendingOutgoingCount) }} outgoing</span>
                </article>
                <article class="connections-hero-stat">
                    <span class="connections-hero-stat-label">Momentum</span>
                    <span class="connections-hero-stat-value" id="metricMomentumSpark">—</span>
                    <span class="connections-hero-stat-hint">auto-updates from analytics</span>
                </article>
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-spotlight">
        <div class="dashboard-card-header flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="dashboard-card-title mb-1">Spotlight your circle</p>
                <span class="dashboard-card-subtitle">Jump straight to the relationships you want to nurture today.</span>
            </div>
        </div>
        <div class="dashboard-card-body">
            <div class="connections-spotlight-scroll">
                <a href="{{ route('member.social.connections.spotlight') }}" class="connections-spotlight-item connections-spotlight-item--cta">
                    <span class="connections-spotlight-avatar">
                        <i class="fas fa-sparkles"></i>
                    </span>
                    <span class="connections-spotlight-label">AI Boost</span>
                </a>
                @forelse ($highlightConnections as $spotlight)
                    @php
                        $spotlightUser = $spotlight->connected_user_id === auth()->id() ? $spotlight->user : $spotlight->connectedUser;
                        $spotlightImage = $spotlightUser->candidate?->image ?? asset('images/default-avatar.png');
                    @endphp
                    <button type="button" class="connections-spotlight-item" data-connection-target="connection-card-{{ $spotlight->id }}">
                        <span class="connections-spotlight-avatar">
                            <img src="{{ $spotlightImage }}" alt="{{ $spotlightUser->name }}">
                        </span>
                        <span class="connections-spotlight-label">{{ \Illuminate\Support\Str::limit($spotlightUser->name, 14) }}</span>
                    </button>
                @empty
                    <div class="connections-spotlight-empty">
                        <span class="connections-spotlight-avatar">
                            <i class="fas fa-circle-plus"></i>
                        </span>
                        <p class="connections-spotlight-copy">Invite your first connection to begin weaving your network.</p>
                    </div>
                @endforelse
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-quick">
        <div class="dashboard-card-header flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="dashboard-card-title mb-1">Quick Actions</p>
                <span class="dashboard-card-subtitle">Invite, discover, or share your profile in one place.</span>
            </div>
        </div>
        <div class="dashboard-card-body">
            <div class="connections-quick-grid">
                <a href="{{ route('member.social.connections.create') }}" class="connections-quick-card">
                    <span class="connections-quick-icon">
                        <i class="fas fa-envelope-open-text"></i>
                    </span>
                    <div class="connections-quick-copy">
                        <span class="connections-quick-title">Send Invite</span>
                        <span>Craft a warm introduction</span>
                    </div>
                </a>
                <a href="{{ route('member.social.connections.explore') }}" class="connections-quick-card">
                    <span class="connections-quick-icon">
                        <i class="fas fa-compass"></i>
                    </span>
                    <div class="connections-quick-copy">
                        <span class="connections-quick-title">Discover People</span>
                        <span>Let AI surface aligned matches</span>
                    </div>
                </a>
                <button type="button" class="connections-quick-card" data-share-link="{{ $profileShareLink }}" onclick="shareProfileLink(this)">
                    <span class="connections-quick-icon">
                        <i class="fas fa-share-nodes"></i>
                    </span>
                    <div class="connections-quick-copy">
                        <span class="connections-quick-title">Share Profile</span>
                        <span>Copy your public link instantly</span>
                    </div>
                </button>
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-analytics" id="connectionMomentumSection">
        <div class="dashboard-card-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="dashboard-card-title mb-1">Connection Momentum</p>
                <span class="dashboard-card-subtitle">Weekly growth of your accepted connections</span>
            </div>
            <div class="connections-card-toolbar">
                <label class="connections-card-label" for="connectionMomentumRange">Range</label>
                <select class="connections-select" id="connectionMomentumRange">
                    <option value="4">Last 4 weeks</option>
                    <option value="6" selected>Last 6 weeks</option>
                    <option value="8">Last 8 weeks</option>
                    <option value="12">Last 12 weeks</option>
                </select>
                <span class="status-pill" id="connectionMomentumStatus">Syncing&hellip;</span>
            </div>
        </div>
        <div class="dashboard-card-body space-y-6">
            <div id="connectionMomentumMetricsGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="metric-card metric-card--blush">
                    <p class="metric-card__label">New connections (<span id="momentumRangeLabel">Last 6 weeks</span>)</p>
                    <p class="metric-card__value" id="momentumMetricTotal">&mdash;</p>
                </div>
                <div class="metric-card metric-card--lilac">
                    <p class="metric-card__label">Avg per week</p>
                    <p class="metric-card__value" id="momentumMetricAverage">&mdash;</p>
                </div>
                <div class="metric-card metric-card--mint">
                    <p class="metric-card__label">Best week</p>
                    <p class="metric-card__value" id="momentumMetricBestValue">&mdash;</p>
                    <p class="metric-card__hint" id="momentumMetricBestLabel"></p>
                </div>
                <div class="metric-card metric-card--sunrise">
                    <p class="metric-card__label">Pending approvals</p>
                    <p class="metric-card__value" id="momentumMetricPending">&mdash;</p>
                </div>
            </div>
            <div id="connectionMomentumMetricsFallback" class="hidden"></div>
            <div class="space-y-4">
                <div id="connectionMomentumTrendBlock">
                    <h3 class="connections-subheading">Weekly Trend</h3>
                    <div class="connections-panel">
                        <div id="connectionMomentumChartWrapper">
                            <canvas id="connectionMomentumChart" height="220"></canvas>
                        </div>
                        <div id="connectionMomentumChartFallback" class="connections-panel__fallback hidden">No chart data yet. Accept new connections to visualise momentum.</div>
                    </div>
                </div>
                <div id="connectionMomentumTotalsBlock">
                    <h3 class="connections-subheading">Weekly Totals</h3>
                    <div id="connectionMomentumTimeline" class="connections-panel">
                        <div class="connections-panel__fallback">Charting recent approvals&hellip;</div>
                    </div>
                </div>
                <div id="connectionMomentumInsightsBlock">
                    <h3 class="connections-subheading">Momentum Insights</h3>
                    <ul class="connections-panel connections-panel--list" id="connectionMomentumInsights">
                        <li class="connections-panel__fallback">Surfacing insights&hellip;</li>
                    </ul>
                </div>
                <div id="connectionMomentumFallbackRow" class="hidden"></div>
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-analytics" id="connectionStatusSection">
        <div class="dashboard-card-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="dashboard-card-title mb-1">Connection Status Mix</p>
                <span class="dashboard-card-subtitle">Distribution of your network across connection stages</span>
            </div>
            <span class="status-pill" id="connectionStatusMeta">Syncing&hellip;</span>
        </div>
        <div class="dashboard-card-body space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="connections-panel">
                    <div id="connectionStatusChartWrapper" class="connections-chart">
                        <canvas id="connectionStatusChart" height="220"></canvas>
                    </div>
                    <div id="connectionStatusChartFallback" class="connections-panel__fallback mt-4">Preparing chart&hellip;</div>
                </div>
                <div>
                    <div class="space-y-5" id="connectionStatusDataBlocks">
                        <div>
                            <p class="connections-micro-label">Total connections</p>
                            <p class="stat-value" id="statusTotalCount">&mdash;</p>
                            <p class="stat-hint" id="connectionStatusDominant"></p>
                        </div>
                        <div>
                            <p class="connections-micro-label mb-2">Pending follow-ups</p>
                            <div class="grid grid-cols-2 gap-3 text-sm">
                                <div class="mini-card mini-card--warm">
                                    <p class="mini-card__label">Incoming</p>
                                    <p class="mini-card__value" id="statusPendingIncomingCount">&mdash;</p>
                                    <p class="mini-card__hint" id="statusPendingIncomingAge">Assessing freshness&hellip;</p>
                                </div>
                                <div class="mini-card mini-card--cool">
                                    <p class="mini-card__label">Outgoing</p>
                                    <p class="mini-card__value" id="statusPendingOutgoingCount">&mdash;</p>
                                    <p class="mini-card__hint" id="statusPendingOutgoingAge">Assessing freshness&hellip;</p>
                                </div>
                            </div>
                            <p class="stat-hint" id="pendingRecencyMeta">Analysing response times&hellip;</p>
                        </div>
                        <div>
                            <p class="connections-micro-label">Breakdown</p>
                            <ul class="connections-panel connections-panel--list" id="connectionStatusList">
                                <li class="connections-panel__fallback">Calculating distribution&hellip;</li>
                            </ul>
                        </div>
                        <div>
                            <p class="connections-micro-label">Needs attention</p>
                            <div id="stalePendingSummary" class="alert-card alert-card--rose hidden">
                                <p class="font-semibold" id="stalePendingTitle">No stalled invites.</p>
                                <ul class="mt-2 space-y-1 text-rose-600" id="stalePendingList"></ul>
                            </div>
                            <p class="stat-hint" id="stalePendingFallback">No stalled invites at the moment.</p>
                        </div>
                    </div>
                    <div id="connectionStatusFallbackRow" class="hidden mt-2"></div>
                </div>
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-analytics" id="connectionPulseSection">
        <div class="dashboard-card-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="dashboard-card-title mb-1">Connection Pulse</p>
                <span class="dashboard-card-subtitle">Latest network activity and pending follow-ups</span>
            </div>
            <span class="status-pill" id="connectionPulseStatus">Syncing&hellip;</span>
        </div>
        <div class="dashboard-card-body space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="connectionPulseMetrics">
                <div class="metric-card metric-card--blush">
                    <p class="metric-card__label">Total connections</p>
                    <p class="metric-card__value" id="pulseMetricTotal">&mdash;</p>
                </div>
                <div class="metric-card metric-card--lilac">
                    <p class="metric-card__label">New (30 days)</p>
                    <p class="metric-card__value" id="pulseMetricNew">&mdash;</p>
                </div>
                <div class="metric-card metric-card--rose">
                    <p class="metric-card__label">Pending incoming</p>
                    <p class="metric-card__value" id="pulseMetricPendingIncoming">&mdash;</p>
                </div>
                <div class="metric-card metric-card--sunrise">
                    <p class="metric-card__label">Acceptance rate</p>
                    <p class="metric-card__value" id="pulseMetricAcceptance">&mdash;</p>
                </div>
            </div>
            <div id="connectionPulseMetricsFallback" class="hidden"></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="connections-subheading">Insights</h3>
                    <ul class="connections-panel connections-panel--list" id="connectionPulseInsights">
                        <li class="connections-panel__fallback">Collecting insights&hellip;</li>
                    </ul>
                </div>
                <div>
                    <h3 class="connections-subheading">Follow up</h3>
                    <div class="connections-panel connections-panel--list" id="connectionPulseFollowUp">
                        <div class="connections-panel__fallback">Identifying priority contacts&hellip;</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="dashboard-card connections-analytics" id="networkClustersSection">
        <div class="dashboard-card-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center gap-3">
                <div class="connections-section-icon">
                    <i class="fas fa-diagram-project"></i>
                </div>
                <div>
                    <p class="dashboard-card-title mb-1">Network Clusters</p>
                    <span class="dashboard-card-subtitle">Grouped introductions curated by our AI</span>
                </div>
            </div>
            <span class="status-pill" id="networkClustersMeta"></span>
        </div>
        <div class="dashboard-card-body space-y-4">
            <p class="dashboard-card-subtitle connections-muted" id="networkClustersEmpty">Calibrating your clusters&hellip;</p>
            <div class="connections-cluster-grid" id="networkClustersGrid"></div>
        </div>
    </section>

    <section class="dashboard-card connections-toolbar">
        <div class="dashboard-card-header">
            <p class="dashboard-card-title mb-1">Find the right person</p>
            <span class="dashboard-card-subtitle">Search, filter, or reorder your network.</span>
        </div>
        <div class="dashboard-card-body">
            <div class="connections-toolbar-grid">
                <div class="connections-input">
                    <input type="text" class="form-control rounded-lg" id="searchInput" placeholder="Search connections...">
                    <i class="fas fa-search"></i>
                </div>
                <div>
                    <select class="form-control rounded-lg" id="statusFilter" onchange="filterConnections()">
                        <option value="">All Status</option>
                        <option value="connected">✓ Connected</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="blocked">⛔ Blocked</option>
                    </select>
                </div>
                <div>
                    <select class="form-control rounded-lg" id="sortBy" onchange="sortConnections()">
                        <option value="recent">Most Recent</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="mutual">Mutual Connections</option>
                    </select>
                </div>
                <div>
                    <button class="connections-reset" onclick="resetFilters()">
                        <i class="fas fa-redo"></i>
                        <span>Reset filters</span>
                    </button>
                </div>
            </div>
        </div>
    </section>

    @if($connections->count() > 0)
        <section class="dashboard-card connections-list">
            <div class="dashboard-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p class="dashboard-card-title mb-1">
                        <i class="fas fa-users"></i>
                        <span>All Connections</span>
                    </p>
                    <span class="dashboard-card-subtitle">Currently {{ $connections->total() }} relationships nurtured.</span>
                </div>
            </div>
            <div class="dashboard-card-body">
                <div class="connections-grid" id="connectionsGrid">
                    @foreach($connections as $connection)
                        @php
                            $connectedUser = $connection->connected_user_id === auth()->id()
                                ? $connection->user
                                : $connection->connectedUser;
                            $profile = $connectedUser->candidate;
                            $profileTitle = $profile?->title ?? 'Professional';
                            $profileCity = $profile?->city ?? 'Worldwide';
                            $profileImage = $profile?->image ?? asset('images/default-avatar.png');
                            $bio = $profile?->bio;
                            $mutualSeed = crc32((string) $connection->id . '-' . ($connectedUser->id ?? ''));
                            $mutualCount = $connection->mutual_connections_count
                                ?? $connection->mutual_count
                                ?? (($mutualSeed % 8) + 2);
                            $connectedAt = optional($connection->created_at)->timestamp ?? optional($connection->updated_at)->timestamp ?? 0;
                            $connectedAgo = optional($connection->created_at)->diffForHumans(null, true) ?? 'just now';
                            $searchIndex = strtolower(trim($connectedUser->name . ' ' . $profileTitle . ' ' . $profileCity));
                            $profileUrl = $profile?->slug ? route('members.show', $profile->slug) : null;
                            $statusLabel = ucfirst(str_replace('_', ' ', $connection->status ?? 'connected'));
                        @endphp
                        <article
                            id="connection-card-{{ $connection->id }}"
                            class="connection-card"
                            data-connection-id="{{ $connection->id }}"
                            data-status="{{ $connection->status }}"
                            data-name="{{ e($connectedUser->name) }}"
                            data-title="{{ e($profileTitle) }}"
                            data-city="{{ e($profileCity) }}"
                            data-search="{{ e($searchIndex) }}"
                            data-mutual="{{ $mutualCount }}"
                            data-created-at="{{ $connectedAt }}"
                            data-profile-url="{{ $profileUrl ?? '' }}"
                            data-email="{{ $connectedUser->email }}"
                        >
                            <div class="connection-card__top">
                                <div class="connection-card__avatar">
                                    <img src="{{ $profileImage }}" alt="{{ $connectedUser->name }}">
                                    <span class="connection-card__status">
                                        <i class="fas fa-check-circle"></i>
                                        <span>{{ $statusLabel }}</span>
                                    </span>
                                </div>
                                <button type="button" class="connection-card__menu" onclick="removeConnection({{ $connection->id }})" aria-label="Remove connection">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            </div>
                            <div class="connection-card__body">
                                <h3 class="connection-card__name">{{ $connectedUser->name }}</h3>
                                <p class="connection-card__title">{{ $profileTitle }}</p>
                                <p class="connection-card__meta">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>{{ $profileCity }}</span>
                                </p>
                                <div class="connection-card__chips">
                                    <span class="connection-chip">
                                        <i class="fas fa-user-group"></i>
                                        <span>{{ $mutualCount }} mutual{{ $mutualCount === 1 ? '' : 's' }}</span>
                                    </span>
                                    <span class="connection-chip">
                                        <i class="fas fa-clock"></i>
                                        <span>Connected {{ $connectedAgo }}</span>
                                    </span>
                                </div>
                                @if($bio)
                                    <p class="connection-card__bio">{{ \Illuminate\Support\Str::limit($bio, 120) }}</p>
                                @endif
                            </div>
                            <div class="connection-card__actions">
                                <a href="mailto:{{ $connectedUser->email }}" class="connection-card__action">
                                    <i class="fas fa-paper-plane"></i>
                                    <span>Message</span>
                                </a>
                                @if($profileUrl)
                                    <a href="{{ $profileUrl }}" class="connection-card__action connection-card__action--ghost">
                                        <i class="fas fa-id-badge"></i>
                                        <span>Profile</span>
                                    </a>
                                @else
                                    <button type="button" class="connection-card__action connection-card__action--ghost" disabled>
                                        <i class="fas fa-id-badge"></i>
                                        <span>Profile</span>
                                    </button>
                                @endif
                                <button type="button" class="connection-card__action connection-card__action--danger" onclick="removeConnection({{ $connection->id }})">
                                    <i class="fas fa-user-slash"></i>
                                    <span>Remove</span>
                                </button>
                            </div>
                        </article>
                    @endforeach
                </div>
                <div id="connectionsEmptyFiltered" class="connections-empty-filter hidden">
                    <i class="fas fa-compass"></i>
                    <p>No connections match those filters right now. Reset the controls to rediscover your circle.</p>
                </div>
                <div class="connections-pagination">
                    {{ $connections->links('pagination::bootstrap-4') }}
                </div>
            </div>
        </section>
    @else
        <section class="dashboard-card connections-empty">
            <div class="dashboard-card-body text-center space-y-4">
                <div class="connections-empty-icon">
                    <i class="fas fa-network-wired"></i>
                </div>
                <h3 class="connections-empty-title">No connections yet</h3>
                <p class="connections-empty-copy">Start weaving your professional network today—AI will guide you every step.</p>
                <a href="{{ route('member.social.connections.spotlight') }}" class="connections-cta connections-cta--primary">
                    <i class="fas fa-sparkles"></i>
                    <span>Get AI recommendations</span>
                </a>
            </div>
        </section>
    @endif
    <div id="connectionActionToast" class="connection-toast hidden" role="status" aria-live="polite"></div>
</div>

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const momentumRangeSelect = document.getElementById('connectionMomentumRange');
    if (momentumRangeSelect) {
        momentumRangeSelect.addEventListener('change', function(event) {
            const weeks = Number(event.target.value) || 6;
            loadConnectionMomentum(weeks);
        });
    }

    const initialWeeks = Number(momentumRangeSelect?.value ?? 6) || 6;

    loadConnectionMomentum(initialWeeks);
    loadConnectionStatusBreakdown();
    loadConnectionPulse();
    loadNetworkClusters();
    initializeConnectionInteractions();
});

const clusterIconMap = {
    shared_skills: 'fa-lightbulb',
    mutual_connections: 'fa-people-arrows',
    industry_insiders: 'fa-briefcase',
};

const statusColorMap = {
    accepted: '#6366f1',
    pending: '#fbbf24',
    rejected: '#f87171',
    blocked: '#0f172a',
    cancelled: '#9ca3af',
    unknown: '#94a3b8',
};

let connectionMomentumChart = null;
let connectionStatusChart = null;
let connectionsGridRef = null;
let allConnectionCards = [];
const connectionState = {
    search: '',
    status: '',
    sort: 'recent',
};
let connectionToastTimer = null;

async function loadConnectionMomentum(weeks) {
    const statusLabel = document.getElementById('connectionMomentumStatus');
    const timelineContainer = document.getElementById('connectionMomentumTimeline');
    const rangeSelect = document.getElementById('connectionMomentumRange');

    if (!statusLabel || !timelineContainer) {
        return;
    }

    const effectiveWeeks = Number(weeks ?? rangeSelect?.value ?? 6) || 6;

    if (rangeSelect) {
        rangeSelect.value = String(effectiveWeeks);
        rangeSelect.disabled = true;
    }

    statusLabel.textContent = 'Syncing…';

    try {
        const response = await aiFeatures.getConnectionMomentum(effectiveWeeks);
        const payload = response?.data ?? response ?? {};
        renderConnectionMomentum(payload, effectiveWeeks);
    } catch (error) {
        console.error('Unable to load connection momentum', error);
        renderConnectionMomentum({ fallback: true, series: [] }, effectiveWeeks);
    } finally {
        if (rangeSelect) {
            rangeSelect.disabled = false;
        }
    }
}

function renderConnectionMomentum(payload, weeks) {
    const statusLabel = document.getElementById('connectionMomentumStatus');
    const insightsList = document.getElementById('connectionMomentumInsights');
    const timelineContainer = document.getElementById('connectionMomentumTimeline');
    const chartWrapper = document.getElementById('connectionMomentumChartWrapper');
    const chartFallback = document.getElementById('connectionMomentumChartFallback');
    const metricsGrid = document.getElementById('connectionMomentumMetricsGrid');
    const metricsFallback = document.getElementById('connectionMomentumMetricsFallback');
    const sparkMetric = document.getElementById('metricMomentumSpark');
    const bestValueEl = document.getElementById('momentumMetricBestValue');
    const bestLabelEl = document.getElementById('momentumMetricBestLabel');
    const trendBlock = document.getElementById('connectionMomentumTrendBlock');
    const totalsBlock = document.getElementById('connectionMomentumTotalsBlock');
    const insightsBlock = document.getElementById('connectionMomentumInsightsBlock');
    const fallbackRow = document.getElementById('connectionMomentumFallbackRow');

    const summary = payload?.summary ?? {};
    const series = Array.isArray(payload?.series) ? payload.series : [];
    const isFallback = Boolean(payload?.fallback);

    updateMomentumRangeLabel(series, weeks, isFallback);

    const total = Number(summary.total_new_connections ?? 0);
    const averageValue = typeof summary.average_per_week === 'number'
        ? summary.average_per_week
        : 0;
    const averageDisplay = averageValue.toFixed(1);
    const pending = Number(summary.pending_requests ?? 0);
    const bestWeek = summary.best_week ?? null;
    const momentum = summary.momentum ?? {};

    if (isFallback) {
        destroyConnectionMomentumChart();

        if (statusLabel) {
            statusLabel.textContent = 'Awaiting new approvals';
        }
        if (metricsGrid) {
            metricsGrid.classList.add('hidden');
        }
        if (metricsFallback) {
            metricsFallback.classList.remove('hidden');
            metricsFallback.innerHTML = buildConnectionsFallback({
                title: 'Momentum is waiting',
                message: 'Accept your first wave of connections to unlock these momentum metrics.',
                icon: 'fa-bolt',
                tone: 'sunrise',
            });
        }
        if (trendBlock) {
            trendBlock.classList.add('hidden');
        }
        if (totalsBlock) {
            totalsBlock.classList.add('hidden');
        }
        if (insightsBlock) {
            insightsBlock.classList.add('hidden');
        }
        if (fallbackRow) {
            fallbackRow.classList.remove('hidden');
            const momentumPrompts = [
                {
                    icon: 'fa-chart-line',
                    title: 'Momentum chart blooms next',
                    message: 'Approve or send connection requests to watch your weekly growth curve appear.',
                    tone: 'indigo',
                },
                {
                    icon: 'fa-calendar-plus',
                    title: 'Weekly totals',
                    message: 'Invite new contacts to ignite your weekly trendline.',
                    tone: 'rose',
                },
                {
                    icon: 'fa-seedling',
                    title: 'Momentum tip',
                    message: 'Send invites or respond to pending requests to spark new conversations.',
                    tone: 'sunrise',
                },
            ];

            fallbackRow.innerHTML = `
                <div class="connections-quick-grid connections-quick-grid--prompt">
                    ${momentumPrompts.map(buildQuickPromptCard).join('')}
                </div>
            `;
        }

        setMetricValue('momentumMetricTotal', '—');
        setMetricValue('momentumMetricAverage', '—');
        setMetricValue('momentumMetricPending', '—');

        if (bestValueEl) {
            bestValueEl.textContent = '—';
        }
        if (bestLabelEl) {
            bestLabelEl.textContent = '';
        }
        if (sparkMetric) {
            sparkMetric.textContent = 'Fresh start';
        }
        if (chartWrapper) {
            chartWrapper.classList.add('hidden');
        }
        if (chartFallback) {
            chartFallback.classList.add('hidden');
            chartFallback.innerHTML = '';
        }
        if (timelineContainer) {
            timelineContainer.innerHTML = '';
        }
        if (insightsList) {
            insightsList.innerHTML = '';
        }
        return;
    }

    if (trendBlock) {
        trendBlock.classList.remove('hidden');
    }
    if (totalsBlock) {
        totalsBlock.classList.remove('hidden');
    }
    if (insightsBlock) {
        insightsBlock.classList.remove('hidden');
    }
    if (fallbackRow) {
        fallbackRow.classList.add('hidden');
        fallbackRow.innerHTML = '';
    }
    if (metricsGrid) {
        metricsGrid.classList.remove('hidden');
    }
    if (metricsFallback) {
        metricsFallback.classList.add('hidden');
        metricsFallback.innerHTML = '';
    }

    setMetricValue('momentumMetricTotal', total);
    setMetricValue('momentumMetricAverage', averageDisplay);
    setMetricValue('momentumMetricPending', pending);

    if (bestWeek && bestWeek.new_connections > 0) {
        if (bestValueEl) {
            bestValueEl.textContent = bestWeek.new_connections;
        }
        if (bestLabelEl) {
            bestLabelEl.textContent = `Week of ${formatWeekLabel(bestWeek.week_start)}`;
        }
    } else {
        if (bestValueEl) {
            bestValueEl.textContent = '—';
        }
        if (bestLabelEl) {
            bestLabelEl.textContent = '';
        }
    }

    if (sparkMetric) {
        const sparkLabel = momentum.badge
            ?? (total > 0 ? (momentum.direction === 'rising' ? 'On fire' : 'In rhythm') : 'Fresh start');
        sparkMetric.textContent = sparkLabel;
    }

    if (chartWrapper) {
        chartWrapper.classList.remove('hidden');
    }
    if (chartFallback) {
        chartFallback.classList.add('hidden');
        chartFallback.innerHTML = '';
    }

    renderConnectionMomentumChart(series);

    if (statusLabel) {
        const direction = momentum.direction ?? 'stable';
        const delta = Number(momentum.change ?? 0);
        const percent = typeof momentum.percent === 'number' ? momentum.percent : null;
        const trendLabel = direction === 'rising'
            ? 'Growth accelerating'
            : (direction === 'declining' ? 'Growth cooling' : 'Steady pace');
        const deltaIndicator = percent !== null
            ? `${delta >= 0 ? '+' : ''}${percent}%`
            : (delta !== 0 ? `${delta >= 0 ? '+' : ''}${delta}` : '0');
        statusLabel.textContent = `Updated just now • ${trendLabel} (${deltaIndicator})`;
    }

    if (timelineContainer) {
        timelineContainer.innerHTML = buildMomentumTimeline(series);
    }

    if (insightsList) {
        const insights = Array.isArray(payload?.insights) && payload.insights.length > 0
            ? payload.insights
            : [`Track your connections weekly to sustain at least ${averageDisplay} approvals per week.`];

        insightsList.innerHTML = insights
            .map(item => buildConnectionsFallback({
                as: 'li',
                message: item,
                icon: 'fa-lightbulb',
                tone: 'indigo',
            }))
            .join('');
    }
}

async function loadConnectionStatusBreakdown() {
    const metaLabel = document.getElementById('connectionStatusMeta');
    const listElement = document.getElementById('connectionStatusList');

    if (!metaLabel || !listElement) {
        return;
    }

    metaLabel.textContent = 'Syncing…';

    try {
        const response = await aiFeatures.getConnectionStatusBreakdown();
        const payload = response?.data ?? response ?? {};
        renderConnectionStatusBreakdown(payload);
    } catch (error) {
        console.error('Unable to load connection status mix', error);
        renderConnectionStatusBreakdown({ fallback: true });
    }
}

function renderConnectionStatusBreakdown(payload) {
    const metaLabel = document.getElementById('connectionStatusMeta');
    const listElement = document.getElementById('connectionStatusList');
    const dominantElement = document.getElementById('connectionStatusDominant');
    const pendingIncomingAgeElement = document.getElementById('statusPendingIncomingAge');
    const pendingOutgoingAgeElement = document.getElementById('statusPendingOutgoingAge');
    const pendingRecencyMetaElement = document.getElementById('pendingRecencyMeta');
    const staleSummaryElement = document.getElementById('stalePendingSummary');
    const staleTitleElement = document.getElementById('stalePendingTitle');
    const staleListElement = document.getElementById('stalePendingList');
    const staleFallbackElement = document.getElementById('stalePendingFallback');
    const dataBlocksContainer = document.getElementById('connectionStatusDataBlocks');
    const fallbackRow = document.getElementById('connectionStatusFallbackRow');

    const pending = payload?.pending_breakdown ?? {};
    const pendingRecency = payload?.pending_recency ?? {};
    const stalePending = payload?.stale_pending ?? {};
    const staleThreshold = Number(pendingRecency?.stale_threshold_days ?? 7);
    const statuses = Array.isArray(payload?.statuses) ? payload.statuses : [];
    const total = Number(payload?.total ?? 0);
    const fallback = Boolean(payload?.fallback) || total === 0;

    setMetricValue('statusTotalCount', total);
    setMetricValue('statusPendingIncomingCount', Number(pending.incoming ?? 0));
    setMetricValue('statusPendingOutgoingCount', Number(pending.outgoing ?? 0));

    setPendingTimingText(pendingIncomingAgeElement, pendingRecency?.incoming, staleThreshold, fallback);
    setPendingTimingText(pendingOutgoingAgeElement, pendingRecency?.outgoing, staleThreshold, fallback);
    setPendingRecencyNote(pendingRecencyMetaElement, pendingRecency?.overall, staleThreshold, fallback);
    setStalePendingSummaries({
        summaryElement: staleSummaryElement,
        titleElement: staleTitleElement,
        listElement: staleListElement,
        fallbackElement: staleFallbackElement,
        stalePending,
        fallback,
    });

    if (fallback) {
        if (dataBlocksContainer) {
            dataBlocksContainer.classList.add('hidden');
        }
        if (fallbackRow) {
            fallbackRow.classList.remove('hidden');
            const statusPrompts = [
                {
                    icon: 'fa-circle-nodes',
                    title: 'Unlock distribution insights',
                    message: 'Add or approve connections to unlock your distribution breakdown and insights.',
                    tone: 'indigo',
                },
                {
                    icon: 'fa-inbox',
                    title: 'Pending follow-ups',
                    message: `Incoming and outgoing reminders appear once invites arrive. We flag anything older than ${staleThreshold} days.`,
                    tone: 'rose',
                },
                {
                    icon: 'fa-flag',
                    title: 'Needs attention',
                    message: 'We will spotlight quiet invites as soon as activity builds.',
                    tone: 'mint',
                },
            ];

            fallbackRow.innerHTML = `
                <div class="connections-quick-grid connections-quick-grid--prompt">
                    ${statusPrompts.map(buildQuickPromptCard).join('')}
                </div>
            `;
        }

        if (metaLabel) {
            metaLabel.textContent = 'No connection data yet';
        }
        if (dominantElement) {
            dominantElement.textContent = 'Add or approve connections to unlock distribution insights.';
        }
        if (listElement) {
            listElement.innerHTML = buildConnectionsFallback({
                as: 'li',
                title: 'No connection data yet',
                message: 'Add or approve connections to unlock your distribution breakdown.',
                icon: 'fa-circle-nodes',
                tone: 'indigo',
            });
        }

        renderConnectionStatusChart([], 'No chart data yet. Accept new connections to visualise distribution.');

        return;
    }

    if (dataBlocksContainer) {
        dataBlocksContainer.classList.remove('hidden');
    }
    if (fallbackRow) {
        fallbackRow.classList.add('hidden');
        fallbackRow.innerHTML = '';
    }

    const dominant = payload?.dominant_status ?? null;

    if (metaLabel) {
        const dominantSuffix = dominant?.label ? ` • ${dominant.label} leads` : '';
        metaLabel.textContent = `Updated just now${dominantSuffix}`;
    }

    if (dominantElement) {
        dominantElement.textContent = dominant
            ? `${dominant['label']} represents ${dominant['percent']}% of your network.`
            : '';
    }

    if (listElement) {
        listElement.innerHTML = buildStatusList(statuses, total);
    }

    renderConnectionStatusChart(statuses);
}

function renderConnectionStatusChart(statuses, fallbackMessage = null) {
    const wrapper = document.getElementById('connectionStatusChartWrapper');
    const fallbackEl = document.getElementById('connectionStatusChartFallback');
    const canvas = document.getElementById('connectionStatusChart');

    if (!wrapper || !fallbackEl || !canvas) {
        return;
    }

    if (typeof Chart === 'undefined') {
        destroyConnectionStatusChart();
        wrapper.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        fallbackEl.innerHTML = buildConnectionsFallback({
            title: 'Chart unavailable right now',
            message: 'We will replay the mix once the visual reloads.',
            icon: 'fa-triangle-exclamation',
            tone: 'sunrise',
        });
        return;
    }

    if (!Array.isArray(statuses) || statuses.length === 0) {
        destroyConnectionStatusChart();
        wrapper.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        fallbackEl.innerHTML = buildConnectionsFallback({
            title: 'No distribution chart yet',
            message: fallbackMessage ?? 'Accept new connections to visualise your network mix.',
            icon: 'fa-chart-pie',
            tone: 'indigo',
        });
        return;
    }

    wrapper.classList.remove('hidden');
    fallbackEl.classList.add('hidden');

    const labels = statuses.map(status => status.label ?? status.status ?? 'Status');
    const values = statuses.map(status => Number(status.count ?? 0));
    const colors = statuses.map(status => statusColorMap[status.status] ?? '#6366f1');

    const ctx = canvas.getContext('2d');

    if (!connectionStatusChart) {
        connectionStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 0,
                        hoverOffset: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value = context.parsed ?? 0;
                                const total = context.chart.data.datasets[0].data.reduce((sum, current) => sum + current, 0);
                                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `${context.label}: ${value} (${percent}%)`;
                            },
                        },
                    },
                },
            },
        });
    } else {
        connectionStatusChart.data.labels = labels;
        connectionStatusChart.data.datasets[0].data = values;
        connectionStatusChart.data.datasets[0].backgroundColor = colors;
        connectionStatusChart.update();
    }
}

function destroyConnectionStatusChart() {
    if (connectionStatusChart) {
        connectionStatusChart.destroy();
        connectionStatusChart = null;
    }
}

function setPendingTimingText(element, timing, staleThreshold, fallback) {
    if (!element) {
        return;
    }

    if (fallback) {
        element.textContent = 'No pending data yet.';
        return;
    }

    element.textContent = formatPendingTimingText(timing, staleThreshold);
}

function setPendingRecencyNote(element, timing, staleThreshold, fallback) {
    if (!element) {
        return;
    }

    if (fallback) {
        element.textContent = `Tracking invites older than ${staleThreshold} days as stale.`;
        return;
    }

    const hasAverage = typeof timing?.average_days === 'number' && Number.isFinite(timing.average_days);
    const hasOldest = typeof timing?.oldest_days === 'number' && Number.isFinite(timing.oldest_days);

    if (!hasAverage && !hasOldest) {
        element.textContent = `No pending invites awaiting response. Stale threshold ${staleThreshold} days.`;
        return;
    }

    const averagePart = hasAverage ? `Average wait ${timing.average_days.toFixed(1)} days` : null;
    const staleCount = typeof timing?.stale_count === 'number' ? Math.max(0, Math.trunc(timing.stale_count)) : 0;
    const stalePart = staleCount > 0
        ? `${staleCount} ${staleCount === 1 ? 'invite' : 'invites'} older than ${staleThreshold} days`
        : `No invites older than ${staleThreshold} days`;

    element.textContent = [averagePart, stalePart].filter(Boolean).join(' • ');
}

function formatPendingTimingText(timing, staleThreshold) {
    const parts = [];
    const average = typeof timing?.average_days === 'number' && Number.isFinite(timing.average_days)
        ? timing.average_days
        : null;
    const oldest = typeof timing?.oldest_days === 'number' && Number.isFinite(timing.oldest_days)
        ? timing.oldest_days
        : null;
    const staleCount = typeof timing?.stale_count === 'number'
        ? Math.max(0, Math.trunc(timing.stale_count))
        : 0;

    if (average !== null) {
        parts.push(`Avg ${average.toFixed(1)}d`);
    }

    if (oldest !== null) {
        parts.push(oldest > 0 ? `Oldest ${oldest}d` : 'Oldest <1d');
    }

    if (staleCount > 0) {
        parts.push(`${staleCount} ${staleCount === 1 ? 'stale invite' : 'stale invites'} (>${staleThreshold}d)`);
    }

    if (parts.length === 0) {
        return 'Fresh';
    }

    return parts.join(' • ');
}

function setStalePendingSummaries({ summaryElement, titleElement, listElement, fallbackElement, stalePending, fallback }) {
    if (!summaryElement || !titleElement || !listElement || !fallbackElement) {
        return;
    }

    const total = Number(stalePending?.total ?? 0);
    const incoming = Array.isArray(stalePending?.incoming) ? stalePending.incoming : [];
    const outgoing = Array.isArray(stalePending?.outgoing) ? stalePending.outgoing : [];
    const combined = [...incoming, ...outgoing];

    if (fallback || total === 0 || combined.length === 0) {
        summaryElement.classList.add('hidden');
        listElement.innerHTML = '';
        fallbackElement.classList.remove('hidden');
        return;
    }

    fallbackElement.classList.add('hidden');
    summaryElement.classList.remove('hidden');

    titleElement.textContent = total === 1
        ? '1 invite has gone quiet. Reach out to move it forward.'
        : `${total} invites are waiting ${combined.some(item => item.direction === 'outgoing') ? 'on your follow-up' : 'for a response'}.`;

    listElement.innerHTML = combined
        .sort((a, b) => Number(b.days_waiting ?? 0) - Number(a.days_waiting ?? 0))
        .slice(0, 5)
        .map(entry => {
            const name = escapeHtml(entry.name ?? 'Connection');
            const days = Number(entry.days_waiting ?? 0);
            const direction = entry.direction === 'incoming' ? 'Incoming' : 'Outgoing';
            return `<li class="flex items-center justify-between bg-rose-100 border border-rose-200 rounded px-2 py-1">
                <span class="font-medium">${name}</span>
                <span class="text-xs uppercase tracking-wide">${direction} • ${days}d</span>
            </li>`;
        })
        .join('');
}

function buildStatusList(statuses, total) {
    if (!Array.isArray(statuses) || statuses.length === 0) {
        return buildConnectionsFallback({
            as: 'li',
            title: 'No connection data yet',
            message: 'Add or approve connections to unlock distribution insights.',
            icon: 'fa-circle-nodes',
            tone: 'indigo',
        });
    }

    return statuses.map(status => {
        const label = escapeHtml(status.label ?? status.status ?? 'Status');
        const count = Number(status.count ?? 0);
        const percent = typeof status.percent === 'number'
            ? status.percent.toFixed(1)
            : (total > 0 ? ((count / total) * 100).toFixed(1) : '0.0');
        const color = statusColorMap[status.status] ?? '#6366f1';

        return `
            <li class="bg-white border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="inline-flex w-2.5 h-2.5 rounded-full" style="background-color: ${color};"></span>
                    <span class="text-sm font-semibold text-gray-700">${label}</span>
                </div>
                <div class="text-sm font-semibold text-gray-900">
                    ${count}
                    <span class="ml-2 text-xs font-normal text-gray-500">${percent}%</span>
                </div>
            </li>
        `;
    }).join('');
}

function renderConnectionMomentumChart(series) {
    const wrapper = document.getElementById('connectionMomentumChartWrapper');
    const fallbackEl = document.getElementById('connectionMomentumChartFallback');
    const canvas = document.getElementById('connectionMomentumChart');

    if (!wrapper || !fallbackEl || !canvas) {
        return;
    }

    if (typeof Chart === 'undefined') {
        destroyConnectionMomentumChart();
        wrapper.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        fallbackEl.innerHTML = buildConnectionsFallback({
            title: 'Chart unavailable right now',
            message: 'Weekly totals are listed below while we reload the visual.',
            icon: 'fa-triangle-exclamation',
            tone: 'sunrise',
        });
        return;
    }

    if (!Array.isArray(series) || series.length === 0) {
        destroyConnectionMomentumChart();
        wrapper.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        fallbackEl.innerHTML = buildConnectionsFallback({
            title: 'No momentum chart yet',
            message: 'Accept new connections to visualise momentum.',
            icon: 'fa-chart-line',
            tone: 'indigo',
        });
        return;
    }

    wrapper.classList.remove('hidden');
    fallbackEl.classList.add('hidden');

    const labels = series.map(entry => entry.week_label ?? formatWeekLabel(entry.week_start));
    const values = series.map(entry => Number(entry.new_connections ?? 0));

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(129, 140, 248, 0)');

    if (!connectionMomentumChart) {
        connectionMomentumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'New connections',
                        data: values,
                        fill: true,
                        tension: 0.35,
                        borderColor: 'rgba(79, 70, 229, 1)',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value = context.parsed.y ?? 0;
                                const plural = value === 1 ? '' : 's';
                                return `${value} new connection${plural}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#6b7280',
                            font: { size: 11 },
                        },
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.25)' },
                        ticks: {
                            stepSize: 1,
                            color: '#6b7280',
                            font: { size: 11 },
                        },
                    },
                },
            },
        });
    } else {
        connectionMomentumChart.data.labels = labels;
        connectionMomentumChart.data.datasets[0].data = values;
        connectionMomentumChart.data.datasets[0].backgroundColor = gradient;
        connectionMomentumChart.update();
    }
}

function destroyConnectionMomentumChart() {
    if (connectionMomentumChart) {
        connectionMomentumChart.destroy();
        connectionMomentumChart = null;
    }
}

function updateMomentumRangeLabel(series, weeks, isFallback) {
    const rangeLabel = document.getElementById('momentumRangeLabel');
    if (!rangeLabel) {
        return;
    }

    if (!Array.isArray(series) || series.length === 0) {
        rangeLabel.textContent = `Last ${weeks} week${weeks === 1 ? '' : 's'}`;
        return;
    }

    const first = series[0];
    const last = series[series.length - 1];
    const startLabel = formatWeekLabel(first.week_start ?? '');
    const endLabel = formatWeekLabel(last.week_end ?? last.week_start ?? '');

    if (isFallback || !startLabel || !endLabel) {
        rangeLabel.textContent = `Last ${weeks} week${weeks === 1 ? '' : 's'}`;
    } else {
        rangeLabel.textContent = `${startLabel} – ${endLabel}`;
    }
}

function buildMomentumTimeline(series) {
    if (!Array.isArray(series) || series.length === 0) {
        return '<div class="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm text-gray-600">No trend data yet.</div>';
    }

    const values = series.map(entry => Number(entry.new_connections ?? 0));
    const maxValue = Math.max(...values);
    const safeMax = Math.max(maxValue, 1);

    return series.map(entry => {
        const value = Number(entry.new_connections ?? 0);
        const percent = value > 0 ? Math.max(Math.round((value / safeMax) * 100), 8) : 0;
        const label = entry.week_label ?? formatWeekLabel(entry.week_start);
        return `
            <div class="bg-white border border-slate-100 rounded-lg px-3 py-2">
                <div class="flex items-center justify-between text-xs font-semibold text-gray-600">
                    <span>${escapeHtml(label ?? '')}</span>
                    <span>${value}</span>
                </div>
                <div class="mt-2 h-2 bg-slate-100 rounded">
                    <div class="h-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500" style="width: ${percent}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function formatWeekLabel(value) {
    if (!value) {
        return '';
    }

    const parts = String(value).split('-').map(part => Number(part));
    if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) {
        return value;
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function loadNetworkClusters(limit = 3) {
    const grid = document.getElementById('networkClustersGrid');
    const emptyState = document.getElementById('networkClustersEmpty');
    const metaLabel = document.getElementById('networkClustersMeta');

    if (!grid || !emptyState) {
        return;
    }

    renderClusterLoading(grid, emptyState);

    try {
        const response = await aiFeatures.getConnectionClusters(limit);
        const payload = response?.data ?? response ?? {};
        renderClusterResults(grid, emptyState, metaLabel, payload);
    } catch (error) {
        console.error('Unable to load network clusters', error);
        renderClusterError(grid, emptyState, metaLabel);
    }
}

async function loadConnectionPulse() {
    const statusLabel = document.getElementById('connectionPulseStatus');
    const metricsContainer = document.getElementById('connectionPulseMetrics');

    if (!statusLabel || !metricsContainer) {
        return;
    }

    statusLabel.textContent = 'Syncing…';
    try {
        const response = await aiFeatures.getConnectionPulse();
        const payload = response?.data ?? response ?? {};
        renderConnectionPulse(payload);
    } catch (error) {
        console.error('Unable to load connection pulse', error);
        renderConnectionPulse({ fallback: true });
    }
}

function renderConnectionPulse(payload) {
    const summary = payload?.summary ?? {};
    const statusLabel = document.getElementById('connectionPulseStatus');
    const insightsList = document.getElementById('connectionPulseInsights');
    const followUpContainer = document.getElementById('connectionPulseFollowUp');
    const metricsGrid = document.getElementById('connectionPulseMetrics');
    const metricsFallback = document.getElementById('connectionPulseMetricsFallback');

    const total = Number.isFinite(Number(summary.total_connections)) ? summary.total_connections : 0;
    const newConnections = Number.isFinite(Number(summary.new_connections_30_days)) ? summary.new_connections_30_days : 0;
    const pendingIncoming = Number.isFinite(Number(summary.pending_incoming)) ? summary.pending_incoming : 0;
    const acceptanceRate = payload?.acceptance_rate;

    setMetricValue('pulseMetricTotal', total);
    setMetricValue('pulseMetricNew', newConnections);
    setMetricValue('pulseMetricPendingIncoming', pendingIncoming);
    setMetricValue('pulseMetricAcceptance', acceptanceRate !== null && acceptanceRate !== undefined ? `${acceptanceRate}%` : '—');

    if (payload?.fallback) {
        if (statusLabel) {
            statusLabel.textContent = 'No connection data yet';
        }
        if (insightsList) {
            insightsList.innerHTML = buildConnectionsFallback({
                title: 'Insights await',
                message: 'Start connecting to unlock tailored guidance built around your goals.',
                icon: 'fa-lightbulb',
                tone: 'sunrise',
                as: 'li',
            });
        }
        if (followUpContainer) {
            followUpContainer.innerHTML = buildConnectionsFallback({
                title: 'All quiet for now',
                    if (metricsGrid) {
                        metricsGrid.classList.add('hidden');
                    }
                    if (metricsFallback) {
                        metricsFallback.classList.remove('hidden');
                        const pulsePrompts = [
                            {
                                icon: 'fa-user-friends',
                                title: 'Grow total connections',
                                message: 'Send warm invites and accept requests to see this metric come alive.',
                                tone: 'indigo',
                            },
                            {
                                icon: 'fa-handshake',
                                title: 'Spark new approvals',
                                message: 'Aim for a few fresh connections each week to fuel your 30-day trend.',
                                tone: 'rose',
                            },
                            {
                                icon: 'fa-chart-line',
                                title: 'Boost acceptance rate',
                                message: 'Personalise outreach and respond quickly to keep momentum high.',
                                tone: 'sunrise',
                            },
                        ];

                        metricsFallback.innerHTML = `
                            <div class="connections-quick-grid connections-quick-grid--prompt">
                                ${pulsePrompts.map(buildQuickPromptCard).join('')}
                            </div>
                        `;
                    }

                    setMetricValue('pulseMetricTotal', '—');
                    setMetricValue('pulseMetricNew', '—');
                    setMetricValue('pulseMetricPendingIncoming', '—');
                    setMetricValue('pulseMetricAcceptance', '—');
                message: 'No pending follow-ups just yet—keep nurturing those fresh connections.',
                icon: 'fa-inbox',
                tone: 'mint',
            });
        }
        return;
    }

    if (metricsGrid) {
        metricsGrid.classList.remove('hidden');
    }
    if (metricsFallback) {
        metricsFallback.classList.add('hidden');
        metricsFallback.innerHTML = '';
    }

    if (statusLabel) {
        const direction = payload?.trend?.direction ?? 'stable';
        statusLabel.textContent = `Updated just now • ${direction === 'rising' ? 'Momentum rising' : (direction === 'declining' ? 'Momentum dipping' : 'Stable activity')}`;
    }

    if (insightsList) {
        const insights = Array.isArray(payload?.insights) ? payload.insights : [];

        if (!insights.length) {
            insightsList.innerHTML = buildConnectionsFallback({
                title: 'Keep the rhythm',
                message: 'Schedule a weekly networking hour to surface bespoke tips here.',
                icon: 'fa-sparkles',
                tone: 'sunrise',
                as: 'li',
            });
        } else {
            insightsList.innerHTML = insights
                .map(item => `<li class="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">${escapeHtml(item)}</li>`)
                .join('');
        }
    }

    if (followUpContainer) {
        const followUp = payload?.follow_up ?? { incoming: [], outgoing: [] };
        followUpContainer.innerHTML = buildFollowUpHtml(followUp);
    }
}

function setMetricValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    element.textContent = value === undefined || value === null ? '—' : value;
}

function buildFollowUpHtml(followUp) {
    const incoming = Array.isArray(followUp.incoming) ? followUp.incoming : [];
    const outgoing = Array.isArray(followUp.outgoing) ? followUp.outgoing : [];

    if (incoming.length === 0 && outgoing.length === 0) {
        return buildConnectionsFallback({
            title: 'Inbox is clear',
            message: 'You have no follow-ups waiting—enjoy the momentum!',
            icon: 'fa-check-double',
            tone: 'mint',
        });
    }

    const sections = [];

    if (incoming.length > 0) {
        sections.push(`
            <div class="bg-white border border-indigo-100 rounded-lg p-3 shadow-sm">
                <p class="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Incoming requests</p>
                ${incoming.slice(0, 3).map(buildFollowUpChip).join('')}
            </div>
        `);
    }

    if (outgoing.length > 0) {
        sections.push(`
            <div class="bg-white border border-purple-100 rounded-lg p-3 shadow-sm">
                <p class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Awaiting responses</p>
                ${outgoing.slice(0, 3).map(buildFollowUpChip).join('')}
            </div>
        `);
    }

    return sections.join('');
}

function buildFollowUpChip(entry) {
    const name = escapeHtml(entry?.name ?? '{{ addslashes($memberLabel) }}');
    return `
        <div class="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-2 last:mb-0">
            <span class="text-sm text-gray-700">${name}</span>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Review</button>
        </div>
    `;
}

function renderClusterLoading(grid, emptyState) {
    emptyState.style.display = 'block';
    emptyState.textContent = 'Calibrating your clusters…';
    const skeletonCard = `
        <div class="cluster-card cluster-card--loading animate-pulse">
            <div class="cluster-card__header">
                <div class="cluster-card__icon cluster-card__icon--placeholder"></div>
                <div class="flex-1 space-y-2">
                    <div class="h-4 bg-rose-100 rounded w-3/5"></div>
                    <div class="h-3 bg-rose-50 rounded w-2/5"></div>
                </div>
            </div>
            <div class="space-y-2 mt-4">
                <div class="h-3 bg-rose-50 rounded"></div>
                <div class="h-3 bg-rose-50 rounded w-4/5"></div>
                <div class="h-3 bg-rose-50 rounded w-2/3"></div>
            </div>
        </div>
    `;

    grid.innerHTML = Array.from({ length: 3 }).map(() => skeletonCard).join('');
}

function renderClusterError(grid, emptyState, metaLabel) {
    grid.innerHTML = '<div class="cluster-card cluster-card--empty"><p class="cluster-card__title">We could not surface clusters right now.</p><p class="cluster-card__meta">Please try again soon.</p></div>';
    emptyState.style.display = 'none';
    if (metaLabel) {
        metaLabel.textContent = '';
    }
}

function renderClusterResults(grid, emptyState, metaLabel, payload) {
    const clusters = Array.isArray(payload.clusters) ? payload.clusters : [];
    const fallback = Boolean(payload.fallback);

    if (fallback || clusters.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.textContent = 'No tailored clusters yet — grow your profile signals to unlock grouped introductions.';
        if (metaLabel) {
            metaLabel.textContent = '';
        }
        return;
    }

    emptyState.style.display = 'none';

    grid.innerHTML = clusters.map(cluster => buildClusterCard(cluster)).join('');

    if (metaLabel) {
        const total = Number(payload.meta?.total_candidates ?? 0);
        const totalClusters = clusters.length;
        metaLabel.textContent = total > 0
            ? `${total} profiles analysed • ${totalClusters} curated cluster${totalClusters === 1 ? '' : 's'}`
            : `${totalClusters} curated cluster${totalClusters === 1 ? '' : 's'}`;
    }
}

function buildClusterCard(cluster) {
    const icon = clusterIconMap[cluster.key] ?? 'fa-user-group';
    const label = escapeHtml(cluster.label ?? 'Suggested Cluster');
    const allMembers = Array.isArray(cluster.members) ? cluster.members : [];
    const members = allMembers.slice(0, 3);
    const totalMembers = allMembers.length;

    const memberItems = members.map(member => buildClusterMember(member)).join('');

    return `
        <div class="cluster-card">
            <div class="cluster-card__header">
                <div class="cluster-card__icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div>
                    <p class="cluster-card__title">${label}</p>
                    <p class="cluster-card__meta">${totalMembers} warm introduction${totalMembers === 1 ? '' : 's'}</p>
                </div>
            </div>
            <ul class="cluster-card__members">
                ${memberItems || '<li class="cluster-member cluster-member--empty">We need more signal to finalise this cluster.</li>'}
            </ul>
        </div>
    `;
}

function buildClusterMember(member) {
    const name = escapeHtml(member?.name ?? 'Potential connection');
    const reasonText = member?.reason ? escapeHtml(member.reason) : '';
    const score = Number(member?.score ?? 0);
    const scoreBadge = Number.isFinite(score) && score > 0
        ? `<span class="cluster-member__score">${score}</span>`
        : '';

    return `
        <li class="cluster-member">
            <div class="cluster-member__header">
                <span class="cluster-member__name">${name}</span>
                ${scoreBadge}
            </div>
            ${reasonText ? `<p class="cluster-member__reason">${reasonText}</p>` : ''}
        </li>
    `;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildQuickPromptCard({ icon = 'fa-sparkles', title = '', message = '', tone = '' } = {}) {
    const iconClass = tone ? ` connections-quick-icon--${tone}` : '';

    return `
        <div class="connections-quick-card connections-quick-card--prompt">
            <span class="connections-quick-icon${iconClass}">
                <i class="fas ${icon}"></i>
            </span>
            <div class="connections-quick-copy">
                <span class="connections-quick-title">${escapeHtml(title)}</span>
                <span>${escapeHtml(message)}</span>
            </div>
        </div>
    `;
}

function buildConnectionsFallback({ title = '', message = '', icon = 'fa-sparkles', tone = 'indigo', as = 'div' } = {}) {
    const tag = as === 'li' ? 'li' : 'div';
    const toneClass = tone ? ` connections-fallback--${tone}` : '';
    const listClass = as === 'li' ? ' connections-fallback--list' : '';
    const iconMarkup = icon ? `<span class="connections-fallback__icon"><i class="fas ${icon}"></i></span>` : '';
    const titleMarkup = title ? `<p class="connections-fallback__title">${escapeHtml(title)}</p>` : '';
    const messageMarkup = message ? `<p class="connections-fallback__copy">${escapeHtml(message)}</p>` : '';

    return `<${tag} class="connections-fallback${toneClass}${listClass}">${iconMarkup}<div class="connections-fallback__body">${titleMarkup}${messageMarkup}</div></${tag}>`;
}

function initializeConnectionInteractions() {
    connectionsGridRef = document.getElementById('connectionsGrid');
    allConnectionCards = Array.from(connectionsGridRef?.querySelectorAll('.connection-card') ?? []);

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortSelect = document.getElementById('sortBy');

    if (searchInput) {
        searchInput.addEventListener('input', searchConnections);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', filterConnections);
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', sortConnections);
    }

    document.querySelectorAll('[data-connection-target]').forEach(button => {
        button.addEventListener('click', event => {
            const targetId = event.currentTarget.dataset.connectionTarget;
            scrollToConnectionCard(targetId);
        });
    });

    applyConnectionFilters();
}

function applyConnectionFilters() {
    if (!connectionsGridRef) {
        return;
    }

    if (!allConnectionCards.length) {
        allConnectionCards = Array.from(connectionsGridRef.querySelectorAll('.connection-card'));
    }

    const matches = allConnectionCards.filter(card => {
        const searchIndex = (card.dataset.search || '').toLowerCase();
        const status = (card.dataset.status || '').toLowerCase();
        const matchesSearch = !connectionState.search || searchIndex.includes(connectionState.search);
        const matchesStatus = !connectionState.status || status === connectionState.status.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    const matchesSet = new Set(matches);
    allConnectionCards.forEach(card => {
        card.style.display = matchesSet.has(card) ? 'block' : 'none';
    });

    const sorted = matches.slice();
    switch (connectionState.sort) {
        case 'name':
            sorted.sort((a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || '', undefined, { sensitivity: 'base' }));
            break;
        case 'mutual':
            sorted.sort((a, b) => Number(b.dataset.mutual || 0) - Number(a.dataset.mutual || 0));
            break;
        default:
            sorted.sort((a, b) => Number(b.dataset.createdAt || 0) - Number(a.dataset.createdAt || 0));
            break;
    }

    sorted.forEach(card => connectionsGridRef.appendChild(card));

    const emptyState = document.getElementById('connectionsEmptyFiltered');
    if (emptyState) {
        emptyState.classList.toggle('hidden', sorted.length > 0);
    }
}

function searchConnections() {
    const searchInput = document.getElementById('searchInput');
    connectionState.search = (searchInput?.value || '').trim().toLowerCase();
    applyConnectionFilters();
}

function filterConnections() {
    const statusFilter = document.getElementById('statusFilter');
    connectionState.status = statusFilter?.value || '';
    applyConnectionFilters();
}

function sortConnections() {
    const sortSelect = document.getElementById('sortBy');
    connectionState.sort = sortSelect?.value || 'recent';
    applyConnectionFilters();
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const sortSelect = document.getElementById('sortBy');

    if (searchInput) {
        searchInput.value = '';
    }
    if (statusFilter) {
        statusFilter.value = '';
    }
    if (sortSelect) {
        sortSelect.value = 'recent';
    }

    connectionState.search = '';
    connectionState.status = '';
    connectionState.sort = 'recent';

    applyConnectionFilters();
}

async function shareProfileLink(button) {
    const link = button?.dataset?.shareLink;
    if (!link) {
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(link);
        } else {
            const temp = document.createElement('textarea');
            temp.value = link;
            temp.setAttribute('readonly', '');
            temp.style.position = 'absolute';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        showConnectionToast('Profile link copied. Share the vibe!');
    } catch (error) {
        console.error('Unable to copy profile link', error);
        showConnectionToast('Copy failed. Please try again.', 'error');
    }
}

function scrollToConnectionCard(targetId) {
    if (!targetId) {
        return;
    }

    const card = document.getElementById(targetId);
    if (!card) {
        return;
    }

    if (card.style.display === 'none') {
        resetFilters();
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('connection-card--pulse');
    setTimeout(() => card.classList.remove('connection-card--pulse'), 1400);
}

function showConnectionToast(message, variant = 'success') {
    const toast = document.getElementById('connectionActionToast');
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.remove('hidden', 'connection-toast--success', 'connection-toast--error');
    toast.classList.add(variant === 'error' ? 'connection-toast--error' : 'connection-toast--success', 'connection-toast--visible');

    if (connectionToastTimer) {
        clearTimeout(connectionToastTimer);
    }

    connectionToastTimer = setTimeout(() => {
        toast.classList.remove('connection-toast--visible');
        toast.classList.add('hidden');
    }, 3200);
}

async function removeConnection(connectionId) {
    if (!connectionId) {
        return;
    }

    const confirmed = confirm('Are you sure you want to remove this connection?');
    if (!confirmed) {
        return;
    }

    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';

    try {
        const response = await fetch(`/member/social/connections/${connectionId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': token,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json().catch(() => ({ success: true, message: 'Connection removed.' }));

        const card = document.getElementById(`connection-card-${connectionId}`);
        if (card) {
            card.remove();
            allConnectionCards = allConnectionCards.filter(item => item !== card);
            applyConnectionFilters();
        }

        showConnectionToast(payload?.message ?? 'Connection removed.');
    } catch (error) {
        console.error('Unable to remove connection', error);
        showConnectionToast('Unable to remove connection right now. Please try again.', 'error');
    }
}
</script>
@endpush
@endsection
