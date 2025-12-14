@extends('frontend.layouts.master')

@php
    use Carbon\Carbon;
    use Illuminate\Support\Str;
@endphp

@section('title', 'AI Job Recommendations')

@section('contents')
<div class="container py-5">
    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center align-items-start gap-3 mb-4">
        <div>
            <h1 class="h2 fw-bold mb-1">
                <i class="fas fa-brain me-2 text-primary"></i>Smart Job Matches
            </h1>
            <p class="text-muted mb-0">Personalized opportunities curated by our AI based on your profile, skills, and goals.</p>
        </div>
        <div class="bg-light border rounded-3 px-4 py-3 d-flex align-items-center gap-3">
            <div class="text-center">
                <div class="fw-bold" style="font-size: 1.5rem;">{{ $metrics['candidate_matches'] ?? 0 }}</div>
                <small class="text-muted">Matches found</small>
            </div>
            <div class="vr"></div>
            <div class="text-center">
                <div class="fw-bold" style="font-size: 1.5rem;">{{ $metrics['active_jobs'] ?? 0 }}</div>
                <small class="text-muted">Active roles</small>
            </div>
        </div>
    </div>

    @if(session('error'))
        <div class="alert alert-warning">{{ session('error') }}</div>
    @endif

    <div class="row g-4">
        <div class="col-lg-8">
            @forelse($recommendations as $match)
                @php
                    /** @var \App\Models\Job $job */
                    $job = $match['job'];
                    $score = $match['score'] ?? 0;
                    $flags = $match['flags'] ?? [];
                    $skillMatches = $match['skill_matches'] ?? [];
                    $reasons = $match['reasons'] ?? [];
                @endphp
                @php $deadline = $job->deadline ? Carbon::parse($job->deadline) : null; @endphp
                <div class="card shadow-sm mb-4 border-0 position-relative">
                    <div class="card-body p-4">
                        <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
                            <div>
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge bg-primary bg-gradient">Match: {{ $score }}%</span>
                                    @if(!empty($flags['is_new']))
                                        <span class="badge bg-success bg-gradient">New</span>
                                    @endif
                                    @if(!empty($flags['is_featured']))
                                        <span class="badge bg-warning bg-gradient text-dark">Featured</span>
                                    @endif
                                    @if(!empty($flags['location_match']))
                                        <span class="badge bg-info bg-gradient text-dark">Location Fit</span>
                                    @endif
                                </div>
                                <h3 class="h4 mb-1">
                                    <a href="{{ route('jobs.show', $job->slug) }}" class="text-decoration-none text-dark">{{ $job->title }}</a>
                                </h3>
                                <p class="mb-2 text-muted">
                                    <i class="fas fa-building me-1"></i>{{ $job->company?->name ?? $job->company_name ?? 'Confidential' }}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-map-marker-alt me-1"></i>{{ $job->city?->name ?? $job->state?->name ?? $job->country?->name ?? 'Remote / Flexible' }}
                                </p>
                                <p class="text-muted mb-0">{{ Str::limit(strip_tags($job->description), 160) }}</p>
                            </div>
                            <div class="text-md-end">
                                <div class="fw-semibold text-primary">Deadline: {{ optional($deadline)->format('M d, Y') ?? 'Open' }}</div>
                                <div class="text-muted small">Posted {{ optional($job->created_at)->diffForHumans() }}</div>
                                <a href="{{ route('jobs.show', $job->slug) }}" class="btn btn-outline-primary btn-sm mt-3">View Details</a>
                            </div>
                        </div>

                        @if($skillMatches)
                            <div class="mt-3">
                                <small class="text-muted d-block mb-1">Skill alignment</small>
                                @foreach($skillMatches as $skill)
                                    <span class="badge rounded-pill text-bg-light border me-1 mb-1">{{ $skill }}</span>
                                @endforeach
                            </div>
                        @endif

                        @if($reasons)
                            <div class="mt-3">
                                <small class="text-muted d-block mb-1">Why we recommended this role</small>
                                <ul class="mb-0 ps-3">
                                    @foreach($reasons as $reason)
                                        <li class="text-muted">{{ $reason }}</li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif
                    </div>
                </div>
            @empty
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center p-5">
                        <i class="fas fa-search fa-3x text-muted mb-3"></i>
                        <h4>No matches yet</h4>
                        <p class="text-muted">Update your profile, add more skills, or broaden your preferences to improve match accuracy.</p>
                        <a href="{{ route('member.profile.index') }}" class="btn btn-primary">Improve Profile</a>
                    </div>
                </div>
            @endforelse
        </div>
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-header bg-transparent border-0 pt-4 pb-0">
                    <h5 class="mb-1">Match Insights</h5>
                    <small class="text-muted">Updated {{ $metrics['generated_at'] ?? now()->toDateTimeString() }}</small>
                </div>
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <span class="text-muted">Profile Strength</span>
                        <span class="fw-bold">{{ $candidate->profile_score ?? 0 }}%</span>
                    </div>
                    <div class="progress mb-3" style="height: 8px;">
                        <div class="progress-bar bg-gradient" role="progressbar" style="width: {{ $candidate->profile_score ?? 0 }}%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"></div>
                    </div>
                    <ul class="list-unstyled mb-0">
                        <li class="mb-2"><i class="fas fa-check text-success me-2"></i>Matches factor in skills, experience, and location</li>
                        <li class="mb-2"><i class="fas fa-check text-success me-2"></i>Featured jobs receive a slight boost</li>
                        <li class="mb-2"><i class="fas fa-check text-success me-2"></i>Scores refresh whenever you update your profile</li>
                    </ul>
                </div>
            </div>

            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <h5 class="mb-3">Next Steps</h5>
                    <div class="d-grid gap-2">
                        <a href="{{ route('member.cv-builder.index') }}" class="btn btn-outline-primary">
                            <i class="fas fa-file-alt me-2"></i>Optimize CV with AI
                        </a>
                        <a href="{{ route('member.career-insights.index') }}" class="btn btn-outline-secondary">
                            <i class="fas fa-chart-line me-2"></i>View Career Insights
                        </a>
                        <a href="{{ route('member.profile.index') }}" class="btn btn-outline-dark">
                            <i class="fas fa-user-edit me-2"></i>Update Profile
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
