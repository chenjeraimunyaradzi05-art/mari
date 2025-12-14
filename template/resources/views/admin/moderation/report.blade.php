@extends('admin.layouts.master')

@section('contents')
<div class="container-fluid">
    <div class="page-header d-flex justify-content-between align-items-center">
        <div>
            <h3 class="page-title mb-0">Report #{{ $report->id }}</h3>
            <p class="text-muted mb-0">{{ ucfirst($report->category) }} · {{ ucfirst($report->severity) }}</p>
        </div>
        <button type="button"  href="{{ route('admin.moderation.reports') }}" class="btn btn-outline-secondary">Back to list</button>
    </div>

    <div class="row">
        <div class="col-lg-8">
            <div class="card mb-4">
                <div class="card-header">Report Details</div>
                <div class="card-body">
                    <dl class="row mb-0">
                        <dt class="col-sm-4">Reporter</dt>
                        <dd class="col-sm-8">{{ optional($report->reporter)->display_name ?? 'Anonymous' }}</dd>
                        <dt class="col-sm-4">Status</dt>
                        <dd class="col-sm-8">{{ ucfirst(str_replace('_', ' ', $report->status)) }}</dd>
                        <dt class="col-sm-4">Description</dt>
                        <dd class="col-sm-8">{{ $report->description ?: 'No additional details provided.' }}</dd>
                        <dt class="col-sm-4">Reviewer</dt>
                        <dd class="col-sm-8">{{ optional($report->reviewer)->name ?? 'Unassigned' }}</dd>
                        <dt class="col-sm-4">Reviewed At</dt>
                        <dd class="col-sm-8">{{ optional($report->reviewed_at)->toDayDateTimeString() ?? 'Pending' }}</dd>
                    </dl>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header">Enforcement Actions</div>
                <div class="card-body">
                    @forelse($report->enforcementActions as $action)
                        <div class="mb-3">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <strong>{{ ucfirst(str_replace('_', ' ', $action->action_type)) }}</strong>
                                    <span class="badge bg-light text-dark">{{ ucfirst($action->status) }}</span>
                                </div>
                                <small class="text-muted">{{ $action->created_at->toDayDateTimeString() }}</small>
                            </div>
                            <p class="mb-1 text-muted">Reason: {{ $action->reason ?? 'n/a' }}</p>
                            <p class="mb-0 text-muted">Notes: {{ $action->notes ?? '—' }}</p>
                        </div>
                    @empty
                        <p class="text-muted mb-0">No enforcement actions yet.</p>
                    @endforelse
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="card">
                <div class="card-header">Metadata</div>
                <div class="card-body">
                    <pre class="small bg-light p-3 rounded">{{ json_encode($report->metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                </div>
            </div>

            <div class="card mt-3">
                <div class="card-header">Triage</div>
                <div class="card-body">
                    <p class="small text-muted">Assign this report to yourself for review, or record a decision below.</p>

                    @if(optional($report->reviewer)->id !== auth('admin')->id())
                        <form method="post" action="{{ route('admin.moderation.reports.assign', $report) }}">
                            @csrf
                            <button type="submit" class="btn btn-primary btn-block mb-2">Assign to me</button>
                        </form>
                    @else
                        <div class="alert alert-success small">Assigned to you</div>
                    @endif

                    <hr />

                    <form method="post" action="{{ route('admin.moderation.reports.decide', $report) }}">
                        @csrf

                        <div class="mb-2">
                            <label class="form-label">Decision</label>
                            <select name="decision" class="form-select">
                                <option value="approved">Approve</option>
                                <option value="rejected">Reject</option>
                                <option value="dismissed">Dismiss</option>
                            </select>
                        </div>

                        <div class="mb-2">
                            <label class="form-label">Reason (optional)</label>
                            <input name="reason" class="form-control" />
                        </div>

                        <div class="mb-2">
                            <label class="form-label">Notes (optional)</label>
                            <textarea name="notes" class="form-control" rows="3"></textarea>
                        </div>

                        <button type="submit" class="btn btn-success">Record decision</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

