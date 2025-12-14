@php use Illuminate\Support\Str; @endphp

@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">{{ $course->title }}</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('organizations.show', $page->slug) }}">{{ $page->name }}</a></li>
                            <li><a href="{{ route('organizations.courses.index', $page->slug) }}">Courses</a></li>
                            <li>{{ $course->title }}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-40">
        <div class="container">
            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="card shadow-sm mb-4">
                        <div class="card-body">
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                <span class="badge bg-secondary text-uppercase">{{ Str::upper($course->type) }}</span>
                                <span class="badge bg-light text-dark">{{ Str::title(str_replace('_', ' ', $course->mode)) }}</span>
                                @if($course->location)
                                    <span class="badge bg-light text-dark"><i class="fas fa-map-marker-alt me-1"></i>{{ $course->location }}</span>
                                @endif
                            </div>
                            @if($course->summary)
                                <p class="lead text-muted">{{ $course->summary }}</p>
                            @endif

                            <dl class="row text-muted small">
                                <dt class="col-sm-4">Duration</dt>
                                <dd class="col-sm-8">{{ $course->duration_weeks ? $course->duration_weeks.' weeks' : 'Flexible' }}</dd>

                                <dt class="col-sm-4">Investment</dt>
                                <dd class="col-sm-8">{{ $course->cost_cents ? '$'.number_format($course->cost_cents / 100, 2) : 'Contact for pricing' }}</dd>

                                <dt class="col-sm-4">Application URL</dt>
                                <dd class="col-sm-8">
                                    @if($course->application_url)
                                        <a href="{{ $course->application_url }}" target="_blank" rel="noopener">Apply online</a>
                                    @else
                                        Not provided yet
                                    @endif
                                </dd>

                                <dt class="col-sm-4">Contact</dt>
                                <dd class="col-sm-8">
                                    {{ $course->contact_email ?? 'team@'.$page->slug.'.com' }}
                                    @if($course->contact_phone)
                                        · {{ $course->contact_phone }}
                                    @endif
                                </dd>
                            </dl>

                            @if(!empty($course->outcomes))
                                <div class="mt-4">
                                    <h4>Learning outcomes</h4>
                                    <ul class="list-unstyled">
                                        @foreach($course->outcomes as $outcome)
                                            <li class="d-flex align-items-center mb-2"><i class="fas fa-check text-success me-2"></i><span>{{ $outcome }}</span></li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif

                            @if(!empty($course->prerequisites))
                                <div class="mt-4">
                                    <h4>Prerequisites</h4>
                                    <ul class="list-unstyled">
                                        @foreach($course->prerequisites as $prerequisite)
                                            <li class="d-flex align-items-center mb-2"><i class="fas fa-clipboard-check text-warning me-2"></i><span>{{ is_array($prerequisite) ? ($prerequisite['label'] ?? json_encode($prerequisite)) : $prerequisite }}</span></li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif

                            @if(!empty($course->funding))
                                <div class="mt-4">
                                    <h4>Funding options</h4>
                                    <ul class="list-unstyled">
                                        @foreach($course->funding as $key => $value)
                                            @if($value)
                                                <li class="d-flex align-items-center mb-2"><i class="fas fa-hand-holding-usd text-primary me-2"></i><span>{{ Str::headline(str_replace('_', ' ', (string) $key)) }}</span></li>
                                            @endif
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                        </div>
                    </div>

                    <div class="card shadow-sm mb-4">
                        <div class="card-body">
                            <h3 class="h5 mb-3">Upcoming intakes</h3>
                            @php $upcoming = $course->intakes->filter(fn ($intake) => $intake->status === 'open'); @endphp
                            @forelse($upcoming as $intake)
                                <div class="border rounded p-3 mb-3">
                                    <div class="d-flex justify-content-between flex-wrap gap-2">
                                        <div>
                                            <div class="fw-semibold">Starts {{ optional($intake->start_on)->format('M j, Y') }}</div>
                                            <div class="text-muted small">Apply by {{ optional($intake->apply_by)->format('M j, Y') ?? 'open until filled' }}</div>
                                        </div>
                                        <div class="text-muted small">
                                            Seats: {{ $intake->seats ?? 'Unlimited' }}
                                        </div>
                                    </div>
                                    @if(!empty($intake->scholarships))
                                        <div class="mt-2">
                                            <span class="badge bg-success">Scholarships available</span>
                                        </div>
                                    @endif
                                </div>
                            @empty
                                <p class="text-muted mb-0">New intake schedule is being finalised. Register your interest to be notified.</p>
                            @endforelse
                        </div>
                    </div>

                    @if(($course->apprenticeships ?? collect())->isNotEmpty())
                        <div class="card shadow-sm mb-4">
                            <div class="card-body">
                                <h3 class="h5 mb-3">Related apprenticeships</h3>
                                <div class="list-group">
                                    @foreach($course->apprenticeships as $program)
                                        <div class="list-group-item list-group-item-action">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div class="fw-semibold">{{ $program->title }}</div>
                                                    <p class="text-muted small mb-1">{{ Str::limit($program->summary, 140) }}</p>
                                                    <div class="text-muted small">
                                                        <i class="fas fa-map-marker-alt me-1"></i>{{ $program->location ?? 'Multiple locations' }}
                                                    </div>
                                                </div>
                                                <a class="btn btn-outline-primary btn-sm" href="{{ $program->application_url ?? '#' }}" target="_blank" rel="noopener">View program</a>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>
                    @endif

                    @if(($eligibilityChecks ?? []) !== [])
                        <div class="card shadow-sm mb-4">
                            <div class="card-body">
                                <h3 class="h5 mb-3">Eligibility checklist</h3>
                                <ul class="list-unstyled mb-0">
                                    @foreach($eligibilityChecks as $check)
                                        <li class="d-flex align-items-start mb-3">
                                            <span class="me-3">
                                                @if($check['passes'])
                                                    <i class="fas fa-check-circle text-success"></i>
                                                @else
                                                    <i class="fas fa-info-circle text-warning"></i>
                                                @endif
                                            </span>
                                            <div>
                                                <div class="fw-semibold">{{ $check['label'] }}</div>
                                                <div class="text-muted small">{{ $check['context'] }}</div>
                                            </div>
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        </div>
                    @endif
                </div>

                <div class="col-lg-4">
                    <div class="card shadow-sm mb-4">
                        <div class="card-body">
                            <h3 class="h5">Organization overview</h3>
                            <p class="text-muted">{{ $page->tagline ?? $page->about }}</p>
                            <a class="btn btn-primary w-100" href="{{ route('organizations.show', $page->slug) }}?intent=course#lead-form">Contact recruitment team</a>
                        </div>
                    </div>

                    @if($relatedCourses->isNotEmpty())
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h3 class="h6 text-uppercase">More courses you may like</h3>
                                <ul class="list-unstyled mb-0">
                                    @foreach($relatedCourses as $related)
                                        <li class="mb-3">
                                            <a class="fw-semibold text-decoration-none" href="{{ route('organizations.courses.show', [$page->slug, $related->slug]) }}">{{ $related->title }}</a>
                                            <div class="text-muted small">{{ Str::title(str_replace('_', ' ', $related->mode)) }} · {{ $related->duration_weeks ? $related->duration_weeks.' weeks' : 'Flexible' }}</div>
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </section>
@endsection
