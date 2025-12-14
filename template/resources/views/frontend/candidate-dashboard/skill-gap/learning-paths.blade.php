@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="breacrumb-cover">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-12">
                    <h2 class="mb-20">Learning Paths</h2>
                    <ul class="breadcrumbs">
                        <li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
                        <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                        <li><a href="{{ route('member.skill-gap.index') }}">Skill Gap Analysis</a></li>
                        <li>Learning Paths</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="section-box mt-50">
    <div class="container">
        <div class="row">
            @include('frontend.candidate-dashboard.sidebar')

            <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                <!-- Header -->
                <div class="card mb-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 12px;">
                    <div class="card-body text-white p-4">
                        <h3 class="text-white mb-2">
                            <i class="fas fa-road me-2"></i>Personalized Learning Paths
                        </h3>
                        <p class="mb-0 opacity-90">
                            AI-curated learning paths designed specifically for your career goals. Choose a path that matches your current level and commitment.
                        </p>
                    </div>
                </div>

                <!-- Analysis Summary -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body p-4">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h5 class="mb-2">Analysis from {{ $analysis->analysis_date->format('M d, Y') }}</h5>
                                <p class="text-muted mb-0">
                                    Based on {{ $analysis->skills_analyzed }} market skills, we've identified {{ $analysis->skills_gap }} skills to learn for better market competitiveness.
                                </p>
                            </div>
                            <div class="col-md-4 text-md-end mt-3 mt-md-0">
                                <div class="d-inline-block text-center">
                                    <h2 class="mb-0" style="color: {{ $analysis->competitiveness_color }}; font-weight: bold;">
                                        {{ number_format($analysis->market_competitiveness, 0) }}%
                                    </h2>
                                    <small class="text-muted">Market Competitive</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Learning Paths -->
                @if(!empty($analysis->learning_paths))
                    <div class="row g-4 mb-4">
                        @foreach($analysis->learning_paths as $index => $path)
                            <div class="col-12">
                                <div class="card border-0 shadow-sm h-100">
                                    <div class="card-body p-4">
                                        <!-- Path Header -->
                                        <div class="d-flex justify-content-between align-items-start mb-3">
                                            <div>
                                                <h4 class="mb-2">
                                                    <i class="fas fa-route me-2" style="color: {{ $index === 0 ? '#10B981' : ($index === 1 ? '#F59E0B' : '#8B5CF6') }};"></i>
                                                    {{ $path['name'] }}
                                                </h4>
                                                <p class="text-muted mb-0">{{ $path['description'] }}</p>
                                            </div>
                                            <span class="badge bg-{{ $path['level'] === 'beginner' ? 'success' : ($path['level'] === 'intermediate' ? 'warning' : 'danger') }} fs-6">
                                                {{ ucfirst($path['level']) }}
                                            </span>
                                        </div>

                                        <!-- Path Info -->
                                        <div class="row g-3 mb-4">
                                            <div class="col-md-4">
                                                <div class="d-flex align-items-center">
                                                    <i class="fas fa-clock text-primary me-2" style="font-size: 1.5rem;"></i>
                                                    <div>
                                                        <small class="text-muted d-block">Duration</small>
                                                        <strong>{{ $path['duration'] }}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="d-flex align-items-center">
                                                    <i class="fas fa-layer-group text-info me-2" style="font-size: 1.5rem;"></i>
                                                    <div>
                                                        <small class="text-muted d-block">Skills</small>
                                                        <strong>{{ count($path['skills']) }} skills</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="d-flex align-items-center">
                                                    <i class="fas fa-chart-line text-success me-2" style="font-size: 1.5rem;"></i>
                                                    <div>
                                                        <small class="text-muted d-block">Impact</small>
                                                        <strong>{{ $path['estimated_impact'] }}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Skills to Learn -->
                                        <h6 class="mb-3">Skills You'll Master:</h6>
                                        <div class="row g-3 mb-4">
                                            @foreach($path['skills'] as $skill)
                                                <div class="col-md-6">
                                                    <div class="card border-0" style="background: linear-gradient(135deg, #667eea11 0%, #764ba211 100%);">
                                                        <div class="card-body p-3">
                                                            <div class="d-flex justify-content-between align-items-start mb-2">
                                                                <h6 class="mb-0">{{ $skill['skill_name'] }}</h6>
                                                                <span class="badge bg-{{ $skill['priority'] === 'critical' ? 'danger' : ($skill['priority'] === 'high' ? 'warning' : 'info') }}">
                                                                    {{ ucfirst($skill['priority']) }}
                                                                </span>
                                                            </div>

                                                            <div class="row g-2 mt-2">
                                                                <div class="col-6">
                                                                    <small class="text-muted">
                                                                        <i class="fas fa-briefcase me-1"></i>
                                                                        {{ $skill['job_count'] }} jobs
                                                                    </small>
                                                                </div>
                                                                <div class="col-6">
                                                                    <small class="text-muted">
                                                                        <i class="fas fa-dollar-sign me-1"></i>
                                                                        {{ $skill['avg_salary'] ? '$' . number_format($skill['avg_salary'], 0) : 'N/A' }}
                                                                    </small>
                                                                </div>
                                                                <div class="col-6">
                                                                    <small class="text-success">
                                                                        <i class="fas fa-arrow-up me-1"></i>
                                                                        {{ $skill['growth_rate'] }}% growth
                                                                    </small>
                                                                </div>
                                                                <div class="col-6">
                                                                    <small class="text-primary">
                                                                        <i class="fas fa-chart-bar me-1"></i>
                                                                        {{ $skill['demand_level'] }}
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            <a href="{{ route('member.skill-gap.resources', $skill['skill_id']) }}"
                                                               class="btn btn-sm btn-primary mt-3 w-100">
                                                                <i class="fas fa-book-open me-1"></i>Browse Resources
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            @endforeach
                                        </div>

                                        <!-- Action Button -->
                                        <div class="text-center">
                                            <button class="btn btn-lg" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                                                <i class="fas fa-rocket me-2"></i>Start This Path
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @else
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No learning paths available. This usually means you already have strong market competitiveness!
                    </div>
                @endif

                <!-- Market Insights -->
                @if(!empty($analysis->market_insights))
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <h5 class="mb-4"><i class="fas fa-lightbulb text-warning me-2"></i>Market Insights</h5>

                            <div class="row g-4">
                                <!-- Opportunities -->
                                <div class="col-md-6">
                                    <div class="p-3 rounded" style="background: linear-gradient(135deg, #667eea11 0%, #764ba211 100%);">
                                        <h6 class="mb-3">Job Opportunities</h6>
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="flex-shrink-0">
                                                <div class="rounded-circle d-flex align-items-center justify-content-center"
                                                     style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                    <h4 class="text-white mb-0">{{ $analysis->market_insights['matched_jobs'] ?? 0 }}</h4>
                                                </div>
                                            </div>
                                            <div>
                                                <p class="mb-1">Jobs matching your current skills</p>
                                                <small class="text-muted">Out of {{ $analysis->market_insights['total_opportunities'] ?? 0 }} total opportunities</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Salary Potential -->
                                <div class="col-md-6">
                                    <div class="p-3 rounded" style="background: linear-gradient(135deg, #10B98122 0%, #34D39922 100%);">
                                        <h6 class="mb-3">Earning Potential</h6>
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="flex-shrink-0">
                                                <div class="rounded-circle d-flex align-items-center justify-content-center"
                                                     style="width: 60px; height: 60px; background: linear-gradient(135deg, #10B981 0%, #34D399 100%);">
                                                    <i class="fas fa-dollar-sign text-white fa-2x"></i>
                                                </div>
                                            </div>
                                            <div>
                                                <p class="mb-1">Potential salary increase</p>
                                                <small class="text-muted">
                                                    ${{ number_format($analysis->market_insights['potential_salary_increase'] ?? 0, 0) }} by learning critical skills
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Trending Skills -->
                                @if(!empty($analysis->market_insights['trending_skills']))
                                    <div class="col-12">
                                        <h6 class="mb-3">Trending Skills</h6>
                                        <div class="d-flex flex-wrap gap-2">
                                            @foreach($analysis->market_insights['trending_skills'] as $trendingSkill)
                                                <span class="badge bg-light text-dark border d-flex align-items-center gap-2">
                                                    {{ $trendingSkill['name'] }}
                                                    <span class="badge bg-success">+{{ $trendingSkill['growth_rate'] }}%</span>
                                                </span>
                                            @endforeach
                                        </div>
                                    </div>
                                @endif
                            </div>
                        </div>
                    </div>
                @endif

                <!-- Call to Action -->
                <div class="card border-0 shadow-sm" style="background: linear-gradient(135deg, #f093fb22 0%, #f5576c22 100%);">
                    <div class="card-body p-4 text-center">
                        <h5 class="mb-3">Ready to Start Learning?</h5>
                        <p class="text-muted mb-4">
                            Track your progress, earn certificates, and watch your market competitiveness grow!
                        </p>
                        <div class="d-flex gap-2 justify-content-center flex-wrap">
                            <a href="{{ route('member.skill-gap.index') }}" class="btn btn-outline-primary">
                                <i class="fas fa-arrow-left me-2"></i>Back to Analysis
                            </a>
                            <a href="{{ route('member.skill-gap.progress') }}" class="btn btn-primary">
                                <i class="fas fa-tasks me-2"></i>View Progress
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
