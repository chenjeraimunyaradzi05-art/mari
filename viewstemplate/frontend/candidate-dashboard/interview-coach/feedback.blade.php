@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Session Feedback</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.interview-coach.index') }}">Interview Coach</a></li>
                            <li>Feedback</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">
                <div class="col-lg-12">

                    <!-- Congratulations Banner -->
                    <div class="card mb-4" style="background: linear-gradient(135deg, #10B981 0%, #3B82F6 100%); border: none; border-radius: 15px; color: white;">
                        <div class="card-body p-4">
                            <div class="text-center">
                                <i class="fas fa-trophy fa-4x mb-3" style="color: #FCD34D;"></i>
                                <h2 class="mb-2" style="color: white;">Great Job!</h2>
                                <h5 class="mb-3" style="color: white;">You completed: {{ $session->title }}</h5>
                                <div class="d-flex justify-content-center gap-4 flex-wrap">
                                    <div>
                                        <div class="h3 mb-0">{{ $session->answered_questions }}</div>
                                        <small>Questions Answered</small>
                                    </div>
                                    <div>
                                        <div class="h3 mb-0">{{ number_format($session->overall_score, 1) }}%</div>
                                        <small>Overall Score</small>
                                    </div>
                                    <div>
                                        <div class="h3 mb-0">{{ $session->formatted_duration }}</div>
                                        <small>Total Time</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <!-- Overall Performance -->
                        <div class="col-lg-4 mb-4">
                            <div class="card h-100" style="border-radius: 15px; border: 2px solid {{ $session->performance_color }};">
                                <div class="card-body text-center p-4">
                                    <h5 class="mb-4">Overall Performance</h5>

                                    <!-- Score Circle -->
                                    <div class="mb-4">
                                        <svg width="180" height="180">
                                            <circle cx="90" cy="90" r="75" fill="none" stroke="#F3F4F6" stroke-width="12"/>
                                            <circle cx="90" cy="90" r="75" fill="none" stroke="{{ $session->performance_color }}" stroke-width="12"
                                                    stroke-dasharray="{{ 2 * 3.14159 * 75 }}"
                                                    stroke-dashoffset="{{ 2 * 3.14159 * 75 * (1 - $session->overall_score / 100) }}"
                                                    stroke-linecap="round"
                                                    style="transform: rotate(-90deg); transform-origin: center;"/>
                                        </svg>
                                        <div style="position: relative; margin-top: -120px;">
                                            <div style="font-size: 48px; font-weight: bold; color: {{ $session->performance_color }};">
                                                {{ number_format($session->overall_score, 1) }}
                                            </div>
                                            <div class="text-muted">out of 100</div>
                                        </div>
                                    </div>

                                    <h4 class="mb-3" style="color: {{ $session->performance_color }};">{{ $session->performance_level }}</h4>

                                    @if($session->ai_feedback && isset($session->ai_feedback['summary']))
                                        <p class="text-muted small">{{ $session->ai_feedback['summary'] }}</p>
                                    @endif
                                </div>
                            </div>
                        </div>

                        <!-- Key Insights -->
                        <div class="col-lg-8 mb-4">
                            <div class="card h-100" style="border-radius: 15px;">
                                <div class="card-header" style="background: linear-gradient(135deg, #8B5CF6 0%, #E91E8C 100%); color: white; border-radius: 15px 15px 0 0;">
                                    <h5 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Key Insights</h5>
                                </div>
                                <div class="card-body">
                                    @if($session->strengths && count($session->strengths) > 0)
                                        <div class="mb-4">
                                            <h6 style="color: #10B981;"><i class="fas fa-check-circle me-2"></i>Your Strengths</h6>
                                            <div class="d-flex flex-wrap gap-2">
                                                @foreach($session->strengths as $strength)
                                                    <span class="badge" style="background: #D1FAE5; color: #065F46; font-size: 14px; padding: 8px 12px;">
                                                        <i class="fas fa-star me-1"></i>{{ $strength }}
                                                    </span>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif

                                    @if($session->improvements && count($session->improvements) > 0)
                                        <div class="mb-4">
                                            <h6 style="color: #F59E0B;"><i class="fas fa-arrow-up me-2"></i>Areas for Improvement</h6>
                                            <div class="d-flex flex-wrap gap-2">
                                                @foreach($session->improvements as $improvement)
                                                    <span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 14px; padding: 8px 12px;">
                                                        <i class="fas fa-exclamation-triangle me-1"></i>{{ $improvement }}
                                                    </span>
                                                @endforeach
                                            </div>
                                        </div>
                                    @endif

                                    @if($session->ai_feedback)
                                        @if(isset($session->ai_feedback['performance_trend']))
                                            <div class="alert alert-info mb-3">
                                                <strong><i class="fas fa-chart-line me-2"></i>Performance Trend:</strong>
                                                {{ $session->ai_feedback['performance_trend'] }}
                                            </div>
                                        @endif

                                        @if(isset($session->ai_feedback['time_management']))
                                            <div class="alert alert-warning mb-3">
                                                <strong><i class="fas fa-clock me-2"></i>Time Management:</strong>
                                                {{ $session->ai_feedback['time_management'] }}
                                            </div>
                                        @endif
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- AI Recommendations -->
                    @if($session->ai_feedback && isset($session->ai_feedback['recommendations']))
                        <div class="card mb-4" style="border-radius: 15px; border: 2px solid #8B5CF6;">
                            <div class="card-header bg-white">
                                <h5 class="mb-0" style="color: #8B5CF6;"><i class="fas fa-lightbulb me-2"></i>AI Recommendations</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    @foreach($session->ai_feedback['recommendations'] as $recommendation)
                                        <li class="list-group-item border-0 px-0">
                                            <i class="fas fa-check-circle me-2" style="color: #8B5CF6;"></i>
                                            {{ $recommendation }}
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        </div>
                    @endif

                    <!-- Recommended Topics -->
                    @if($session->recommended_topics && count($session->recommended_topics) > 0)
                        <div class="card mb-4" style="border-radius: 15px; border: 2px solid #E91E8C;">
                            <div class="card-body">
                                <h5 style="color: #E91E8C;"><i class="fas fa-bookmark me-2"></i>Practice These Topics Next</h5>
                                <p class="text-muted mb-3">Based on your performance, we recommend focusing on these topics:</p>
                                <div class="d-flex flex-wrap gap-2">
                                    @foreach($session->recommended_topics as $topic)
                                        <span class="badge" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: white; font-size: 14px; padding: 10px 16px;">
                                            {{ $topic }}
                                        </span>
                                    @endforeach
                                </div>
                            </div>
                        </div>
                    @endif

                    <!-- Detailed Question-by-Question Breakdown -->
                    <div class="card mb-4" style="border-radius: 15px;">
                        <div class="card-header bg-white">
                            <h5 class="mb-0"><i class="fas fa-list-check me-2"></i>Question-by-Question Breakdown</h5>
                        </div>
                        <div class="card-body">
                            @foreach($answers as $index => $answer)
                                <div class="mb-4 pb-4 {{ !$loop->last ? 'border-bottom' : '' }}">
                                    <div class="d-flex justify-content-between align-items-start mb-3">
                                        <div class="flex-grow-1">
                                            <h6 class="mb-2">
                                                <span class="badge" style="background: {{ $answer->question->difficulty_color }};">
                                                    Question {{ $index + 1 }}
                                                </span>
                                                <span class="badge bg-secondary ms-1">
                                                    <i class="{{ $answer->question->type_icon }} me-1"></i>
                                                    {{ ucfirst(str_replace('_', ' ', $answer->question->type)) }}
                                                </span>
                                            </h6>
                                            <p class="mb-2 fw-bold">{{ $answer->question->question }}</p>
                                        </div>
                                        <div class="text-end">
                                            <div class="badge" style="background: {{ $answer->score_color }}; font-size: 18px; padding: 10px 15px;">
                                                {{ number_format($answer->score, 1) }}%
                                            </div>
                                            <div class="small text-muted mt-1">{{ $answer->score_badge }}</div>
                                        </div>
                                    </div>

                                    <!-- Performance Metrics -->
                                    <div class="row mb-3">
                                        @foreach($answer->performance_metrics as $metric)
                                            <div class="col-6 col-md-3 mb-2">
                                                <div class="text-center p-2" style="background: {{ $metric['color'] }}15; border-radius: 8px;">
                                                    <div style="font-size: 20px; font-weight: bold; color: {{ $metric['color'] }};">
                                                        {{ number_format($metric['score'], 0) }}
                                                    </div>
                                                    <small class="text-muted">{{ $metric['label'] }}</small>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>

                                    <!-- Your Answer -->
                                    <div class="mb-3">
                                        <h6 class="text-muted">Your Answer:</h6>
                                        <div class="p-3" style="background: #F9FAFB; border-left: 4px solid #E91E8C; border-radius: 5px;">
                                            <p class="mb-0">{{ Str::limit($answer->answer, 300) }}</p>
                                            <small class="text-muted">
                                                <i class="fas fa-font me-1"></i>{{ $answer->word_count }} words •
                                                <i class="fas fa-clock me-1"></i>{{ $answer->formatted_time }}
                                            </small>
                                        </div>
                                    </div>

                                    <!-- Feedback -->
                                    <div class="row">
                                        @if($answer->strengths && count($answer->strengths) > 0)
                                            <div class="col-md-6 mb-2">
                                                <div class="p-3" style="background: #D1FAE5; border-radius: 8px;">
                                                    <h6 style="color: #065F46;"><i class="fas fa-thumbs-up me-2"></i>Strengths</h6>
                                                    <ul class="mb-0 small">
                                                        @foreach($answer->strengths as $strength)
                                                            <li>{{ $strength }}</li>
                                                        @endforeach
                                                    </ul>
                                                </div>
                                            </div>
                                        @endif

                                        @if($answer->weaknesses && count($answer->weaknesses) > 0)
                                            <div class="col-md-6 mb-2">
                                                <div class="p-3" style="background: #FEE2E2; border-radius: 8px;">
                                                    <h6 style="color: #991B1B;"><i class="fas fa-info-circle me-2"></i>To Improve</h6>
                                                    <ul class="mb-0 small">
                                                        @foreach($answer->weaknesses as $weakness)
                                                            <li>{{ $weakness }}</li>
                                                        @endforeach
                                                    </ul>
                                                </div>
                                            </div>
                                        @endif
                                    </div>

                                    @if($answer->improvement_tip)
                                        <div class="alert alert-info mt-2 mb-0">
                                            <strong><i class="fas fa-lightbulb me-2"></i>Improvement Tip:</strong>
                                            {{ $answer->improvement_tip }}
                                        </div>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="text-center mb-5">
                        <a href="{{ route('member.interview-coach.create') }}" class="btn btn-primary btn-lg me-2">
                            <i class="fas fa-redo me-2"></i>Practice Again
                        </a>
                        <a href="{{ route('member.interview-coach.history') }}" class="btn btn-outline-primary btn-lg me-2">
                            <i class="fas fa-history me-2"></i>View History
                        </a>
                        <a href="{{ route('member.interview-coach.index') }}" class="btn btn-outline-secondary btn-lg">
                            <i class="fas fa-home me-2"></i>Back to Dashboard
                        </a>
                    </div>

                </div>
            </div>
        </div>
    </section>
@endsection
