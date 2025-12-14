@extends('admin.layouts.master')

@section('contents')
<div class="container-fluid">
    <div class="page-header">
        <h3 class="page-title">Social Moderation</h3>
        <p class="mb-0 text-muted">Monitor policy enforcement, reports, and transparency logs.</p>
    </div>

    <div class="row">
        <div class="col-md-3">
            <div class="card shadow-sm">
                <div class="card-body">
                    <p class="text-uppercase text-muted mb-1">Open Reports</p>
                    <h3 class="mb-0">{{ number_format($stats['open_reports']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm">
                <div class="card-body">
                    <p class="text-uppercase text-muted mb-1">Active Blocks</p>
                    <h3 class="mb-0">{{ number_format($stats['active_blocks']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm">
                <div class="card-body">
                    <p class="text-uppercase text-muted mb-1">Actions (7d)</p>
                    <h3 class="mb-0">{{ number_format($stats['actions_7_days']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card shadow-sm">
                <div class="card-body">
                    <p class="text-uppercase text-muted mb-1">Public Logs</p>
                    <h3 class="mb-0">{{ number_format($stats['public_logs']) }}</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="row mt-4">
        <div class="col-lg-6">
            <div class="card h-100 shadow-sm">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Recent Reports</h5>
                    <a href="{{ route('admin.moderation.reports') }}" class="btn btn-sm btn-outline-primary">View all</a>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                        @forelse($recentReports as $report)
                            <a class="list-group-item list-group-item-action" href="{{ route('admin.moderation.reports.show', $report) }}">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <strong>{{ ucfirst($report->category) }}</strong>
                                        <span class="badge bg-light text-dark ms-2">{{ ucfirst($report->severity) }}</span>
                                    </div>
                                    <small class="text-muted">{{ $report->created_at->diffForHumans() }}</small>
                                </div>
                                <p class="mb-0 text-muted small">Status: {{ ucfirst(str_replace('_', ' ', $report->status)) }}</p>
                            </a>
                        @empty
                            <div class="list-group-item text-muted">No reports yet.</div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card h-100 shadow-sm">
                <div class="card-header">
                    <h5 class="mb-0">Latest Transparency Logs</h5>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                        @forelse($recentLogs as $log)
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <strong>{{ ucfirst($log->action) }}</strong>
                                        <span class="text-muted">{{ $log->decision ?: 'pending' }}</span>
                                    </div>
                                    <small class="text-muted">{{ $log->created_at->diffForHumans() }}</small>
                                </div>
                                <p class="mb-0 text-muted small">{{ \Illuminate\Support\Str::limit($log->rationale, 120) }}</p>
                            </div>
                        @empty
                            <div class="list-group-item text-muted">No transparency entries.</div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
