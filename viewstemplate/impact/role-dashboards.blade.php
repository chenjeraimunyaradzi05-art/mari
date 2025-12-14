@extends('frontend.layouts.master')

@section('title', 'Role Dashboard Impact Monitor')
@section('meta_description', 'Live adoption and widget SLA telemetry backing the nine role dashboards inside Athena.')

@push('styles')
    <style>
        .impact-shell {
            padding: 3rem 0 4rem;
            background: linear-gradient(180deg, #05010c 0%, #120f1b 50%, #05010c 100%);
            color: #fff;
            min-height: 100vh;
        }
        .impact-shell h1,
        .impact-shell h2,
        .impact-shell h3 {
            color: #fff;
        }
        .impact-hero {
            max-width: 920px;
            margin: 0 auto 3rem;
            text-align: center;
        }
        .impact-hero__eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            border-radius: 999px;
            padding: 0.2rem 0.85rem;
            background: rgba(255, 255, 255, 0.1);
            font-size: 0.85rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .impact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
        }
        .impact-card {
            border-radius: 24px;
            padding: 1.5rem;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 15px 45px rgba(2, 0, 28, 0.35);
        }
        .impact-card__label {
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.08em;
            color: rgba(255, 255, 255, 0.7);
        }
        .impact-card__value {
            font-size: 2.75rem;
            font-weight: 600;
            margin: 0.5rem 0 0.25rem;
        }
        .impact-section {
            margin: 3rem auto 0;
            padding: 2.5rem;
            border-radius: 32px;
            background: rgba(11, 8, 22, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .impact-section + .impact-section {
            margin-top: 2rem;
        }
        .impact-section__header {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1.75rem;
        }
        @media (min-width: 768px) {
            .impact-section__header {
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
            }
        }
        .impact-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        .impact-table thead th {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(255, 255, 255, 0.6);
            padding-bottom: 0.35rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .impact-table tbody td {
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .trend-sparkline {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.25rem;
            margin-top: 0.75rem;
        }
        .trend-sparkline span {
            display: block;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.25);
            min-height: 6px;
        }
        .trend-sparkline span[data-volume]::after {
            content: '';
            display: block;
            height: calc(12px + (var(--volume) * 24px));
            background: linear-gradient(180deg, #ff66d8, #ff9ef0);
            border-radius: 6px;
        }
        .sla-pill {
            padding: 0.15rem 0.75rem;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .sla-pill--good {
            background: rgba(34, 197, 94, 0.15);
            color: #a7f3d0;
            border: 1px solid rgba(34, 197, 94, 0.35);
        }
        .sla-pill--breach {
            background: rgba(239, 68, 68, 0.15);
            color: #fecaca;
            border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .impact-note {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.65);
        }
    </style>
@endpush

@section('contents')
<div class="impact-shell">
    <div class="container">
        <header class="impact-hero">
            <div class="impact-hero__eyebrow"><i class="fas fa-wave-square"></i> Role Dashboard Telemetry</div>
            <h1 class="display-4 fw-semibold mt-3">Adoption + widget health across the nine dashboards.</h1>
            <p class="lead text-muted">Windows: {{ $adoptionWindow }} day adoption · {{ $slaWindow }} day SLA · {{ $slaThreshold }}ms threshold. Backed by analytics events streaming from the dashboard service.</p>
            <p class="impact-note">Want full fidelity? Load the <a class="text-info" href="{{ route('api.v1.analytics.role-dashboards.show') }}" target="_blank" rel="noopener">role dashboard analytics API</a> or import the Grafana panels in <code>docs/observability/grafana/role-dashboard-telemetry.json</code>.</p>
        </header>

        <section class="impact-grid mb-4">
            <article class="impact-card">
            <p class="impact-card__label">Total views ({{ data_get($adoption, 'range.from') }} → {{ data_get($adoption, 'range.to') }})</p>
                <p class="impact-card__value">{{ number_format(array_sum(array_column($adoption['series'] ?? [], 'total_views'))) }}</p>
                <p class="text-muted mb-0">Across all nine dashboards during the selected window.</p>
            </article>
            <article class="impact-card">
                <p class="impact-card__label">Unique members</p>
                <p class="impact-card__value">
                    {{ number_format(collect($adoption['series'] ?? [])->reduce(fn ($carry, $role) => $carry + ($role['unique_members'] ?? 0), 0)) }}
                </p>
                <p class="text-muted mb-0">Each persona counted once even if they glance daily.</p>
            </article>
            <article class="impact-card">
                <p class="impact-card__label">Average widgets per session</p>
                <p class="impact-card__value">
                    {{ number_format(collect($adoption['series'] ?? [])->avg(fn ($role) => $role['avg_widgets_per_session'] ?? 0), 2) }}
                </p>
                <p class="text-muted mb-0">Widgets loaded per dashboard render.</p>
            </article>
            <article class="impact-card">
                <p class="impact-card__label">SLA threshold</p>
                <p class="impact-card__value">{{ number_format($slaThreshold) }}ms</p>
                <p class="text-muted mb-0">Anything slower flags inside Grafana + Impact view.</p>
            </article>
        </section>

        <section class="impact-section" id="adoption">
            <div class="impact-section__header">
                <div>
                    <h2 class="h4 mb-1">Adoption trend by role</h2>
                    <p class="text-muted mb-0">Raw telemetry pulled from <code>role_dashboard.viewed</code>. Track daily momentum and widget engagement per persona.</p>
                </div>
            </div>
            <div class="impact-grid">
                @forelse(($adoption['series'] ?? []) as $roleSeries)
                    @php
                        $daily = collect($roleSeries['daily'] ?? [])->sortBy('date')->values();
                        if ($daily->count() > 7) {
                            $daily = $daily->slice(-7)->values();
                        }
                        $maxViews = max(1, $daily->max(fn ($row) => $row['views'] ?? 0));
                    @endphp
                    <article class="impact-card">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <p class="impact-card__label">{{ ucfirst(str_replace('_', ' ', $roleSeries['role'])) }}</p>
                                <p class="impact-card__value">{{ number_format($roleSeries['total_views']) }}</p>
                            </div>
                            <div class="text-end">
                                <p class="mb-0 text-muted small">Unique members</p>
                                <p class="fs-4 fw-semibold mb-0">{{ number_format($roleSeries['unique_members']) }}</p>
                            </div>
                        </div>
                        <p class="mt-2 mb-0 text-muted small">Avg widgets / session: {{ number_format($roleSeries['avg_widgets_per_session'], 2) }}</p>
                        <div class="trend-sparkline" aria-label="Daily views sparkline">
                            @foreach($daily as $index => $row)
                                @php
                                    $volume = $maxViews ? ($row['views'] / $maxViews) : 0;
                                @endphp
                                <span data-volume style="--volume: {{ $volume }}" title="{{ $row['date'] }} · {{ number_format($row['views']) }} views"></span>
                            @endforeach
                        </div>
                        <table class="impact-table mt-3">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Views</th>
                                    <th>Members</th>
                                    <th>Widgets</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($daily as $row)
                                    <tr>
                                        <td>{{ \Carbon\Carbon::parse($row['date'])->format('M j') }}</td>
                                        <td>{{ number_format($row['views']) }}</td>
                                        <td>{{ number_format($row['unique_members']) }}</td>
                                        <td>{{ number_format($row['avg_widgets_per_session'], 2) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="text-muted">No telemetry logged yet.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </article>
                @empty
                    <p class="text-muted">No adoption telemetry has been recorded for the selected window.</p>
                @endforelse
            </div>
        </section>

        <section class="impact-section" id="widget-sla">
            <div class="impact-section__header">
                <div>
                    <h2 class="h4 mb-1">Widget SLA snapshot</h2>
                    <p class="text-muted mb-0">Based on <code>role_dashboard.widget.rendered</code> events. Breach = render time above {{ number_format($slaThreshold) }}ms.</p>
                </div>
            </div>
            <div class="impact-grid">
                @forelse(($widgetSla['roles'] ?? []) as $role)
                    <article class="impact-card">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <p class="impact-card__label">{{ ucfirst(str_replace('_', ' ', $role['role'])) }}</p>
                                <p class="impact-card__value">{{ number_format($role['totals']['render_events']) }}</p>
                            </div>
                            @php
                                $breachRate = $role['totals']['breach_rate_percent'];
                                $breachClass = $breachRate <= 5 ? 'sla-pill--good' : 'sla-pill--breach';
                                $breachLabel = $breachRate <= 5 ? 'Healthy' : 'Investigate';
                            @endphp
                            <span class="sla-pill {{ $breachClass }}">{{ $breachLabel }} · {{ number_format($breachRate, 2) }}%</span>
                        </div>
                        <p class="text-muted small mb-2">Per-widget render timings</p>
                        <table class="impact-table">
                            <thead>
                                <tr>
                                    <th>Widget</th>
                                    <th>Avg</th>
                                    <th>p95</th>
                                    <th>Max</th>
                                    <th>Breach %</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($role['widgets'] as $widget)
                                    <tr>
                                        <td>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $widget['widget_key'] ?? '')) }}</td>
                                        <td>{{ number_format($widget['avg_duration_ms'], 2) }}ms</td>
                                        <td>{{ number_format($widget['p95_duration_ms'], 2) }}ms</td>
                                        <td>{{ number_format($widget['max_duration_ms'], 2) }}ms</td>
                                        <td>{{ number_format($widget['breach_rate_percent'], 2) }}%</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="5" class="text-muted">No widget telemetry recorded.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </article>
                @empty
                    <p class="text-muted">No widget metrics recorded yet.</p>
                @endforelse
            </div>
        </section>
    </div>
</div>
@endsection
