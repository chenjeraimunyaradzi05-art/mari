@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Invites &middot; {{ $page->name }}</h1>
            <div class="section-header-button">
                <a href="{{ route('admin.organization-pages.edit', $page->id) }}" class="btn btn-secondary">
                    <i class="fas fa-arrow-left"></i> Back to page
                </a>
                <a href="{{ route('admin.organization-pages.invites.export', $page->id) }}" class="btn btn-outline-primary">
                    <i class="fas fa-file-download"></i> Export CSV
                </a>
            </div>
        </div>

        <div class="section-body">
            @php
                $total = $stats->sum();
                $statusCounts = [
                    'sent' => $stats->get('sent', 0),
                    'queued' => $stats->get('queued', 0),
                    'pending' => $stats->get('pending', 0),
                    'failed' => $stats->get('failed', 0),
                ];
            @endphp

            <div class="row mb-4">
                <div class="col-md-3 col-sm-6">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-primary"><i class="fas fa-users"></i></div>
                        <div class="card-wrap">
                            <div class="card-header"><h4>Total Invites</h4></div>
                            <div class="card-body">{{ $total }}</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-success"><i class="fas fa-paper-plane"></i></div>
                        <div class="card-wrap">
                            <div class="card-header"><h4>Sent</h4></div>
                            <div class="card-body">{{ $statusCounts['sent'] }}</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-info"><i class="fas fa-clock"></i></div>
                        <div class="card-wrap">
                            <div class="card-header"><h4>Queued</h4></div>
                            <div class="card-body">{{ $statusCounts['queued'] + $statusCounts['pending'] }}</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-sm-6">
                    <div class="card card-statistic-1">
                        <div class="card-icon bg-danger"><i class="fas fa-exclamation-triangle"></i></div>
                        <div class="card-wrap">
                            <div class="card-header"><h4>Failed</h4></div>
                            <div class="card-body">{{ $statusCounts['failed'] }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h4>Invite Log</h4>
                    <div class="card-header-form">
                        <form method="GET" action="{{ route('admin.organization-pages.invites', $page->id) }}">
                            <div class="row">
                                <div class="col-md-4 mb-2 mb-md-0">
                                    <input type="text" class="form-control" name="search" placeholder="Search email" value="{{ $filters['search'] ?? '' }}">
                                </div>
                                <div class="col-md-3 mb-2 mb-md-0">
                                    <select name="status" class="form-control">
                                        <option value="">All statuses</option>
                                        @foreach (['sent','queued','pending','failed'] as $status)
                                            <option value="{{ $status }}" @selected(($filters['status'] ?? '') === $status)>{{ ucfirst($status) }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-3 mb-2 mb-md-0">
                                    <select name="channel" class="form-control">
                                        <option value="">All channels</option>
                                        @foreach (['email','sms','slack'] as $channel)
                                            <option value="{{ $channel }}" @selected(($filters['channel'] ?? '') === $channel)>{{ strtoupper($channel) }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <button type="submit" class="btn btn-primary btn-block">
                                        <i class="fas fa-filter"></i> Filter
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Channel</th>
                                    <th>Status</th>
                                    <th>Invited By</th>
                                    <th>Sent At</th>
                                    <th>Notes</th>
                                    <th style="width: 120px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($invites as $invite)
                                    <tr>
                                        <td>{{ $invite->email }}</td>
                                        <td>{{ strtoupper($invite->channel) }}</td>
                                        <td>
                                            <span class="badge badge-{{ $invite->status === 'sent' ? 'success' : ($invite->status === 'failed' ? 'danger' : 'secondary') }}">
                                                {{ ucfirst($invite->status) }}
                                            </span>
                                        </td>
                                        <td>{{ $invite->inviter?->name ?? $invite->inviter?->email ?? '—' }}</td>
                                        <td>{{ optional($invite->sent_at)->toDayDateTimeString() ?? '—' }}</td>
                                        <td>
                                            @php
                                                $channelNotes = data_get($invite->meta, 'channel_status.'.$invite->channel.'.notes');
                                                $error = data_get($invite->meta, 'error');
                                            @endphp
                                            {{ $channelNotes ?? $error ?? '—' }}
                                        </td>
                                        <td>
                                            @if (in_array($invite->status, ['failed','pending','queued']))
                                                <form action="{{ route('admin.organization-pages.invites.retry', [$page->id, $invite->id]) }}" method="POST" class="d-inline">
                                                    @csrf
                                                    <button type="submit" class="btn btn-sm btn-warning">
                                                        <i class="fas fa-redo"></i> Retry
                                                    </button>
                                                </form>
                                            @else
                                                <span class="text-muted">—</span>
                                            @endif
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4">No invite logs found.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer text-right">
                    <nav class="d-inline-block">
                        {{ $invites->withQueryString()->links() }}
                    </nav>
                </div>
            </div>
        </div>
    </section>
@endsection
