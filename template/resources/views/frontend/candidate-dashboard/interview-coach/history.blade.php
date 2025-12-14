@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Practice History</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.interview-coach.index') }}">Interview Coach</a></li>
                            <li>History</li>
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
                            <h3 class="mt-0 mb-0 color-brand-1">Practice History</h3>
                            <a href="{{ route('member.interview-coach.create') }}" class="btn btn-primary">
                                <i class="fas fa-plus me-2"></i>New Practice
                            </a>
                        </div>

                        @if($sessions->count() > 0)
                            <div class="row">
                                @foreach($sessions as $session)
                                    <div class="col-lg-12 mb-4">
                                        <div class="card" style="border: 2px solid {{ $session->status_color }}; border-radius: 15px;">
                                            <div class="card-body">
                                                <div class="row align-items-center">
                                                    <div class="col-md-8">
                                                        <div class="d-flex align-items-start">
                                                            <div class="rounded-circle p-3 me-3" style="background: {{ $session->status_color }}20;">
                                                                <i class="{{ $session->status_icon }} fa-2x" style="color: {{ $session->status_color }};"></i>
                                                            </div>
                                                            <div>
                                                                <div class="d-flex align-items-center mb-2">
                                                                    <h5 class="mb-0 me-2">{{ $session->title }}</h5>
                                                                    <span class="badge" style="background: {{ $session->status_color }};">
                                                                        {{ ucfirst($session->status) }}
                                                                    </span>
                                                                </div>

                                                                <div class="mb-2">
                                                                    <span class="badge bg-secondary me-1">
                                                                        <i class="fas fa-layer-group me-1"></i>
                                                                        {{ ucfirst(str_replace('_', ' ', $session->session_type)) }}
                                                                    </span>
                                                                    <span class="badge bg-secondary me-1">
                                                                        <i class="fas fa-signal me-1"></i>
                                                                        {{ ucfirst($session->difficulty) }}
                                                                    </span>
                                                                    @if($session->jobCategory)
                                                                        <span class="badge bg-secondary me-1">
                                                                            <i class="fas fa-folder me-1"></i>
                                                                            {{ $session->jobCategory->name }}
                                                                        </span>
                                                                    @endif
                                                                    @if($session->jobRole)
                                                                        <span class="badge bg-secondary me-1">
                                                                            <i class="fas fa-user-tag me-1"></i>
                                                                            {{ $session->jobRole->name }}
                                                                        </span>
                                                                    @endif
                                                                </div>

                                                                <div class="small text-muted">
                                                                    <i class="fas fa-calendar me-1"></i>
                                                                    {{ $session->created_at->format('M d, Y') }} at {{ $session->created_at->format('h:i A') }}
                                                                    @if($session->completed_at)
                                                                        • <i class="fas fa-clock me-1"></i>{{ $session->formatted_duration }}
                                                                    @endif
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="col-md-4">
                                                        @if($session->status === 'completed')
                                                            <!-- Completed Session Stats -->
                                                            <div class="row text-center mb-3">
                                                                <div class="col-4">
                                                                    <div class="p-2">
                                                                        <h5 class="mb-0" style="color: {{ $session->performance_color }};">
                                                                            {{ number_format($session->overall_score, 1) }}%
                                                                        </h5>
                                                                        <small class="text-muted">Score</small>
                                                                    </div>
                                                                </div>
                                                                <div class="col-4">
                                                                    <div class="p-2">
                                                                        <h5 class="mb-0" style="color: #8B5CF6;">
                                                                            {{ $session->answered_questions }}
                                                                        </h5>
                                                                        <small class="text-muted">Questions</small>
                                                                    </div>
                                                                </div>
                                                                <div class="col-4">
                                                                    <div class="p-2">
                                                                        <h5 class="mb-0" style="color: #F59E0B;">
                                                                            {{ floor($session->total_time_spent / 60) }}m
                                                                        </h5>
                                                                        <small class="text-muted">Time</small>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div class="d-flex gap-2">
                                                                <a href="{{ route('member.interview-coach.feedback', $session->id) }}"
                                                                   class="btn btn-sm btn-primary flex-grow-1">
                                                                    <i class="fas fa-chart-line me-1"></i>View Feedback
                                                                </a>
                                                                <form action="{{ route('member.interview-coach.destroy', $session->id) }}"
                                                                      method="POST"
                                                                      onsubmit="return confirm('Are you sure you want to delete this session?')"
                                                                      class="d-inline">
                                                                    @csrf
                                                                    @method('DELETE')
                                                                    <button type="submit" class="btn btn-sm btn-outline-danger">
                                                                        <i class="fas fa-trash"></i>
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        @elseif($session->status === 'in_progress')
                                                            <!-- In Progress Session -->
                                                            <div class="mb-3">
                                                                <div class="d-flex justify-content-between mb-1">
                                                                    <small>Progress</small>
                                                                    <strong>{{ $session->completion_percentage }}%</strong>
                                                                </div>
                                                                <div class="progress" style="height: 8px;">
                                                                    <div class="progress-bar bg-warning"
                                                                         style="width: {{ $session->completion_percentage }}%;"></div>
                                                                </div>
                                                                <small class="text-muted">
                                                                    {{ $session->answered_questions }}/{{ $session->total_questions }} questions
                                                                </small>
                                                            </div>

                                                            <div class="d-flex gap-2">
                                                                <a href="{{ route('member.interview-coach.practice', $session->id) }}"
                                                                   class="btn btn-sm btn-success flex-grow-1">
                                                                    <i class="fas fa-play me-1"></i>Continue
                                                                </a>
                                                                <form action="{{ route('member.interview-coach.destroy', $session->id) }}"
                                                                      method="POST"
                                                                      onsubmit="return confirm('Are you sure you want to delete this session?')"
                                                                      class="d-inline">
                                                                    @csrf
                                                                    @method('DELETE')
                                                                    <button type="submit" class="btn btn-sm btn-outline-danger">
                                                                        <i class="fas fa-trash"></i>
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        @else
                                                            <!-- Abandoned Session -->
                                                            <div class="text-center text-muted mb-3">
                                                                <i class="fas fa-times-circle fa-2x mb-2" style="color: #EF4444;"></i>
                                                                <div class="small">Session Abandoned</div>
                                                            </div>

                                                            <form action="{{ route('member.interview-coach.destroy', $session->id) }}"
                                                                  method="POST"
                                                                  onsubmit="return confirm('Are you sure you want to delete this session?')">
                                                                @csrf
                                                                @method('DELETE')
                                                                <button type="submit" class="btn btn-sm btn-outline-danger w-100">
                                                                    <i class="fas fa-trash me-1"></i>Delete
                                                                </button>
                                                            </form>
                                                        @endif
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                @endforeach
                            </div>

                            <!-- Pagination -->
                            <div class="d-flex justify-content-center mt-4">
                                {{ $sessions->links() }}
                            </div>
                        @else
                            <!-- Empty State -->
                            <div class="text-center py-5">
                                <div class="mb-4">
                                    <i class="fas fa-history fa-5x" style="color: #E5E7EB;"></i>
                                </div>
                                <h4 class="mb-3">No Practice Sessions Yet</h4>
                                <p class="text-muted mb-4">Start practicing to build your interview skills and track your progress!</p>
                                <a href="{{ route('member.interview-coach.create') }}" class="btn btn-primary btn-lg">
                                    <i class="fas fa-play me-2"></i>Start Your First Practice
                                </a>
                            </div>
                        @endif

                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
