@extends('admin.layouts.master')

@php
    use Illuminate\Support\Facades\Storage;
    use Illuminate\Support\Str;
@endphp

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Review Verification #{{ $verification->id }}</h1>
            <div class="section-header-breadcrumb">
                <a href="{{ route('admin.social-verifications.index') }}" class="btn btn-outline-secondary btn-sm">
                    <i class="fas fa-arrow-left"></i> Back to list
                </a>
            </div>
        </div>

        <div class="section-body">
            <div class="row">
                <div class="col-lg-7">
                    <div class="card">
                        <div class="card-header">
                            <h4>Submission Details</h4>
                        </div>
                        <div class="card-body">
                            <dl class="row mb-0">
                                <dt class="col-sm-4">Profile</dt>
                                <dd class="col-sm-8">
                                    <strong>{{ $verification->profile?->display_name ?? 'Unknown' }}</strong>
                                    <div class="text-muted">@ {{ $verification->profile?->username }}</div>
                                </dd>

                                <dt class="col-sm-4">Submitted by</dt>
                                <dd class="col-sm-8">{{ $verification->user?->name ?? 'Unknown' }} ({{ $verification->user?->email ?? '—' }})</dd>

                                <dt class="col-sm-4">Method</dt>
                                <dd class="col-sm-8">{{ Str::headline($verification->request_type) }}</dd>

                                <dt class="col-sm-4">Status</dt>
                                <dd class="col-sm-8">
                                    <span class="badge badge-info">
                                        {{ Str::title(str_replace('_', ' ', $verification->status->value)) }}
                                    </span>
                                </dd>

                                <dt class="col-sm-4">Submitted at</dt>
                                <dd class="col-sm-8">{{ optional($verification->submitted_at)->format('M d, Y H:i') ?? '—' }}</dd>

                                <dt class="col-sm-4">Applicant Notes</dt>
                                <dd class="col-sm-8">{{ $verification->notes ?? '—' }}</dd>

                                <dt class="col-sm-4">Evidence Links</dt>
                                <dd class="col-sm-8">
                                    @if(!empty($verification->evidence_urls))
                                        <ul class="mb-0">
                                            @foreach($verification->evidence_urls as $url)
                                                <li><a href="{{ $url }}" target="_blank" rel="noopener">{{ $url }}</a></li>
                                            @endforeach
                                        </ul>
                                    @else
                                        —
                                    @endif
                                </dd>

                                <dt class="col-sm-4">Attachments</dt>
                                <dd class="col-sm-8">
                                    @if(!empty($verification->attachments))
                                        <ul class="mb-0">
                                            @foreach($verification->attachments as $attachment)
                                                @php
                                                    $attachmentPath = is_array($attachment) ? ($attachment['path'] ?? null) : $attachment;
                                                    $attachmentDisk = is_array($attachment) ? ($attachment['disk'] ?? config('filesystems.default')) : config('filesystems.default');
                                                    $attachmentUrl = $attachmentPath ? Storage::disk($attachmentDisk)->url($attachmentPath) : null;
                                                @endphp
                                                @if($attachmentPath && $attachmentUrl)
                                                    <li>
                                                        <a href="{{ $attachmentUrl }}" target="_blank" rel="noopener">
                                                            {{ basename($attachmentPath) }}
                                                        </a>
                                                    </li>
                                                @endif
                                            @endforeach
                                        </ul>
                                    @else
                                        —
                                    @endif
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div class="col-lg-5">
                    <div class="card">
                        <div class="card-header">
                            <h4>Decision</h4>
                        </div>
                        <div class="card-body">
                            <form action="{{ route('admin.social-verifications.update', $verification) }}" method="POST">
                                @csrf
                                @method('PUT')

                                <div class="form-group">
                                    <label class="form-label">Reviewer Notes</label>
                                    <textarea name="review_notes" class="form-control" rows="4">{{ old('review_notes', $verification->review_notes) }}</textarea>
                                    <small class="form-text text-muted">Provide context for the applicant.</small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Action</label>
                                    <div class="d-flex flex-wrap gap-2">
                                        <button name="action" value="approve" class="btn btn-success"
                                                @disabled($verification->status === \App\Enums\SocialVerificationStatus::Approved)>
                                            <i class="fas fa-check"></i> Approve
                                        </button>
                                        <button name="action" value="reject" class="btn btn-danger"
                                                @disabled($verification->status === \App\Enums\SocialVerificationStatus::Rejected)>
                                            <i class="fas fa-times"></i> Reject
                                        </button>
                                        <button name="action" value="needs_more_info" class="btn btn-warning text-white">
                                            <i class="fas fa-comment-dots"></i> Needs more info
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                        @if($verification->reviewer)
                            <div class="card-footer">
                                Last reviewed by {{ $verification->reviewer->name }} on
                                {{ optional($verification->reviewed_at)->format('M d, Y H:i') ?? '—' }}
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
