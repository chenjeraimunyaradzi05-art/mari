@extends('frontend.layouts.master')

@section('title', 'AI Career Insights')

@section('contents')
<div class="container py-5">
    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3 mb-4">
        <div>
            <h1 class="h2 fw-bold mb-1">
                <i class="fas fa-chart-line me-2 text-primary"></i>AI Career Insights
            </h1>
            <p class="text-muted mb-0">Data-driven guidance to grow your career faster with personalized recommendations.</p>
        </div>
        <a href="{{ route('member.job-recommendations') }}" class="btn btn-primary">
            <i class="fas fa-briefcase me-2"></i>See Matching Jobs
        </a>
    </div>

    <div class="row g-4">
        <div class="col-xl-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Profile Snapshot</h5>
                    @php $current = $insights['current_position'] ?? []; @endphp
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item px-0 d-flex justify-content-between">
                            <span class="text-muted">Experience</span>
                            <strong>{{ $insights['snapshot']['experience_years'] ?? 0 }} yrs</strong>
                        </li>
                        <li class="list-group-item px-0 d-flex justify-content-between">
                            <span class="text-muted">Profession</span>
                            <strong>{{ $insights['snapshot']['primary_profession'] ?? 'Not set' }}</strong>
                        </li>
                        <li class="list-group-item px-0 d-flex justify-content-between">
                            <span class="text-muted">Current role</span>
                            <strong>{{ $current['current_role'] ?? 'Add recent role' }}</strong>
                        </li>
                        <li class="list-group-item px-0 d-flex justify-content-between">
                            <span class="text-muted">Tenure</span>
                            <strong>{{ $current['tenure'] ?? 'Update dates' }}</strong>
                        </li>
                        <li class="list-group-item px-0 d-flex justify-content-between">
                            <span class="text-muted">Skills logged</span>
                            <strong>{{ $insights['snapshot']['skill_count'] ?? 0 }}</strong>
                        </li>
                        <li class="list-group-item px-0 d-flex justify-content-between align-items-center">
                            <span class="text-muted">Profile score</span>
                            <div class="text-end">
                                <strong class="d-block">{{ $insights['snapshot']['profile_score'] ?? 0 }}%</strong>
                                <small class="text-muted">{{ $insights['snapshot']['latest_activity'] ?? 'Recently updated' }}</small>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="col-xl-5">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Growth Opportunities</h5>
                    @forelse($insights['growth_opportunities'] ?? [] as $opportunity)
                        <div class="mb-4">
                            <div class="d-flex align-items-center justify-content-between">
                                <strong>{{ $opportunity['title'] }}</strong>
                                <span class="badge bg-primary bg-gradient text-capitalize">{{ $opportunity['confidence'] ?? 'medium' }}</span>
                            </div>
                            <p class="text-muted mb-0">{{ $opportunity['description'] }}</p>
                        </div>
                    @empty
                        <p class="text-muted">Add more experience and skills to unlock personalized growth guidance.</p>
                    @endforelse
                </div>
            </div>
        </div>
        <div class="col-xl-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Market Signals</h5>
                    <div class="mb-3">
                        <div class="text-muted">Active roles</div>
                        <div class="fs-4 fw-bold">{{ $insights['market_trends']['active_roles'] ?? 0 }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted">Featured openings</div>
                        <div class="fs-5 fw-semibold">{{ $insights['market_trends']['featured_roles'] ?? 0 }}</div>
                    </div>
                    <div class="mb-3">
                        <span class="badge bg-info text-dark text-capitalize">{{ $insights['market_trends']['trend_direction'] ?? 'steady' }}</span>
                    </div>
                    <p class="text-muted mb-0">{{ $insights['industry_trends']['summary'] ?? $insights['market_trends']['insight'] ?? 'Keep your profile updated to capture new opportunities.' }}</p>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm mt-4">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h5 class="mb-1">Skill Recommendations</h5>
                    <p class="text-muted mb-0">Add these skills to stay ahead in roles similar to yours.</p>
                </div>
                <a href="{{ route('member.profile.index') }}#pills-profile-tab" class="btn btn-outline-primary btn-sm">
                    <i class="fas fa-plus me-1"></i>Update Skills
                </a>
            </div>
            @if(!empty($insights['skill_analysis']['summary']))
                <p class="text-muted small mb-4">{{ $insights['skill_analysis']['summary'] }}</p>
            @endif
            <div class="row g-3">
                @forelse($insights['skill_recommendations'] ?? [] as $recommendation)
                    <div class="col-md-4">
                        <div class="border rounded-3 p-3 h-100">
                            <div class="fw-semibold mb-2">{{ $recommendation['skill'] }}</div>
                            <p class="text-muted small mb-2">{{ $recommendation['reason'] }}</p>
                            @if(!empty($recommendation['tags']))
                                @foreach($recommendation['tags'] as $tag)
                                    <span class="badge bg-light text-secondary border me-1">{{ $tag }}</span>
                                @endforeach
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="col-12">
                        <div class="border rounded-3 p-4 text-center text-muted">
                            No new skill recommendations available right now. Check back after updating your profile.
                        </div>
                    </div>
                @endforelse
            </div>
        </div>
    </div>

    <div class="row g-4 mt-4">
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Salary Insights</h5>
                    <p class="text-muted mb-2">{{ $insights['salary_insights']['summary'] ?? 'Add salary expectations to unlock tailored benchmarks.' }}</p>
                    @if(!empty($insights['salary_insights']['range']))
                        <div class="fw-semibold">{{ '$' . number_format($insights['salary_insights']['range'][0]) }} - {{ '$' . number_format($insights['salary_insights']['range'][1]) }}</div>
                        <small class="text-muted">Estimated range based on active roles</small>
                    @endif
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Next Opportunities</h5>
                    <p class="text-muted mb-2">{{ $insights['next_opportunities']['summary'] ?? 'Stay active to see fresh opportunities here.' }}</p>
                    @if(!empty($insights['next_opportunities']['count_last_30_days']))
                        <span class="badge bg-light text-secondary border">{{ $insights['next_opportunities']['count_last_30_days'] }} roles in 30 days</span>
                    @endif
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                    <h5 class="mb-3">Strengths & Gaps</h5>
                    <p class="text-muted mb-2">{{ $insights['strength_weakness']['summary'] ?? 'Log more skills to surface your standout strengths.' }}</p>
                    @if(!empty($insights['strength_weakness']['strengths']))
                        <div class="mb-2">
                            <strong class="d-block small text-uppercase text-muted">Strengths</strong>
                            <div class="d-flex flex-wrap gap-2 mt-1">
                                @foreach($insights['strength_weakness']['strengths'] as $skill)
                                    <span class="badge bg-success-subtle text-success border border-success-subtle">{{ $skill }}</span>
                                @endforeach
                            </div>
                        </div>
                    @endif
                    @if(!empty($insights['strength_weakness']['gaps']))
                        <div>
                            <strong class="d-block small text-uppercase text-muted">Focus next</strong>
                            <div class="d-flex flex-wrap gap-2 mt-1">
                                @foreach($insights['strength_weakness']['gaps'] as $skill)
                                    <span class="badge bg-warning-subtle text-warning border border-warning-subtle">{{ $skill }}</span>
                                @endforeach
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <div class="alert alert-info border-0 shadow-sm mt-4" role="alert">
        <div class="d-flex align-items-start">
            <i class="fas fa-graduation-cap me-2 mt-1"></i>
            <div>
                <strong>Learning roadmap:</strong>
                <span>{{ $insights['learning_recommendations']['summary'] ?? 'Refresh your skills regularly to keep matched opportunities flowing.' }}</span>
            </div>
        </div>
    </div>
</div>
@endsection
