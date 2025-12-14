@extends('frontend.social.layout')

@php
    use Illuminate\Support\Str;
@endphp

@section('title', 'Verification Center')

@section('social-content')
    <div class="bg-white rounded-3xl shadow-xl p-6 p-md-8">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-5 gap-3">
            <div>
                <p class="text-uppercase text-muted fw-semibold mb-1">Verification status</p>
                <h2 class="fw-bold mb-0">
                    {{ Str::title(str_replace('_', ' ', $profile->verification_status?->value ?? (string) $profile->verification_status ?? 'unverified')) }}
                </h2>
                <small class="text-muted">@if($profile->verification_notes)
                        Last reviewer note: {{ $profile->verification_notes }}
                    @else
                        Submit documents to earn the verified badge for {{ $profile->display_name }}.
                    @endif
                </small>
            </div>
            <div class="text-md-end">
                <span class="badge rounded-pill bg-gradient" style="background: linear-gradient(90deg, #f472b6, #c084fc);">
                    @if($profile->is_verified)
                        <i class="fas fa-shield-alt me-1"></i> Verified profile
                    @else
                        <i class="fas fa-hourglass-half me-1"></i> Awaiting verification
                    @endif
                </span>
                <p class="text-muted small mb-0 mt-2">Submitted {{ optional($profile->verification_submitted_at)->diffForHumans() ?? 'never' }}</p>
            </div>
        </div>

        @if($errors->any())
            <div class="alert alert-danger">
                <strong>We ran into an issue:</strong>
                <ul class="mb-0">
                    @foreach($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        @if(session('success'))
            <div class="alert alert-success d-flex align-items-center">
                <i class="fas fa-check-circle me-2"></i>
                <span>{{ session('success') }}</span>
            </div>
        @endif

        <form action="{{ route('social.profiles.verification.store', $profile->username) }}" method="POST" enctype="multipart/form-data" class="row g-4">
            @csrf
            <div class="col-md-6">
                <label class="form-label fw-semibold">Verification Method</label>
                <select name="request_type" class="form-select" @disabled($profile->verification_status === \App\Enums\SocialVerificationStatus::Pending)>
                    <option value="">Choose one</option>
                    <option value="government_id" @selected(old('request_type') === 'government_id')>Government issued ID</option>
                    <option value="organization_email" @selected(old('request_type') === 'organization_email')>Organization email domain</option>
                    <option value="document_upload" @selected(old('request_type') === 'document_upload')>Supporting documents</option>
                </select>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-semibold">Notes for reviewers</label>
                <textarea name="notes" class="form-control" rows="3" placeholder="Explain why this profile should be verified" @disabled($profile->verification_status === \App\Enums\SocialVerificationStatus::Pending)>{{ old('notes') }}</textarea>
            </div>

            <div class="col-12">
                <label class="form-label fw-semibold">Evidence Links (optional)</label>
                <div class="row g-2">
                    @for($i = 0; $i < 3; $i++)
                        <div class="col-md-4">
                            <input type="url" name="evidence_urls[]" class="form-control" placeholder="https://example.com"
                                   value="{{ old('evidence_urls.'.$i) }}" @disabled($profile->verification_status === \App\Enums\SocialVerificationStatus::Pending)>
                        </div>
                    @endfor
                </div>
                <small class="text-muted">Link to press coverage, corporate directories, or accreditation listings.</small>
            </div>

            <div class="col-12">
                <label class="form-label fw-semibold">Upload Supporting Files</label>
                <input type="file" class="form-control" name="attachments[]" multiple accept="image/*,application/pdf" @disabled($profile->verification_status === \App\Enums\SocialVerificationStatus::Pending)>
                <small class="text-muted">Up to 3 files, 5MB each. Accepted types: JPG, PNG, PDF.</small>
            </div>

            <div class="col-12 d-flex justify-content-end">
                <button type="submit" class="btn btn-gradient px-4 py-2" @disabled($profile->verification_status === \App\Enums\SocialVerificationStatus::Pending)>
                    Submit for review
                </button>
            </div>
        </form>
    </div>

    <div class="mt-5">
        <div class="card border-0 shadow-sm">
            <div class="card-header bg-white border-0">
                <h5 class="mb-0">Past submissions</h5>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table mb-0 align-middle">
                        <thead class="bg-light">
                        <tr>
                            <th>ID</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th>Submitted</th>
                            <th>Reviewer</th>
                            <th>Notes</th>
                        </tr>
                        </thead>
                        <tbody>
                        @forelse($requests as $request)
                            <tr>
                                <td>#{{ $request->id }}</td>
                                <td>{{ Str::headline($request->request_type) }}</td>
                                <td>
                                    <span class="badge bg-secondary">
                                        {{ Str::title(str_replace('_', ' ', $request->status->value)) }}
                                    </span>
                                </td>
                                <td>{{ optional($request->submitted_at)->format('M d, Y H:i') ?? '—' }}</td>
                                <td>{{ $request->reviewer?->name ?? '—' }}</td>
                                <td>{{ $request->review_notes ?? $request->notes ?? '—' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="text-center py-4">No verification attempts yet.</td>
                            </tr>
                        @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
            @if($requests instanceof \Illuminate\Contracts\Pagination\Paginator && $requests->hasPages())
                <div class="card-footer border-0">
                    {{ $requests->links() }}
                </div>
            @endif
        </div>
    </div>
@endsection



