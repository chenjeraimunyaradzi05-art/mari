@extends('admin.layouts.app')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0 text-gray-800">Identity Flags</h1>
    </div>

    <div class="card shadow mb-4">
        <div class="card-header py-3">
            <h6 class="m-0 font-weight-bold text-primary">Flagged Users</h6>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-bordered" id="dataTable" width="100%" cellspacing="0">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Score</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Flagged At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($flags as $flag)
                        <tr>
                            <td>
                                {{ $flag->user->name }}<br>
                                <small class="text-muted">{{ $flag->user->email }}</small>
                            </td>
                            <td>{{ $flag->score }}</td>
                            <td>
                                <span class="badge badge-{{ $flag->severity === 'high' ? 'danger' : ($flag->severity === 'medium' ? 'warning' : 'info') }}">
                                    {{ ucfirst($flag->severity) }}
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-{{ $flag->status->value === 'pending' ? 'warning' : ($flag->status->value === 'resolved' ? 'success' : 'secondary') }}">
                                    {{ ucfirst($flag->status->value) }}
                                </span>
                            </td>
                            <td>{{ $flag->flagged_at->format('Y-m-d H:i') }}</td>
                            <td>
                                <button type="button"  href="{{ route('admin.identity-flags.show', $flag) }}" class="btn btn-sm btn-primary">Review</button>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            <div class="mt-4">
                {{ $flags->links() }}
            </div>
        </div>
    </div>
</div>
@endsection

