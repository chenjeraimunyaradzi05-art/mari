@extends('admin.layouts.master')

@section('contents')
<div class="container-fluid">
    <div class="page-header d-flex justify-content-between align-items-center">
        <div>
            <h3 class="page-title mb-0">Content Reports</h3>
            <p class="text-muted mb-0">Track harassment, spam, and policy violations.</p>
        </div>
        <a href="{{ route('admin.moderation.dashboard') }}" class="btn btn-outline-secondary">Back to dashboard</a>
    </div>

    <div class="card">
        <div class="card-body">
            <form class="row g-3 mb-4" method="get">
                <div class="col-md-3">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select" onchange="this.form.submit()">
                        <option value="">All</option>
                        @foreach(['open','triage','under_review','action_taken','dismissed','escalated'] as $status)
                            <option value="{{ $status }}" @selected(request('status') === $status)>{{ ucfirst(str_replace('_', ' ', $status)) }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Category</label>
                    <select name="category" class="form-select" onchange="this.form.submit()">
                        <option value="">All</option>
                        @foreach(config('moderation.categories') as $category)
                            <option value="{{ $category }}" @selected(request('category') === $category)>{{ ucfirst($category) }}</option>
                        @endforeach
                    </select>
                </div>
            </form>

            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Category</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Reporter</th>
                            <th>Created</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($reports as $report)
                            <tr>
                                <td>#{{ $report->id }}</td>
                                <td>{{ ucfirst($report->category) }}</td>
                                <td><span class="badge bg-light text-dark">{{ ucfirst($report->severity) }}</span></td>
                                <td>{{ ucfirst(str_replace('_', ' ', $report->status)) }}</td>
                                <td>{{ optional($report->reporter)->display_name ?? 'Anonymous' }}</td>
                                <td>{{ $report->created_at->diffForHumans() }}</td>
                                <td class="text-end">
                                    <a href="{{ route('admin.moderation.reports.show', $report) }}" class="btn btn-sm btn-primary">Review</a>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center text-muted">No reports available.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="d-flex justify-content-end">
                {{ $reports->links() }}
            </div>
        </div>
    </div>
</div>
@endsection
