@extends('frontend.layouts.master')

@section('title', 'Agency Dashboard')

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/public-sector.css') }}">
@endpush

@section('contents')
<div class="civic-shell">
    <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h1 class="h2 mb-0">{{ $agency->name }} Dashboard</h1>
                <p class="text-muted">Manage your agency profile, opportunities, and programs.</p>
            </div>
            <div>
                <a href="{{ route('public-sector.agency.programs.create') }}" class="btn btn-outline-primary me-2">Add Program</a>
                <a href="{{ route('public-sector.agency.opportunities.create') }}" class="btn btn-primary">Post Opportunity</a>
            </div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-md-4">
                <div class="civic-card text-center py-4">
                    <div class="display-4 fw-bold text-primary mb-2">{{ $analytics['views'] }}</div>
                    <h3 class="h6 text-muted">Profile Views</h3>
                </div>
            </div>
            <div class="col-md-4">
                <div class="civic-card text-center py-4">
                    <div class="display-4 fw-bold text-success mb-2">{{ $analytics['applications'] }}</div>
                    <h3 class="h6 text-muted">Applications</h3>
                </div>
            </div>
            <div class="col-md-4">
                <div class="civic-card text-center py-4">
                    <div class="display-4 fw-bold text-info mb-2">{{ $analytics['followers'] }}</div>
                    <h3 class="h6 text-muted">Followers</h3>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-8">
                <div class="civic-section">
                    <div class="section-header d-flex justify-content-between align-items-center">
                        <h2 class="section-title">Recent Opportunities</h2>
                        <a href="#" class="btn btn-link btn-sm">View All</a>
                    </div>

                    @if($opportunities->count() > 0)
                        <div class="list-group">
                            @foreach($opportunities as $opportunity)
                                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="mb-1">{{ $opportunity->title }}</h5>
                                        <p class="mb-1 text-muted small">{{ $opportunity->location }} · {{ ucfirst($opportunity->work_arrangement) }}</p>
                                        <small class="text-muted">Closes: {{ optional($opportunity->closes_at)->format('M j, Y') ?? 'Rolling' }}</small>
                                    </div>
                                    <div>
                                        <span class="badge bg-{{ $opportunity->status === 'open' ? 'success' : 'secondary' }}">{{ ucfirst($opportunity->status) }}</span>
                                        <a href="#" class="btn btn-sm btn-outline-secondary ms-2"><i class="fas fa-edit"></i></a>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="text-center py-5 bg-light rounded">
                            <p class="text-muted mb-3">No opportunities posted yet.</p>
                            <a href="{{ route('public-sector.agency.opportunities.create') }}" class="btn btn-outline-primary btn-sm">Create First Opportunity</a>
                        </div>
                    @endif
                </div>

                <div class="civic-section mt-4">
                    <div class="section-header d-flex justify-content-between align-items-center">
                        <h2 class="section-title">Active Programs</h2>
                        <a href="#" class="btn btn-link btn-sm">View All</a>
                    </div>

                    @if($programs->count() > 0)
                        <div class="list-group">
                            @foreach($programs as $program)
                                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="mb-1">{{ $program->title }}</h5>
                                        <p class="mb-1 text-muted small">{{ ucfirst($program->program_type) }}</p>
                                    </div>
                                    <div>
                                        <a href="#" class="btn btn-sm btn-outline-secondary"><i class="fas fa-edit"></i></a>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="text-center py-5 bg-light rounded">
                            <p class="text-muted mb-3">No programs listed.</p>
                            <a href="{{ route('public-sector.agency.programs.create') }}" class="btn btn-outline-primary btn-sm">Add Program</a>
                        </div>
                    @endif
                </div>
            </div>

            <div class="col-lg-4">
                <div class="civic-card">
                    <h3 class="h5 mb-3">Agency Profile</h3>
                    <div class="text-center mb-3">
                        @if($agency->hero_image)
                            <img src="{{ $agency->hero_image_url }}" alt="{{ $agency->name }}" class="img-fluid rounded mb-2" style="max-height: 150px;">
                        @else
                            <div class="bg-secondary text-white d-flex align-items-center justify-content-center rounded mb-2" style="height: 150px;">
                                <i class="fas fa-building fa-3x"></i>
                            </div>
                        @endif
                        <h4 class="h6">{{ $agency->name }}</h4>
                        <p class="small text-muted">{{ $agency->category }}</p>
                    </div>
                    <hr>
                    <ul class="list-unstyled small">
                        <li class="mb-2"><i class="fas fa-map-marker-alt me-2 text-muted"></i> {{ $agency->hq_city }}, {{ $agency->hq_country }}</li>
                        <li class="mb-2"><i class="fas fa-envelope me-2 text-muted"></i> {{ $agency->contact_email }}</li>
                        <li class="mb-2"><i class="fas fa-globe me-2 text-muted"></i> {{ $agency->website ?? 'No website' }}</li>
                    </ul>
                    <div class="d-grid">
                        <button class="btn btn-outline-secondary btn-sm">Edit Profile</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
