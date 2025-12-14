@extends('admin.layouts.master')

@section('contents')
<section class="section">
    <div class="section-header">
        <div class="section-header-back">
            <button type="button"  href="{{ route('admin.profile-verifications.index') }}" class="btn btn-icon"><i class="fas fa-arrow-left"></i></button>
        </div>
        <h1>Verification #{{ $verification->id }}</h1>
    </div>

    <div class="section-body">
        <div class="row">
            <div class="col-lg-8">
                <div class="card">
                    <div class="card-header">
                        <h4>Submission Details</h4>
                    </div>
                    <div class="card-body">
                        <dl class="row mb-0">
                            <dt class="col-sm-4">Persona</dt>
                            <dd class="col-sm-8">
                                <strong>{{ $verification->profile?->display_name ?? 'Unknown' }}</strong><br>
                                <small>{{ $verification->profile?->handle }}</small>
                            </dd>

                            <dt class="col-sm-4">User</dt>
                            <dd class="col-sm-8">{{ $verification->profile?->user?->email ?? '—' }}</dd>

                            <dt class="col-sm-4">Status</dt>
                            <dd class="col-sm-8">
                                <span class="badge badge-info">
                                    {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $verification->status->value ?? (string) $verification->status)) }}
                                </span>
                            </dd>

                            <dt class="col-sm-4">Risk Score</dt>
                            <dd class="col-sm-8">{{ number_format((float) $verification->risk_score, 2) }}</dd>

                            <dt class="col-sm-4">Submitted At</dt>
                            <dd class="col-sm-8">{{ optional($verification->submitted_at)->toDayDateTimeString() ?? '—' }}</dd>

                            <dt class="col-sm-4">License Expiry</dt>
                            <dd class="col-sm-8">{{ optional($verification->license_expires_at)->toDateString() ?? '—' }}</dd>

                            <dt class="col-sm-4">Evidence URLs</dt>
                            <dd class="col-sm-8">
                                @forelse ($verification->submitted_data['evidence_urls'] ?? [] as $url)
                                    <div><a href="{{ $url }}" target="_blank" rel="noopener">{{ $url }}</a></div>
                                @empty
                                    <span>—</span>
                                @endforelse
                            </dd>

                            <dt class="col-sm-4">Applicant Notes</dt>
                            <dd class="col-sm-8">{{ $verification->submitted_data['notes'] ?? '—' }}</dd>
                        </dl>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h4>Documents</h4>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>File</th>
                                        <th>MIME</th>
                                        <th>Size</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($verification->documents as $document)
                                        <tr>
                                            <td>{{ $document->metadata['original_name'] ?? basename($document->path) }}</td>
                                            <td>{{ $document->mime_type ?? 'n/a' }}</td>
                                            <td>{{ number_format(($document->size_bytes ?? 0) / 1024, 1) }} KB</td>
                                            <td class="text-right">
                                                <button type="button"  href="{{ route('admin.profile-verifications.documents.download', [$verification, $document]) }}"
                                                    class="btn btn-sm btn-outline-secondary">
                                                    Download
                                                </button>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="4" class="text-center">No documents uploaded.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h4>Audit Trail</h4>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled mb-0">
                            @forelse ($verification->audits as $audit)
                                <li class="mb-3">
                                    <strong>{{ \Illuminate\Support\Str::title(str_replace('.', ' ', $audit->action)) }}</strong>
                                    &mdash; {{ optional($audit->created_at)->diffForHumans() }}
                                    <br>
                                    <small>
                                        @if ($audit->actor)
                                            {{ $audit->actor->name }}
                                        @else
                                            System
                                        @endif
                                    </small>
                                    @if ($audit->notes)
                                        <div class="text-muted small mt-1">{{ json_encode($audit->notes) }}</div>
                                    @endif
                                </li>
                            @empty
                                <li>No audit entries yet.</li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </div>

            <div class="col-lg-4">
                <div class="card">
                    <div class="card-header">
                        <h4>Reviewer Actions</h4>
                    </div>
                    <div class="card-body">
                        <p>
                            Current Reviewer:
                            <strong>{{ $verification->assignedReviewer?->name ?? 'Unassigned' }}</strong>
                        </p>
                        <form action="{{ route('admin.profile-verifications.assign', $verification) }}" method="POST" class="mb-4">
                            @csrf
                            <button class="btn btn-outline-primary btn-block" type="submit">
                                Assign to me
                            </button>
                        </form>

                        <form action="{{ route('admin.profile-verifications.decide', $verification) }}" method="POST">
                            @csrf
                            <div class="form-group">
                                <label for="action">Decision</label>
                                <select name="action" id="action" class="form-control" required>
                                    <option value="">Select action</option>
                                    <option value="approved">Approve</option>
                                    <option value="rejected">Reject</option>
                                    <option value="needs_more_info">Needs more info</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="reason">Reason</label>
                                <input type="text" class="form-control" id="reason" name="reason" maxlength="500">
                            </div>
                            <div class="form-group">
                                <label for="notes">Reviewer Notes</label>
                                <textarea class="form-control" id="notes" name="notes" rows="4" maxlength="1000"></textarea>
                            </div>
                            <button class="btn btn-success btn-block" type="submit">Submit Decision</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection

