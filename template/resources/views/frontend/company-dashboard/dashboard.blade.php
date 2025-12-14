@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Dashboard</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li>Dashboard</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">

                @include('frontend.company-dashboard.sidebar')

                <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                    <div class="content-single">
                        <h3 class="mt-0 mb-0 color-brand-1">Dashboard</h3>

                        @include('admin.ai-shared.styles')

                        @php
                            $primaryAiMetric = $aiHealthMetrics[0] ?? null;
                            $metricPalettes = ['ai-theme-pink', 'ai-theme-teal', 'ai-theme-amber'];
                            $metricIcons = [
                                'Successful AI calls (24h)' => 'fa-signal',
                                'Average response time (ms)' => 'fa-stopwatch',
                                'Fallback rate' => 'fa-life-ring',
                            ];
                        @endphp

                        <!-- Onboarding Progress Bar -->
                        <div class="mb-40">
                            <h4 class="mb-3" style="color: #E91E8C;">Onboarding Progress</h4>
                            <div class="progress" style="height: 30px; background: #F5F3FF; border-radius: 15px;">
                                @php
                                    $totalProgress = $progress->sum('value');
                                    $totalTarget = $progress->sum('target') ?: 1;
                                    $percent = round(($totalProgress / $totalTarget) * 100);
                                @endphp
                                <div class="progress-bar" role="progressbar" style="width: {{ $percent }}%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 15px; font-weight: bold; font-size: 18px; color: white;" aria-valuenow="{{ $percent }}" aria-valuemin="0" aria-valuemax="100">
                                    {{ $percent }}% Complete
                                </div>
                            </div>
                        </div>

                        <div class="mb-40">
                            @if ($primaryAiMetric)
                                <div class="ai-hero-card ai-theme-pink mb-4">
                                    <div class="pe-lg-5">
                                        <span class="ai-hero-badge"><i class="fas fa-layer-group"></i> AI Warmup Signals</span>
                                        <h2 class="mt-3 mb-2">Operational Health Overview</h2>
                                        <p class="mb-0" style="max-width: 460px; color: rgba(255,255,255,0.75);">Stay informed on how our AI services are performing without exposing member or company identifiers. Metrics update continuously from anonymised telemetry.</p>
                                        <div class="ai-hero-stat text-white mt-4">
                                            <span>{{ $primaryAiMetric['value'] }}</span>
                                            <small>{{ $primaryAiMetric['label'] }}</small>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <div class="ai-hero-icon text-white"><i class="fas fa-wave-square"></i></div>
                                    </div>
                                    <span class="ai-orbit"></span>
                                </div>
                            @else
                                <div class="ai-hero-card ai-theme-pink mb-4">
                                    <div class="pe-lg-5">
                                        <span class="ai-hero-badge"><i class="fas fa-layer-group"></i> AI Warmup Signals</span>
                                        <h2 class="mt-3 mb-2">Telemetry Warming Up</h2>
                                        <p class="mb-0" style="max-width: 460px; color: rgba(255,255,255,0.75);">We are collecting service health data now. Check back shortly for live AI stability metrics with privacy-safe aggregation.</p>
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <div class="ai-hero-icon text-white"><i class="fas fa-spinner fa-pulse"></i></div>
                                    </div>
                                    <span class="ai-orbit"></span>
                                </div>
                            @endif

                            @if (!empty($aiHealthMetrics))
                                <div class="row g-3 mb-4">
                                    @foreach ($aiHealthMetrics as $index => $metric)
                                        <div class="col-xl-4 col-md-6">
                                            <div class="ai-metric-card {{ $metricPalettes[$index % count($metricPalettes)] }}">
                                                <div class="d-flex justify-content-between align-items-start">
                                                    <div>
                                                        <span class="ai-chip ai-chip-light text-uppercase">{{ $metric['label'] }}</span>
                                                        <h2 class="mt-3 mb-2">{{ $metric['value'] }}</h2>
                                                        <span class="ai-metric-trend" style="color: rgba(255,255,255,0.75);"><i class="fas fa-chart-line"></i> {{ $metric['trend'] ?? 'Trend unavailable' }}</span>
                                                    </div>
                                                    <div class="ai-metric-icon text-white">
                                                        <i class="fas {{ $metricIcons[$metric['label']] ?? 'fa-chart-bar' }}"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            @endif

                            <div class="row g-3">
                                <div class="col-lg-8">
                                    <div class="card ai-card-soft h-100">
                                        <div class="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
                                            <h4 class="mb-0"><i class="fas fa-project-diagram text-primary me-2"></i>Pipeline Highlights</h4>
                                            <span class="ai-chip"><i class="fas fa-shield-alt"></i> Privacy Safe</span>
                                        </div>
                                        <div class="card-body pt-3">
                                            <div class="table-responsive">
                                                <table class="table table-hover ai-table mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Pipeline</th>
                                                            <th class="text-center">Runs</th>
                                                            <th class="text-center">Failure Rate</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        @forelse ($aiActionSummaries as $summary)
                                                            <tr>
                                                                <td class="align-middle">
                                                                    <div class="d-flex align-items-center">
                                                                        <span class="ai-list-icon"><i class="fas fa-bolt"></i></span>
                                                                        <span>{{ $summary['action'] }}</span>
                                                                    </div>
                                                                </td>
                                                                <td class="align-middle text-center">{{ number_format($summary['total']) }}</td>
                                                                <td class="align-middle text-center">
                                                                    <span class="ai-status-badge" style="background: rgba(148, 163, 184, 0.15); color: #1e293b;">
                                                                        <i class="fas fa-wave-square"></i> {{ $summary['failure_rate'] }}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        @empty
                                                            <tr>
                                                                <td colspan="3" class="text-center text-muted">No anonymised pipeline data available for the last 14 days.</td>
                                                            </tr>
                                                        @endforelse
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-lg-4">
                                    <div class="card ai-card-soft h-100">
                                        <div class="card-header bg-transparent border-0 pb-0">
                                            <h4 class="mb-0"><i class="fas fa-chart-pie text-success me-2"></i>Warmup Snapshot</h4>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <span class="ai-chip"><i class="fas fa-clock"></i> {{ $aiQueueSnapshot['window'] ?? 'Last 24 hours' }}</span>
                                            </div>
                                            <div class="mb-4">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <span class="text-muted">Total Runs</span>
                                                    <strong>{{ number_format($aiQueueSnapshot['total'] ?? 0) }}</strong>
                                                </div>
                                                <div class="progress" style="height: 10px; background: rgba(148, 163, 184, 0.2);">
                                                    @php
                                                        $totalRuns = max($aiQueueSnapshot['total'] ?? 0, 1);
                                                        $successWidth = min(100, round((($aiQueueSnapshot['successful'] ?? 0) / $totalRuns) * 100));
                                                        $failedWidth = min(100, round((($aiQueueSnapshot['failed'] ?? 0) / $totalRuns) * 100));
                                                        $pendingWidth = max(0, 100 - $successWidth - $failedWidth);
                                                    @endphp
                                                    <div class="progress-bar" role="progressbar" style="width: {{ $successWidth }}%; background: linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%);"></div>
                                                    <div class="progress-bar" role="progressbar" style="width: {{ $pendingWidth }}%; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);"></div>
                                                    <div class="progress-bar" role="progressbar" style="width: {{ $failedWidth }}%; background: linear-gradient(135deg, #f43f5e 0%, #fb7185 100%);"></div>
                                                </div>
                                            </div>
                                            <ul class="list-unstyled mb-0">
                                                <li class="d-flex justify-content-between align-items-center mb-2">
                                                    <span class="text-muted">Successful</span>
                                                    <span style="font-weight: 600;">{{ number_format($aiQueueSnapshot['successful'] ?? 0) }}</span>
                                                </li>
                                                <li class="d-flex justify-content-between align-items-center mb-2">
                                                    <span class="text-muted">Pending</span>
                                                    <span style="font-weight: 600;">{{ number_format($aiQueueSnapshot['pending'] ?? 0) }}</span>
                                                </li>
                                                <li class="d-flex justify-content-between align-items-center">
                                                    <span class="text-muted">Failure Rate</span>
                                                    <span style="font-weight: 600;">{{ number_format($aiQueueSnapshot['failure_rate'] ?? 0, 1) }}%</span>
                                                </li>
                                            </ul>
                                            <p class="mt-3 mb-0 text-muted" style="font-size: 12px;">Figures are aggregated and anonymised to protect sensitive member and employer signals.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Badge Achievements -->
                        <div class="mb-40">
                            <h4 class="mb-3" style="color: #8B5CF6;">Your Achievements</h4>
                            <div class="row">
                                @forelse($badges as $badge)
                                    <div class="col-md-3 col-6 mb-3">
                                        <div class="card text-center shadow-sm" style="border-radius: 15px;">
                                            <div class="card-body p-3">
                                                <span class="d-block mb-2" style="font-size: 32px; color: #E91E8C;"><i class="{{ $badge->icon }}"></i></span>
                                                <h6 class="mb-1" style="color: #05264E; font-weight: bold;">{{ $badge->name }}</h6>
                                                <small class="text-muted">{{ $badge->description }}</small>
                                            </div>
                                        </div>
                                    </div>
                                @empty
                                    <div class="col-12">
                                        <p class="text-muted">No achievements yet. Start completing onboarding steps!</p>
                                    </div>
                                @endforelse
                            </div>
                        </div>

                        <div class="dashboard_overview">
                            <div class="row">
                                <div class="col-lg-4 col-md-6">
                                    <div class="dash_overview_item" style="background: linear-gradient(135deg, #FFF5F8 0%, #FFE5EE 100%); border-left: 4px solid #E91E8C;">
                                        <h2 style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">{{ $jobPosts }} <span style="color: #666;">Pending Jobs</span></h2>
                                        <span class="icon" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"><i class="fas fa-clock" style="color: white;"></i></span>
                                    </div>
                                </div>
                                <div class="col-lg-4 col-md-6">
                                    <div class="dash_overview_item" style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-left: 4px solid #8B5CF6;">
                                        <h2 style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">{{ $totalJobs }} <span style="color: #666;">Total Jobs</span></h2>
                                        <span class="icon" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%);"><i class="fas fa-briefcase" style="color: white;"></i></span>
                                    </div>
                                </div>
                                <div class="col-lg-4 col-md-6">
                                    <div class="dash_overview_item" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border-left: 4px solid #E91E8C;">
                                        <h2 style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">{{ $totalOrders }} <span style="color: #666;">Total Orders</span></h2>
                                        <span class="icon" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);"><i class="fas fa-shopping-bag" style="color: white;"></i></span>
                                    </div>
                                </div>
                            </div>
                            @if (!isCompanyProfileComplete())
                                <div class="row">
                                    <div class="col-12 mt-30">
                                        <div class="dash_alert_box p-30 rounded-4 d-flex flex-wrap align-items-center" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%); border: 2px solid #E91E8C;">
                                            <span class="img me-3">
                                                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                                    <i class="fas fa-exclamation-triangle fa-2x" style="color: white;"></i>
                                                </div>
                                            </span>
                                            <div class="text flex-grow-1">
                                                <h4 style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px;">WARNING: You have to complete your company profile first!</h4>
                                                <p style="color: #666; margin-bottom: 0;">Please complete your company profile to use all the features.</p>
                                            </div>
                                            <a href="{{ route('company.profile') }}" class="btn rounded-1 ms-3" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; border: none; padding: 10px 25px;">Edit Profile</a>
                                        </div>
                                    </div>
                                </div>
                            @endif
                            <br>

                            <!-- AI-Powered Company Tools -->
                            <div class="row mt-30">
                                <div class="col-12">
                                    <h3 class="mb-30 color-brand-1">
                                        <i class="fas fa-robot" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                                        AI-Powered Recruitment Tools
                                    </h3>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <a href="{{ route('company.jobs.create') }}" class="ai-action-card" style="text-decoration: none;">
                                        <div class="card border-0 shadow-sm h-100" style="transition: all 0.3s;">
                                            <div class="card-body text-center p-4">
                                                <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                    <i class="fas fa-magic fa-2x" style="color: white;"></i>
                                                </div>
                                                <h5 class="card-title" style="color: #05264E;">AI Job Description</h5>
                                                <p class="card-text text-muted" style="font-size: 14px;">Generate professional job descriptions with AI-powered templates and SEO optimization</p>
                                                <span class="badge" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; font-size: 12px;">Create Job</span>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <a href="{{ route('company.jobs.index') }}" class="ai-action-card" style="text-decoration: none;">
                                        <div class="card border-0 shadow-sm h-100" style="transition: all 0.3s;">
                                            <div class="card-body text-center p-4">
                                                <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                    <i class="fas fa-brain fa-2x" style="color: white;"></i>
                                                </div>
                                                <h5 class="card-title" style="color: #05264E;">Smart Member Matching</h5>
                                                <p class="card-text text-muted" style="font-size: 14px;">AI ranks members by skills, experience, and cultural fit with match scores</p>
                                                <span class="badge" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; font-size: 12px;">View Jobs</span>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <a href="{{ route('company.jobs.index') }}" class="ai-action-card" style="text-decoration: none;">
                                        <div class="card border-0 shadow-sm h-100" style="transition: all 0.3s;">
                                            <div class="card-body text-center p-4">
                                                <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                    <i class="fas fa-chart-line fa-2x" style="color: white;"></i>
                                                </div>
                                                <h5 class="card-title" style="color: #05264E;">Job Performance Analytics</h5>
                                                <p class="card-text text-muted" style="font-size: 14px;">AI insights on job visibility, application rates, and optimization tips</p>
                                                <span class="badge" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; font-size: 12px;">View Analytics</span>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <div class="card border-0 shadow-sm h-100" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%);">
                                        <div class="card-body text-center p-4">
                                            <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                <i class="fas fa-dollar-sign fa-2x" style="color: white;"></i>
                                            </div>
                                            <h5 class="card-title" style="color: #05264E;">AI Salary Insights</h5>
                                            @if(($salaryInsights['has_data'] ?? false))
                                                <p class="card-text text-muted" style="font-size: 14px;">Average offer band: <strong>${{ number_format($salaryInsights['average_min']) }}</strong> - <strong>${{ number_format($salaryInsights['average_max']) }}</strong></p>
                                                <p class="card-text text-muted" style="font-size: 13px;">Roles with published ranges: {{ $salaryInsights['roles_with_range'] }}</p>
                                                @if(!empty($salaryInsights['recent_role']))
                                                    <p class="card-text text-muted" style="font-size: 12px;">Latest update: {{ $salaryInsights['recent_role']->title }}</p>
                                                @endif
                                                <a href="{{ route('company.jobs.index') }}" class="btn btn-sm" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">Review Ranges</a>
                                            @else
                                                <p class="card-text text-muted" style="font-size: 14px;">Add salary ranges to your openings to unlock AI benchmarking insights.</p>
                                                <a href="{{ route('company.jobs.create') }}" class="btn btn-sm btn-outline-primary">Add Salary Data</a>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <div class="card border-0 shadow-sm h-100" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%);">
                                        <div class="card-body text-center p-4">
                                            <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                <i class="fas fa-comments fa-2x" style="color: white;"></i>
                                            </div>
                                            <h5 class="card-title" style="color: #05264E;">Interview Questions AI</h5>
                                            @if(($interviewToolkit['has_data'] ?? false))
                                                <p class="card-text text-muted" style="font-size: 14px;">Question bank size: <strong>{{ $interviewToolkit['total_questions'] }}</strong></p>
                                                @if(!empty($interviewToolkit['popular_types']))
                                                    <p class="card-text text-muted" style="font-size: 12px;">Top formats:
                                                        {{ collect($interviewToolkit['popular_types'])->pluck('type')->map(fn($type) => ucfirst(str_replace('_', ' ', $type)))->join(', ') }}
                                                    </p>
                                                @endif
                                                @if(!empty($interviewToolkit['average_time_limit']))
                                                    <p class="card-text text-muted" style="font-size: 12px;">Average time per prompt: {{ $interviewToolkit['average_time_limit'] }} min</p>
                                                @endif
                                                <a href="{{ route('company.jobs.create') }}" class="btn btn-sm" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white;">Generate Script</a>
                                            @else
                                                <p class="card-text text-muted" style="font-size: 14px;">Our AI question bank is warming up. Add roles to train personalised prompts.</p>
                                                <a href="{{ route('company.jobs.create') }}" class="btn btn-sm btn-outline-primary">Create Job Brief</a>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                                <div class="col-lg-4 col-md-6 mb-30">
                                    <div class="card border-0 shadow-sm h-100" style="background: linear-gradient(135deg, #FFF5F8 0%, #F5F3FF 100%);">
                                        <div class="card-body text-center p-4">
                                            <div class="ai-action-icon mb-3" style="width: 60px; height: 60px; margin: 0 auto; background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                                <i class="fas fa-search fa-2x" style="color: white;"></i>
                                            </div>
                                            <h5 class="card-title" style="color: #05264E;">Talent Pool Search</h5>
                                            @if(($talentPoolSummary['has_data'] ?? false))
                                                <p class="card-text text-muted" style="font-size: 14px;">Active members: <strong>{{ $talentPoolSummary['total_candidates'] }}</strong></p>
                                                <p class="card-text text-muted" style="font-size: 12px;">New this month: {{ $talentPoolSummary['recent_candidates'] }} | Video profiles: {{ $talentPoolSummary['video_profiles'] }}</p>
                                                @if(!empty($talentPoolSummary['top_cities']))
                                                    <p class="card-text text-muted" style="font-size: 12px;">Top cities:
                                                        {{ collect($talentPoolSummary['top_cities'])->map(fn($city) => $city['name'] . ' (' . $city['count'] . ')')->join(', ') }}
                                                    </p>
                                                @endif
                                                <a href="{{ route('members.index') }}" class="btn btn-sm" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white;">Browse Talent</a>
                                            @else
                                                <p class="card-text text-muted" style="font-size: 14px;">Talent insights unlock as soon as members start engaging with your brand.</p>
                                                <a href="{{ route('company.jobs.create') }}" class="btn btn-sm btn-outline-primary">Post a Role</a>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-body">
                                    <table class="table">

                                        <tbody>
                                          <tr>
                                            <th scope="row">1</th>
                                            <td><b>Current Package</b></td>
                                            <td>{{ $userPlan?->plan?->label }} Package</td>
                                          </tr>
                                          <tr>
                                            <th scope="row">2</th>
                                            <td>Job Post Available</td>
                                            <td>{{ $userPlan?->job_limit }}</td>
                                          </tr>
                                          <tr>
                                            <th scope="row">3</th>
                                            <td>Featured Post Available</td>
                                            <td>{{ $userPlan?->featured_job_limit }}</td>
                                          </tr>
                                          <tr>
                                            <th scope="row">4</th>
                                            <td>Highlight Post Available</td>
                                            <td>{{ $userPlan?->highlight_job_limit }}</td>
                                          </tr>
                                        </tbody>
                                      </table>

                                </div>
                            </div>
                        </div>
                        @yield('company_content')
                    </div>
                </div>
            </div>
        </div>
    </section>

    <div class="mt-120"></div>


@endsection

