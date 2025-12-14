@extends('admin.layouts.master')

@section('title', 'ETL Monitoring')

@section('contents')
<div class="container-fluid py-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
            <h2 class="mb-1">Data Pipeline Monitor</h2>
            <p class="text-muted mb-0">Lightweight view into nightly ETL jobs powering social analytics.</p>
        </div>
        <div class="text-muted small">
            Last capture: <span class="fw-semibold">{{ $latestDate ?? '—' }}</span>
        </div>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Most Recent Run</p>
                    <h3 class="mb-0">{{ $latestDate ?? '—' }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Personas Processed</p>
                    <h3 class="mb-0">{{ number_format($personasProcessed) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">Pipelines Tracked</p>
                    <h3 class="mb-0">{{ count($pipelines) }}</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="card shadow-sm mb-4">
        <div class="card-header">
            <h5 class="mb-0">Pipelines</h5>
        </div>
        <div class="table-responsive">
            <table class="table table-hover mb-0 align-middle">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Last Run</th>
                        <th>Personas</th>
                        <th>Description</th>
                        <th>Command</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($pipelines as $pipeline)
                        <tr>
                            <td class="fw-semibold">{{ $pipeline['name'] }}</td>
                            <td>{{ $pipeline['last_run'] }}</td>
                            <td>{{ number_format($pipeline['personas_processed']) }}</td>
                            <td class="text-muted">{{ $pipeline['description'] }}</td>
                            <td>
                                <code>{{ $pipeline['command'] }}</code>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>

    <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Recent Fact Loads</h5>
            <span class="text-muted small">Last 7 capture dates</span>
        </div>
        <div class="table-responsive">
            <table class="table table-striped mb-0">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Personas</th>
                        <th>Total Connections</th>
                        <th>Invites Sent</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($recentRuns as $run)
                        <tr>
                            <td>{{ $run['captured_on'] }}</td>
                            <td>{{ number_format($run['personas']) }}</td>
                            <td>{{ number_format($run['connections']) }}</td>
                            <td>{{ number_format($run['invites']) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="text-center text-muted py-4">No ETL data has been captured yet.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <div class="card-footer text-muted small">
            Monitor this page after running <code>php artisan social:metrics-daily --force</code> in lower environments.
        </div>
    </div>
</div>
@endsection
