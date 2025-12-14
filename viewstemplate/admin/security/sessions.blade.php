@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Session Security</h1>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item">Security</div>
                <div class="breadcrumb-item active">Active Sessions</div>
            </div>
        </div>

        <div class="section-body">
            @if (session('success'))
                <div class="alert alert-success alert-dismissible fade show" role="alert">
                    {{ session('success') }}
                    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            @endif

            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-primary">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Tracked Sessions</h4>
                            </div>
                            <div class="card-body">
                                {{ number_format($metrics['active_sessions']) }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-warning">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Affected Members</h4>
                            </div>
                            <div class="card-body">
                                {{ number_format($metrics['unique_users']) }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-success">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="card-wrap">
                            <div class="card-header">
                                <h4>Most Recent Activity</h4>
                            </div>
                            <div class="card-body">
                                {{ $metrics['last_activity'] }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h4>Active Sessions</h4>
                    <div class="card-header-action">
                        <form method="GET" action="{{ route('admin.security.sessions.index') }}" class="form-inline">
                            <div class="form-group mr-2">
                                <input type="text" name="search" value="{{ $filters['search'] ?? '' }}" class="form-control"
                                    placeholder="Filter by user, IP, device">
                            </div>
                            <div class="form-group mr-2">
                                <input type="number" min="1" name="user_id" value="{{ $filters['user_id'] ?? '' }}" class="form-control"
                                    placeholder="User ID">
                            </div>
                            <button class="btn btn-primary mr-2" type="submit"><i class="fas fa-search mr-1"></i>Filter</button>
                            <a href="{{ route('admin.security.sessions.index') }}" class="btn btn-light">Reset</a>
                        </form>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Network</th>
                                    <th>Device</th>
                                    <th>Location</th>
                                    <th>Last Activity</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($sessions as $session)
                                    <tr>
                                        <td>
                                            <div class="font-weight-600">{{ optional($session->user)->name ?? 'Deleted user' }}</div>
                                            <div class="text-muted small">{{ optional($session->user)->email ?? '—' }}</div>
                                            <div class="text-muted small">#{{ $session->user_id }}</div>
                                        </td>
                                        <td>
                                            <div>{{ $session->ip_address ?? 'Unknown IP' }}</div>
                                            <div class="text-muted small">{{ \Illuminate\Support\Str::limit($session->user_agent, 32) }}</div>
                                        </td>
                                        <td>
                                            <div class="font-weight-600">{{ $session->device_name ?? 'Unknown device' }}</div>
                                            <div class="text-muted small text-uppercase">{{ $session->browser ?? 'browser' }} · {{ $session->platform ?? 'platform' }}</div>
                                            <span class="badge badge-light text-uppercase">{{ $session->device_type ?? 'n/a' }}</span>
                                        </td>
                                        <td>
                                            @php
                                                $location = collect([$session->location_city, $session->location_country])
                                                    ->filter()
                                                    ->implode(', ');
                                            @endphp
                                            {{ $location ?: 'Unknown' }}
                                        </td>
                                        <td>
                                            <div>{{ optional($session->last_activity)->format('M d, Y H:i') ?? 'n/a' }}</div>
                                            <div class="text-muted small">
                                                {{ optional($session->last_activity)?->diffForHumans() ?? '—' }}
                                            </div>
                                        </td>
                                        <td class="text-right">
                                            <form method="POST"
                                                action="{{ route('admin.security.sessions.destroy', $session) }}"
                                                onsubmit="return confirm('Revoke this session? This will sign the member out.');">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="btn btn-sm btn-danger">
                                                    <i class="fas fa-power-off mr-1"></i>Revoke
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-5">
                                            <div class="text-muted">No sessions found for the selected filters.</div>
                                        </td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer text-right">
                    {{ $sessions->links() }}
                </div>
            </div>
        </div>
    </section>
@endsection
