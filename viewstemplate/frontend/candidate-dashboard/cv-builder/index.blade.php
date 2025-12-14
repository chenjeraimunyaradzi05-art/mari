@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="breacrumb-cover">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-12">
                    <h2 class="mb-20">AI-Powered CV Builder</h2>
                    <ul class="breadcrumbs">
                        <li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
                        <li><a href="{{ route('member.dashboard') }}">Candidate Dashboard</a></li>
                        <li>CV Builder</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section-box mt-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-12">
                {{-- AI Insights Banner --}}
                <div class="card mb-30" style="border-left: 4px solid #E91E8C;">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h4 class="mb-15" style="color: #E91E8C;">
                                    <i class="fas fa-robot me-2"></i>
                                    Build Your Dream Resume with AI
                                </h4>
                                <p class="text-muted mb-0">
                                    Create professional resumes powered by artificial intelligence. Get real-time suggestions,
                                    ATS optimization, and social-ready formats to land your dream job or apprenticeship.
                                </p>
                            </div>
                            <div class="col-md-4 text-end">
                                <a href="{{ route('member.cv-builder.create') }}" class="btn btn-default px-4 py-2" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border: none;">
                                    <i class="fas fa-plus me-2"></i>Create New CV
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- CV List --}}
                @if($cvs->count() > 0)
                    <div class="row">
                        @foreach($cvs as $cv)
                        <div class="col-lg-4 col-md-6 mb-30">
                            <div class="card h-100 shadow-sm hover-up">
                                <div class="card-body">
                                    {{-- CV Header --}}
                                    <div class="d-flex justify-content-between align-items-start mb-20">
                                        <div>
                                            <h5 class="mb-10">{{ $cv->title }}</h5>
                                            <span class="badge" style="background: #E91E8C;">{{ ucfirst($cv->template) }}</span>
                                        </div>
                                        <div class="dropdown">
                                            <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown">
                                                <i class="fas fa-ellipsis-v"></i>
                                            </button>
                                            <ul class="dropdown-menu">
                                                <li><a class="dropdown-item" href="{{ route('member.cv-builder.edit', $cv->slug) }}">
                                                    <i class="fas fa-edit me-2"></i>Edit
                                                </a></li>
                                                <li><a class="dropdown-item" href="{{ route('member.cv-builder.preview', $cv->slug) }}" target="_blank">
                                                    <i class="fas fa-eye me-2"></i>Preview
                                                </a></li>
                                                <li><a class="dropdown-item" href="{{ route('member.cv-builder.download', $cv->slug) }}">
                                                    <i class="fas fa-download me-2"></i>Download PDF
                                                </a></li>
                                                <li><hr class="dropdown-divider"></li>
                                                <li>
                                                    <form action="{{ route('member.cv-builder.toggle-visibility', $cv->slug) }}" method="POST" class="d-inline">
                                                        @csrf
                                                        <button type="submit" class="dropdown-item">
                                                            <i class="fas fa-{{ $cv->is_public ? 'eye-slash' : 'eye' }} me-2"></i>
                                                            Make {{ $cv->is_public ? 'Private' : 'Public' }}
                                                        </button>
                                                    </form>
                                                </li>
                                                <li>
                                                    <form action="{{ route('member.cv-builder.create-version', $cv->slug) }}" method="POST" class="d-inline">
                                                        @csrf
                                                        <button type="submit" class="dropdown-item">
                                                            <i class="fas fa-copy me-2"></i>Duplicate
                                                        </button>
                                                    </form>
                                                </li>
                                                <li><hr class="dropdown-divider"></li>
                                                <li>
                                                    <form action="{{ route('member.cv-builder.destroy', $cv->slug) }}" method="POST" class="d-inline" onsubmit="return confirm('Are you sure?')">
                                                        @csrf
                                                        @method('DELETE')
                                                        <button type="submit" class="dropdown-item text-danger">
                                                            <i class="fas fa-trash me-2"></i>Delete
                                                        </button>
                                                    </form>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    {{-- ATS Score --}}
                                    <div class="mb-20 p-3" style="background: linear-gradient(135deg, rgba(233, 30, 140, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%); border-radius: 8px;">
                                        <div class="d-flex justify-content-between align-items-center mb-10">
                                            <span class="text-muted small">ATS Score</span>
                                            <span class="fw-bold" style="color: #E91E8C; font-size: 24px;">{{ $cv->ats_score }}%</span>
                                        </div>
                                        <div class="progress" style="height: 8px; background: rgba(233, 30, 140, 0.1);">
                                            <div class="progress-bar" role="progressbar"
                                                 style="width: {{ $cv->ats_score }}%; background: linear-gradient(90deg, #E91E8C 0%, #8B5CF6 100%);"
                                                 aria-valuenow="{{ $cv->ats_score }}" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                    </div>

                                    {{-- Completion Status --}}
                                    <div class="mb-20">
                                        <div class="d-flex justify-content-between align-items-center mb-10">
                                            <span class="text-muted small">Completion</span>
                                            <span class="fw-bold">{{ $cv->completion_percentage }}%</span>
                                        </div>
                                        <div class="progress" style="height: 6px; background: #e5e7eb;">
                                            <div class="progress-bar" role="progressbar"
                                                 style="width: {{ $cv->completion_percentage }}%; background: #E91E8C;"
                                                 aria-valuenow="{{ $cv->completion_percentage }}" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                    </div>

                                    {{-- Stats --}}
                                    <div class="row text-center mb-15">
                                        <div class="col-4">
                                            <div class="cv-stat">
                                                <i class="fas fa-eye mb-5" style="color: #E91E8C;"></i>
                                                <div class="fw-bold">{{ $cv->view_count }}</div>
                                                <small class="text-muted">Views</small>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="cv-stat">
                                                <i class="fas fa-download mb-5" style="color: #8B5CF6;"></i>
                                                <div class="fw-bold">{{ $cv->download_count }}</div>
                                                <small class="text-muted">Downloads</small>
                                            </div>
                                        </div>
                                        <div class="col-4">
                                            <div class="cv-stat">
                                                <i class="fas fa-share-alt mb-5" style="color: #E91E8C;"></i>
                                                <div class="fw-bold">{{ $cv->share_count }}</div>
                                                <small class="text-muted">Shares</small>
                                            </div>
                                        </div>
                                    </div>

                                    {{-- Status Badge --}}
                                    <div class="d-flex gap-2">
                                        @if($cv->is_public)
                                            <span class="badge bg-success flex-fill">
                                                <i class="fas fa-globe me-1"></i>Public
                                            </span>
                                        @else
                                            <span class="badge bg-secondary flex-fill">
                                                <i class="fas fa-lock me-1"></i>Private
                                            </span>
                                        @endif
                                        @if($cv->is_active)
                                            <span class="badge" style="background: #E91E8C; flex: 1;">Active</span>
                                        @endif
                                    </div>

                                    {{-- Action Buttons --}}
                                    <div class="mt-20 d-flex gap-2">
                                        <a href="{{ route('member.cv-builder.edit', $cv->slug) }}"
                                           class="btn btn-sm flex-fill" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; border: none;">
                                            <i class="fas fa-edit me-1"></i>Edit
                                        </a>
                                        <a href="{{ route('member.cv-builder.download', $cv->slug) }}"
                                           class="btn btn-sm btn-outline-primary flex-fill" style="border-color: #E91E8C; color: #E91E8C;">
                                            <i class="fas fa-download me-1"></i>PDF
                                        </a>
                                    </div>

                                    <small class="text-muted d-block mt-15">
                                        Updated {{ $cv->updated_at->diffForHumans() }}
                                    </small>
                                </div>
                            </div>
                        </div>
                        @endforeach
                    </div>
                @else
                    {{-- Empty State --}}
                    <div class="text-center py-5">
                        <div class="mb-30">
                            <i class="fas fa-file-alt" style="font-size: 100px; color: #E91E8C; opacity: 0.3;"></i>
                        </div>
                        <h4 class="mb-15">No CVs Yet</h4>
                        <p class="text-muted mb-30">Create your first AI-powered resume and stand out to employers!</p>
                        <a href="{{ route('member.cv-builder.create') }}" class="btn btn-default px-5 py-3" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border: none;">
                            <i class="fas fa-plus me-2"></i>Create Your First CV
                        </a>
                    </div>
                @endif
            </div>
        </div>
    </div>
</section>
@endsection

@push('scripts')

@endpush

