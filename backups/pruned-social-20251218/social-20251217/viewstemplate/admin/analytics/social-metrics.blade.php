@extends('admin.layouts.master')

@section('title', 'Social Graph Metrics')

@section('contents')
@php
    $range = $range ?? 'day';
    $rangeOptions = $rangeOptions ?? ['day' => 'Daily snapshot', 'rolling7' => 'Rolling 7-day'];
    $trendRange = $trendRange ?? 7;
    $trendOptions = $trendOptions ?? [7, 28];
@endphp
<div class="container-fluid py-3">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h2 class="mb-1">Social Graph Health</h2>
            <p class="text-muted mb-0">{{ isset($rangeOptions[$range]) ? $rangeOptions[$range] : 'Daily snapshot' }} ending {{ $selectedDate }}</p>
        </div>
        <form method="get" class="d-flex flex-wrap gap-2 align-items-end">
            <div>
                <label class="form-label small text-muted mb-1">Date</label>
                <input type="date" name="date" class="form-control" value="{{ $selectedDate }}">
            </div>
            <div>
                <label class="form-label small text-muted mb-1">Persona ID</label>
                <input type="number" name="persona_id" class="form-control" placeholder="Persona ID" value="{{ $personaFilter }}">
            </div>
            <div>
                <label class="form-label small text-muted mb-1">Window</label>
                <select name="range" class="form-select">
                    @foreach($rangeOptions as $key => $label)
                        <option value="{{ $key }}" @selected($range === $key)>{{ $label }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label class="form-label small text-muted mb-1">Trend range</label>
                <select name="trend_range" class="form-select">
                    @foreach($trendOptions as $option)
                        <option value="{{ $option }}" @selected($trendRange === $option)>Last {{ $option }} days</option>
                    @endforeach
                </select>
            </div>
            <div>
                <button class="btn btn-primary" type="submit">Update View</button>
            </div>
        </form>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-md-3">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Tracked Personas</p>
                    <h3 class="mb-0">{{ number_format($summary['total_personas']) }}</h3>
                    <small class="text-muted">{{ $range === 'day' ? 'Single day snapshot' : 'Unique personas in window' }}</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Connections</p>
                    <h3 class="mb-0">{{ number_format($summary['total_connections']) }}</h3>
                    <small class="text-muted">{{ $range === 'day' ? 'Captured on '.$selectedDate : 'Latest totals per persona' }}</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Invites (Sent / Accepted)</p>
                    <h3 class="mb-0">{{ number_format($summary['invites_sent']) }} / {{ number_format($summary['invites_accepted']) }}</h3>
                    <small class="text-muted">Summed across {{ $range === 'day' ? 'selected day' : 'rolling window' }}</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Avg Civility</p>
                    @php $avgCivility = $summary['avg_civility'] ?? null; @endphp
                    <h3 class="mb-0">{{ $avgCivility !== null ? number_format($avgCivility, 2) : '—' }}</h3>
                    <small class="text-muted">Scale 1-5</small>
                </div>
            </div>
        </div>
    </div>

    <div class="card mb-4 shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Last {{ $trendRange }} Days</h5>
            <span class="text-muted small">Connections vs. Invites sent</span>
        </div>
        <div class="card-body">
            <canvas id="socialMetricsTrendChart" height="120"></canvas>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Persona Snapshot</h5>
            <span class="text-muted small">Showing {{ count($records ?? []) }} of {{ number_format($totalCount) }} personas for {{ $selectedDate }}</span>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead>
                    <tr>
                        <th>Persona</th>
                        <th>Connections</th>
                        <th>Invites Sent</th>
                        <th>Invites Accepted</th>
                        <th>Civility</th>
                        <th>Pending Incoming</th>
                        <th>Pending Outgoing</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($records as $row)
                        @php
                            $persona = $row->persona;
                            $heatmap = $row->connection_heatmap_bins ?? [];
                            $pending = $heatmap['pending'] ?? ['incoming' => 0, 'outgoing' => 0];
                        @endphp
                        <tr>
                            <td>
                                <div class="fw-semibold">{{ $persona?->display_name ?? 'Persona #'.$row->persona_id }}</div>
                                <small class="text-muted">ID: {{ $row->persona_id }}</small>
                            </td>
                            <td>{{ number_format($row->total_connections) }}</td>
                            <td>{{ number_format($row->total_invites_sent) }}</td>
                            <td>{{ number_format($row->total_invites_accepted) }}</td>
                            <td>{{ $row->messaging_civility_score === null ? '—' : number_format($row->messaging_civility_score, 1) }}</td>
                            <td>{{ number_format($pending['incoming'] ?? 0) }}</td>
                            <td>{{ number_format($pending['outgoing'] ?? 0) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="text-center text-muted py-4">No metrics available for the selected filters.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <div class="card-footer text-muted small">
            Data derived from social_metrics_daily fact table. Use filters above to refine view.
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const ctx = document.getElementById('socialMetricsTrendChart');
        if (!ctx || typeof Chart === 'undefined') {
            return;
        }

        const dataset = @json($trendSeries);
        const labels = dataset.map(point => point.captured_on);
        const connections = dataset.map(point => Number(point.total_connections));
        const invites = dataset.map(point => Number(point.total_invites_sent));

        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Connections',
                        data: connections,
                        borderColor: '#4f46e5',
                        tension: 0.3,
                        fill: false,
                    },
                    {
                        label: 'Invites Sent',
                        data: invites,
                        borderColor: '#0ea5e9',
                        tension: 0.3,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });
    });
</script>
@endpush
