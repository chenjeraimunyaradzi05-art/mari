@php use Illuminate\Support\Str; @endphp

@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">{{ $page->name }} Courses</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('organizations.show', $page->slug) }}">Organization</a></li>
                            <li>Courses</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-40">
        <div class="container">
            <div class="row g-4">
                <div class="col-lg-3">
                    <form method="GET" action="" class="card shadow-sm p-3">
                        <h5 class="mb-3">Refine results</h5>
                        <div class="mb-3">
                            <label class="form-label" for="course-search">Search</label>
                            <input type="search" id="course-search" name="q" value="{{ $filters['query'] ?? '' }}" class="form-control" placeholder="Find a course">
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Delivery mode</label>
                            @foreach(['on_campus' => 'On campus', 'online' => 'Online', 'hybrid' => 'Hybrid'] as $modeValue => $modeLabel)
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="mode[]" value="{{ $modeValue }}" id="mode-{{ $modeValue }}" @checked(in_array($modeValue, $filters['mode'] ?? []))>
                                    <label class="form-check-label" for="mode-{{ $modeValue }}">{{ $modeLabel }}</label>
                                </div>
                            @endforeach
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Course type</label>
                            @foreach(['bachelor' => 'Bachelor', 'masters' => 'Masters', 'micro' => 'Micro credential', 'tafe_cert' => 'TAFE Certificate', 'tafe_diploma' => 'TAFE Diploma', 'short' => 'Short course', 'apprenticeship' => 'Apprenticeship'] as $typeValue => $typeLabel)
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="type[]" value="{{ $typeValue }}" id="type-{{ $typeValue }}" @checked(in_array($typeValue, $filters['type'] ?? []))>
                                    <label class="form-check-label" for="type-{{ $typeValue }}">{{ $typeLabel }}</label>
                                </div>
                            @endforeach
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="price-max">Maximum tuition (AUD)</label>
                            <input type="number" min="0" step="500" id="price-max" name="price_max_cents" value="{{ $filters['price_max_cents'] ?? '' }}" class="form-control" placeholder="E.g. 150000">
                            <small class="text-muted">Enter amount in cents (e.g. 150000 = $1,500)</small>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="duration-max">Maximum duration (weeks)</label>
                            <input type="number" min="1" id="duration-max" name="duration_max_weeks" value="{{ $filters['duration_max_weeks'] ?? '' }}" class="form-control">
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="start-after">Starts after</label>
                            <input type="date" id="start-after" name="start_after" value="{{ optional($filters['start_after'] ?? null)->format('Y-m-d') }}" class="form-control">
                        </div>

                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="has-scholarship" name="scholarship" value="1" @checked($filters['scholarship'] ?? false)>
                            <label class="form-check-label" for="has-scholarship">Scholarship support available</label>
                        </div>

                        <div class="d-grid gap-2">
                            <button type="submit" class="btn btn-primary">Apply filters</button>
                            <a href="{{ route('organizations.courses.index', $page->slug) }}" class="btn btn-outline-secondary">Reset</a>
                        </div>
                    </form>
                </div>

                <div class="col-lg-9">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h3 class="mb-0">{{ number_format($courses->total()) }} courses</h3>
                            <p class="text-muted mb-0">Showing results for {{ $page->name }} with the selected filters.</p>
                        </div>
                    </div>

                    @forelse($courses as $course)
                        <div class="card shadow-sm mb-4">
                            <div class="card-body">
                                <div class="d-flex justify-content-between flex-wrap gap-3">
                                    <div class="flex-grow-1">
                                        <div class="d-flex align-items-center gap-2 mb-2">
                                            <span class="badge bg-secondary text-uppercase">{{ Str::upper($course->type) }}</span>
                                            <span class="badge bg-light text-dark">{{ Str::title(str_replace('_', ' ', $course->mode)) }}</span>
                                            @if($course->apprenticeships_count ?? 0)
                                                <span class="badge bg-primary">Apprenticeships linked: {{ $course->apprenticeships_count }}</span>
                                            @endif
                                        </div>
                                        <h4 class="mb-2">
                                            <a class="text-decoration-none" href="{{ route('organizations.courses.show', [$page->slug, $course->slug]) }}">
                                                {{ $course->title }}
                                            </a>
                                        </h4>
                                        <p class="text-muted mb-3">{{ Str::limit($course->summary, 200) }}</p>

                                        <div class="row text-muted small g-3">
                                            <div class="col-md-4"><i class="fas fa-map-marker-alt me-1 text-primary"></i>{{ $course->location ?? 'Flexible' }}</div>
                                            <div class="col-md-4"><i class="fas fa-clock me-1 text-primary"></i>{{ $course->duration_weeks ? $course->duration_weeks.' weeks' : 'Flexible duration' }}</div>
                                            <div class="col-md-4"><i class="fas fa-dollar-sign me-1 text-primary"></i>{{ $course->cost_cents ? '$'.number_format($course->cost_cents / 100, 2) : 'Contact for pricing' }}</div>
                                        </div>

                                        @php $nextIntake = $course->intakes->first(); @endphp
                                        <div class="mt-3">
                                            @if($nextIntake)
                                                <span class="badge bg-success-subtle text-success">
                                                    <i class="fas fa-calendar-alt me-1"></i>
                                                    Next intake {{ optional($nextIntake->start_on)->format('M j, Y') }}
                                                </span>
                                            @else
                                                <span class="badge bg-light text-dark">Intake timetable coming soon</span>
                                            @endif
                                        </div>
                                    </div>
                                    <div class="d-flex flex-column align-items-end justify-content-between">
                                        <a class="btn btn-outline-primary" href="{{ route('organizations.courses.show', [$page->slug, $course->slug]) }}">View details</a>
                                        <span class="text-muted small mt-3">Open intakes: {{ $course->open_intakes_count ?? 0 }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    @empty
                        <div class="alert alert-light border">No courses match your criteria yet. Adjust filters or check back soon.</div>
                    @endforelse

                    <div class="mt-4">
                        {{ $courses->links() }}
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
