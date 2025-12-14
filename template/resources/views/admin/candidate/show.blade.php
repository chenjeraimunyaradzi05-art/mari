@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>{{ $candidate->full_name ?? 'Member profile' }}</h1>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
                <div class="breadcrumb-item"><a href="{{ route('admin.candidates.index') }}">Members</a></div>
                <div class="breadcrumb-item active">Profile</div>
            </div>
        </div>

        <div class="row">
            <div class="col-lg-4">
                <div class="card shadow-sm mb-4">
                    <div class="card-body text-center">
                        <div class="mb-3">
                            @if($candidate->image)
                                <img src="{{ asset($candidate->image) }}" alt="{{ $candidate->full_name }}" class="rounded-circle" style="width: 120px; height: 120px; object-fit: cover;">
                            @else
                                <div class="rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 120px; height: 120px; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); color: #fff; font-size: 2rem;">
                                    {{ strtoupper(substr($candidate->full_name ?? 'U', 0, 1)) }}
                                </div>
                            @endif
                        </div>

                        <h4 class="mb-1">{{ $candidate->full_name ?? 'Unknown member' }}</h4>
                        <p class="text-muted mb-3">{{ $candidate->title ?? $candidate->profession?->name ?? 'Role not provided' }}</p>

                        <div class="d-flex justify-content-center gap-3 mb-3">
                            <div>
                                <small class="text-muted d-block">Profile score</small>
                                <strong>{{ number_format($profileScore ?? 0, 1) }}%</strong>
                            </div>
                            <div>
                                <small class="text-muted d-block">Experience</small>
                                <strong>{{ $candidate->experience?->name ?? 'n/a' }}</strong>
                            </div>
                        </div>

                        <div class="mb-2"><i class="fas fa-envelope me-2 text-primary"></i>{{ $candidate->user?->email ?? $candidate->email ?? 'No email supplied' }}</div>
                        @if($candidate->mobile)
                            <div class="mb-2"><i class="fas fa-phone me-2 text-primary"></i>{{ $candidate->mobile }}</div>
                        @endif
                        @if($candidate->candidateCity || $candidate->candidateCountry)
                            <div><i class="fas fa-map-marker-alt me-2 text-primary"></i>
                                {{ $candidate->candidateCity?->name }}{{ $candidate->candidateState ? ', '.$candidate->candidateState->name : '' }}{{ $candidate->candidateCountry ? ', '.$candidate->candidateCountry->name : '' }}
                            </div>
                        @endif
                    </div>
                </div>

                <div class="card shadow-sm">
                    <div class="card-header"><h4 class="mb-0">Snapshot</h4></div>
                    <div class="card-body">
                        <ul class="list-unstyled mb-0">
                            <li class="mb-3">
                                <small class="text-muted text-uppercase">Visibility</small>
                                <div>{{ $candidate->visibility ? 'Published' : 'Hidden' }}</div>
                            </li>
                            <li class="mb-3">
                                <small class="text-muted text-uppercase">Pronouns</small>
                                <div>{{ $candidate->pronoun->display_name ?? '—' }}</div>
                            </li>
                            <li>
                                <small class="text-muted text-uppercase">Last updated</small>
                                <div>{{ optional($candidate->updated_at)->diffForHumans() ?? '—' }}</div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card shadow-sm mb-4">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Professional profile</h4>
                        <span class="badge bg-primary text-uppercase">Score {{ number_format($profileScore ?? 0, 1) }}%</span>
                    </div>
                    <div class="card-body">
                        <p>{{ $candidate->bio ?? 'No bio has been provided for this member yet.' }}</p>
                        <div class="row text-center">
                            <div class="col-md-4 mb-3">
                                <small class="text-muted d-block">Skills</small>
                                <strong>{{ $candidate->skills->count() }}</strong>
                            </div>
                            <div class="col-md-4 mb-3">
                                <small class="text-muted d-block">Languages</small>
                                <strong>{{ $candidate->languages->count() }}</strong>
                            </div>
                            <div class="col-md-4 mb-3">
                                <small class="text-muted d-block">Experiences</small>
                                <strong>{{ $candidate->experiences->count() }}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card shadow-sm mb-4">
                    <div class="card-header"><h4 class="mb-0">AI insights</h4></div>
                    <div class="card-body">
                        <div class="row g-4">
                            <div class="col-md-6">
                                <h6 class="text-muted">Professional strengths</h6>
                                <p class="mb-0">{{ $professionalInsights ?: 'Insights have not been generated yet.' }}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-muted">Personality highlights</h6>
                                <p class="mb-0">{{ $personalityInsights ?: 'Insights have not been generated yet.' }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card shadow-sm">
                    <div class="card-header"><h4 class="mb-0">Career timeline</h4></div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-striped mb-0">
                                <thead>
                                    <tr>
                                        <th>Role</th>
                                        <th>Company</th>
                                        <th>Period</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse($candidate->experiences as $experience)
                                        <tr>
                                            <td>{{ $experience->title ?? '—' }}</td>
                                            <td>{{ $experience->company_name ?? '—' }}</td>
                                            <td>
                                                @php
                                                    $start = optional($experience->start_date)->format('M Y');
                                                    $end = $experience->is_current ? 'Present' : optional($experience->end_date)->format('M Y');
                                                @endphp
                                                {{ trim(($start ? $start.' - ' : '').($end ?: '')) ?: '—' }}
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="3" class="text-center text-muted">No experience records yet.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
