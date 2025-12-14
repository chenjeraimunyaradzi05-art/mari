@extends('frontend.layouts.master')

@section('contents')
<section class="section-box mt-75">
    <div class="breacrumb-cover">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-12">
                    <h2 class="mb-20">Gamification Dashboard</h2>
                    <ul class="breadcrumbs">
                        <li><a class="home-icon" href="{{ route('home') }}">Home</a></li>
                        <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                        <li>Gamification</li>
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
                <!-- Welcome Banner -->
                <div class="card mb-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 12px;">
                    <div class="card-body text-white p-4">
                        <div class="d-flex align-items-center justify-content-between">
                            <div>
                                <h3 class="text-white mb-2">
                                    <i class="fas fa-trophy me-2"></i>Level {{ $stats['level']['current'] }} - {{ $stats['level']['title'] }}
                                </h3>
                                <p class="mb-0 opacity-90">
                                    Earn points, unlock badges, and compete on the leaderboard!
                                </p>
                            </div>
                            <div class="text-end">
                                <h2 class="text-white mb-0">{{ number_format($stats['points']['total']) }}</h2>
                                <small class="opacity-90">Total Points</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Level Progress -->
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 class="mb-0">Level Progress</h5>
                            <span class="badge bg-primary fs-6">Level {{ $stats['level']['current'] }}</span>
                        </div>
                        <div class="progress mb-2" style="height: 20px;">
                            <div class="progress-bar" role="progressbar"
                                style="width: {{ $stats['level']['progress'] }}%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);"
                                aria-valuenow="{{ $stats['level']['progress'] }}"
                                aria-valuemin="0" aria-valuemax="100">
                                {{ number_format($stats['level']['progress'], 1) }}%
                            </div>
                        </div>
                        <small class="text-muted">{{ number_format($stats['points']['total']) }} / {{ number_format($stats['level']['next_level_points']) }} points to next level</small>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="row g-3 mb-4">
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body text-center">
                                <div class="mb-2" style="color: #FFD700;">
                                    <i class="fas fa-star" style="font-size: 2.5rem;"></i>
                                </div>
                                <h3 class="mb-0">{{ number_format($stats['points']['total']) }}</h3>
                                <small class="text-muted">Total Points</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body text-center">
                                <div class="mb-2" style="color: #A855F7;">
                                    <i class="fas fa-medal" style="font-size: 2.5rem;"></i>
                                </div>
                                <h3 class="mb-0">{{ $stats['badges']['earned'] }}</h3>
                                <small class="text-muted">Badges Earned</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body text-center">
                                <div class="mb-2" style="color: #10B981;">
                                    <i class="fas fa-fire" style="font-size: 2.5rem;"></i>
                                </div>
                                <h3 class="mb-0">{{ $stats['streak'] }}</h3>
                                <small class="text-muted">Day Streak</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm h-100">
                            <div class="card-body text-center">
                                <div class="mb-2" style="color: #F59E0B;">
                                    <i class="fas fa-trophy" style="font-size: 2.5rem;"></i>
                                </div>
                                <h3 class="mb-0">#{{ $stats['rank'] }}</h3>
                                <small class="text-muted">Global Rank</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Points Breakdown -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="card border-0" style="background: linear-gradient(135deg, #667eea11 0%, #764ba211 100%);">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-chart-line text-primary me-3" style="font-size: 2rem;"></i>
                                    <div>
                                        <h4 class="mb-0">{{ number_format($stats['points']['monthly']) }}</h4>
                                        <small class="text-muted">Monthly Points</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0" style="background: linear-gradient(135deg, #10B98111 0%, #34D39911 100%);">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-calendar-week text-success me-3" style="font-size: 2rem;"></i>
                                    <div>
                                        <h4 class="mb-0">{{ number_format($stats['points']['weekly']) }}</h4>
                                        <small class="text-muted">Weekly Points</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card border-0" style="background: linear-gradient(135deg, #F59E0B11 0%, #EF444411 100%);">
                            <div class="card-body">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-infinity text-warning me-3" style="font-size: 2rem;"></i>
                                    <div>
                                        <h4 class="mb-0">{{ number_format($stats['points']['lifetime']) }}</h4>
                                        <small class="text-muted">Lifetime Points</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <a href="{{ route('member.gamification.achievements') }}" class="card border-0 shadow-sm text-decoration-none h-100">
                            <div class="card-body text-center p-4">
                                <i class="fas fa-medal text-warning mb-3" style="font-size: 3rem;"></i>
                                <h5>Achievements</h5>
                                <p class="text-muted mb-0">View all badges & achievements</p>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-4">
                        <a href="{{ route('member.gamification.challenges') }}" class="card border-0 shadow-sm text-decoration-none h-100">
                            <div class="card-body text-center p-4">
                                <i class="fas fa-tasks text-info mb-3" style="font-size: 3rem;"></i>
                                <h5>Challenges</h5>
                                <p class="text-muted mb-0">{{ $stats['challenges']['active'] }} active challenges</p>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-4">
                        <a href="{{ route('member.gamification.leaderboard') }}" class="card border-0 shadow-sm text-decoration-none h-100">
                            <div class="card-body text-center p-4">
                                <i class="fas fa-trophy text-success mb-3" style="font-size: 3rem;"></i>
                                <h5>Leaderboard</h5>
                                <p class="text-muted mb-0">See top performers</p>
                            </div>
                        </a>
                    </div>
                </div>

                <!-- Top Leaderboard Preview -->
                @if($leaderboard->count() > 0)
                    <div class="card border-0 shadow-sm mb-4">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h5 class="mb-0"><i class="fas fa-trophy text-warning me-2"></i>Top Performers</h5>
                                <a href="{{ route('member.gamification.leaderboard') }}" class="btn btn-sm btn-outline-primary">
                                    View Full Leaderboard <i class="fas fa-arrow-right ms-1"></i>
                                </a>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Member</th>
                                            <th>Level</th>
                                            <th>Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($leaderboard as $index => $entry)
                                            <tr>
                                                <td>
                                                    <span class="badge" style="background: {{ $index === 0 ? '#FFD700' : ($index === 1 ? '#C0C0C0' : ($index === 2 ? '#CD7F32' : '#6B7280')) }};">
                                                        #{{ $index + 1 }}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div class="d-flex align-items-center">
                                                        <img src="{{ $entry->candidate->image ? asset($entry->candidate->image) : asset('frontend/assets/imgs/avatar/default.png') }}"
                                                             class="rounded-circle me-2"
                                                             style="width: 32px; height: 32px; object-fit: cover;"
                                                             alt="">
                                                        <span>{{ $entry->candidate->full_name }}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span class="badge" style="background: {{ $entry->level_color }};">
                                                        Level {{ $entry->current_level }}
                                                    </span>
                                                </td>
                                                <td><strong>{{ number_format($entry->total_points) }}</strong></td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                @endif

                <!-- Recent Activity -->
                @if($recentActivity->count() > 0)
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-4">
                            <h5 class="mb-4"><i class="fas fa-history text-info me-2"></i>Recent Activity</h5>
                            <div class="list-group list-group-flush">
                                @foreach($recentActivity as $activity)
                                    <div class="list-group-item px-0 d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 class="mb-1">{{ $activity->description }}</h6>
                                            <small class="text-muted">{{ $activity->created_at->diffForHumans() }}</small>
                                        </div>
                                        <span class="badge bg-success fs-6">+{{ $activity->points }} pts</span>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    </div>
                @endif

                <!-- How to Earn Points -->
                <div class="card border-0 shadow-sm mt-4" style="background: linear-gradient(135deg, #f093fb22 0%, #f5576c22 100%);">
                    <div class="card-body p-4">
                        <h5 class="mb-3">💡 How to Earn More Points</h5>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <ul class="list-unstyled mb-0">
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Complete your profile (+100 pts)</li>
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Apply to jobs (+15 pts each)</li>
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Complete interview sessions (+50 pts)</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <ul class="list-unstyled mb-0">
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Complete learning resources (+100 pts)</li>
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Maintain daily streak (+5 pts)</li>
                                    <li class="mb-2"><i class="fas fa-check-circle text-success me-2"></i>Complete challenges (varies)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
@endsection
