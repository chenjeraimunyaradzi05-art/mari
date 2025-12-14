@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Interview Coach</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li>Interview Coach</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">

                @include('frontend.candidate-dashboard.sidebar')

                <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                    <div class="content-single">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h3 class="mt-0 mb-0 color-brand-1">AI-Powered Interview Coach</h3>
                            <a href="{{ route('member.interview-coach.create') }}" class="btn btn-primary">
                                <i class="fas fa-play me-2"></i>Start Practice
                            </a>
                        </div>

                        <!-- AI Coach Banner -->
                        <div class="alert mb-4" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); border: none; color: white; border-radius: 15px;">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-user-tie fa-3x me-3"></i>
                                <div>
                                    <h5 class="mb-1" style="color: white;">Your Personal AI Interview Coach</h5>
                                    <p class="mb-0">Practice with AI-generated feedback, build confidence, and master your interview skills!</p>
                                </div>
                            </div>
                        </div>

                        <!-- Statistics Cards -->
                        <div class="row mb-4">
                            <div class="col-lg-3 col-md-6 mb-3">
                                <div class="card text-center" style="border: 2px solid #8B5CF6; border-radius: 15px;">
                                    <div class="card-body">
                                        <div class="rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); display: flex; align-items: center; justify-content: center;">
                                            <i class="fas fa-check-circle fa-2x" style="color: white;"></i>
                                        </div>
                                        <h3 class="mb-1" style="color: #8B5CF6;">{{ $stats['completed_sessions'] }}</h3>
                                        <p class="text-muted mb-0 small">Sessions Completed</p>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-3 col-md-6 mb-3">
                                <div class="card text-center" style="border: 2px solid #E91E8C; border-radius: 15px;">
                                    <div class="card-body">
                                        <div class="rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #E91E8C 0%, #F59E0B 100%); display: flex; align-items: center; justify-content: center;">
                                            <i class="fas fa-question-circle fa-2x" style="color: white;"></i>
                                        </div>
                                        <h3 class="mb-1" style="color: #E91E8C;">{{ $stats['total_questions_answered'] }}</h3>
                                        <p class="text-muted mb-0 small">Questions Answered</p>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-3 col-md-6 mb-3">
                                <div class="card text-center" style="border: 2px solid #F59E0B; border-radius: 15px;">
                                    <div class="card-body">
                                        <div class="rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #F59E0B 0%, #10B981 100%); display: flex; align-items: center; justify-content: center;">
                                            <i class="fas fa-star fa-2x" style="color: white;"></i>
                                        </div>
                                        <h3 class="mb-1" style="color: #F59E0B;">{{ number_format($stats['average_score'], 1) }}%</h3>
                                        <p class="text-muted mb-0 small">Average Score</p>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-3 col-md-6 mb-3">
                                <div class="card text-center" style="border: 2px solid #10B981; border-radius: 15px;">
                                    <div class="card-body">
                                        <div class="rounded-circle mx-auto mb-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #10B981 0%, #3B82F6 100%); display: flex; align-items: center; justify-content: center;">
                                            <i class="fas fa-clock fa-2x" style="color: white;"></i>
                                        </div>
                                        <h3 class="mb-1" style="color: #10B981;">{{ floor($stats['total_practice_time'] / 60) }}m</h3>
                                        <p class="text-muted mb-0 small">Practice Time</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Performance by Difficulty -->
                        @if($stats['completed_sessions'] > 0)
                            <div class="card mb-4" style="border-radius: 15px;">
                                <div class="card-header" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; border-radius: 15px 15px 0 0;">
                                    <h5 class="mb-0"><i class="fas fa-chart-line me-2"></i>Performance by Difficulty Level</h5>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        @foreach(['entry' => 'Entry', 'mid' => 'Mid-Level', 'senior' => 'Senior', 'executive' => 'Executive'] as $key => $label)
                                            @if($stats['performance_by_difficulty'][$key] > 0)
                                                <div class="col-md-6 mb-3">
                                                    <div class="d-flex justify-content-between mb-1">
                                                        <span>{{ $label }}</span>
                                                        <strong>{{ number_format($stats['performance_by_difficulty'][$key], 1) }}%</strong>
                                                    </div>
                                                    <div class="progress" style="height: 10px;">
                                                        <div class="progress-bar" style="width: {{ $stats['performance_by_difficulty'][$key] }}%; background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%);"></div>
                                                    </div>
                                                </div>
                                            @endif
                                        @endforeach
                                    </div>
                                </div>
                            </div>
                        @endif

                        <!-- Recent Sessions -->
                        @if($recentSessions->count() > 0)
                            <div class="card mb-4" style="border-radius: 15px;">
                                <div class="card-header bg-white">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <h5 class="mb-0"><i class="fas fa-history me-2"></i>Recent Practice Sessions</h5>
                                        <a href="{{ route('member.interview-coach.history') }}" class="btn btn-sm btn-outline-primary">
                                            View All
                                        </a>
                                    </div>
                                </div>
                                <div class="card-body">
                                    @foreach($recentSessions as $session)
                                        <div class="d-flex align-items-center mb-3 pb-3 {{ !$loop->last ? 'border-bottom' : '' }}">
                                            <div class="rounded-circle p-3 me-3" style="background: {{ $session->status_color }}20;">
                                                <i class="{{ $session->status_icon }}" style="color: {{ $session->status_color }};"></i>
                                            </div>
                                            <div class="flex-grow-1">
                                                <h6 class="mb-1">{{ $session->title }}</h6>
                                                <small class="text-muted">
                                                    {{ $session->created_at->diffForHumans() }} •
                                                    {{ $session->answered_questions }}/{{ $session->total_questions }} questions
                                                    @if($session->status === 'completed')
                                                        • Score: {{ number_format($session->overall_score, 1) }}%
                                                    @endif
                                                </small>
                                            </div>
                                            @if($session->status === 'completed')
                                                <a href="{{ route('member.interview-coach.feedback', $session->id) }}" class="btn btn-sm btn-outline-primary">
                                                    View Feedback
                                                </a>
                                            @elseif($session->status === 'in_progress')
                                                <a href="{{ route('member.interview-coach.practice', $session->id) }}" class="btn btn-sm btn-primary">
                                                    Continue
                                                </a>
                                            @endif
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @else
                            <!-- Empty State -->
                            <div class="text-center py-5">
                                <div class="mb-4">
                                    <i class="fas fa-user-tie fa-5x" style="color: #E5E7EB;"></i>
                                </div>
                                <h4 class="mb-3">Ready to Start Practicing?</h4>
                                <p class="text-muted mb-4">Build confidence and master your interview skills with AI-powered feedback!</p>
                                <a href="{{ route('member.interview-coach.create') }}" class="btn btn-primary btn-lg">
                                    <i class="fas fa-play me-2"></i>Start Your First Practice Session
                                </a>
                            </div>
                        @endif

                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
