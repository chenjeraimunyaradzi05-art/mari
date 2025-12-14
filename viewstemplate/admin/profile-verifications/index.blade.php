@extends('admin.layouts.master')

@section('contents')
<section class="section">
    <div class="section-header">
        <h1>Persona Verification Queue</h1>
    </div>

    <div class="section-body">
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>Verification Requests</h4>
                        <div class="card-header-form">
                            <form action="{{ route('admin.profile-verifications.index') }}" method="GET" class="form-inline">
                                <div class="form-group mr-2 mb-2">
                                    <label for="status" class="sr-only">Status</label>
                                    <select name="status" id="status" class="form-control">
                                        <option value="">All Statuses</option>
                                        @foreach ($statuses as $statusOption)
                                            <option value="{{ $statusOption->value }}" @selected(($filters['status'] ?? null) === $statusOption->value)>
                                                {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $statusOption->value)) }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="input-group mb-2">
                                    <input type="text" class="form-control" placeholder="Search persona or user" name="q"
                                        value="{{ $filters['q'] ?? '' }}">
                                    <div class="input-group-append">
                                        <button class="btn btn-primary" type="submit">
                                            <i class="fas fa-search"></i>
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
                                        <th>ID</th>
                                        <th>Persona</th>
                                        <th>Status</th>
                                        <th>Risk</th>
                                        <th>Submitted</th>
                                        <th>Reviewer</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($verifications as $verification)
                                        <tr>
                                            <td>#{{ $verification->id }}</td>
                                            <td>
                                                <strong>{{ $verification->profile?->display_name ?? 'Unknown' }}</strong><br>
                                                <small>{{ $verification->profile?->user?->email ?? '—' }}</small>
                                            </td>
                                            <td>
                                                <span class="badge badge-info">
                                                    {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $verification->status->value ?? (string) $verification->status)) }}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge badge-{{ ($verification->risk_score ?? 0) >= 0.7 ? 'danger' : 'success' }}">
                                                    {{ number_format((float) $verification->risk_score, 2) }}
                                                </span>
                                            </td>
                                            <td>{{ optional($verification->submitted_at)->format('M d, Y H:i') ?? '—' }}</td>
                                            <td>{{ $verification->assignedReviewer?->name ?? 'Unassigned' }}</td>
                                            <td class="text-right">
                                                <a class="btn btn-sm btn-outline-primary"
                                                    href="{{ route('admin.profile-verifications.show', $verification) }}">
                                                    Review
                                                </a>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="7" class="text-center py-4">No verification requests found.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        {{ $verifications->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
