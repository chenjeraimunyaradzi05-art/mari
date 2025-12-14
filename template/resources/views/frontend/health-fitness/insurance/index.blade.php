@extends('frontend.layouts.master')

@section('title', 'Compare Health Insurance Plans')

@section('contents')
<div class="container py-5">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h1 class="h2">Health Insurance Plans</h1>
            <p class="text-muted">
                Find the right coverage for your needs.
                <span class="badge bg-success-subtle text-success border border-success-subtle ms-2">
                    <i class="fas fa-chart-line me-1"></i> Live Market Rates
                </span>
            </p>
        </div>
        <a href="{{ route('health-fitness.index') }}" class="btn btn-outline-secondary">Back to Health & Fitness</a>
    </div>

    <form action="{{ route('health-fitness.insurance.compare') }}" method="GET">
        <div class="row g-4">
            @forelse($plans as $plan)
                <div class="col-md-4">
                    <div class="card h-100 shadow-sm">
                        <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                            <div class="d-flex justify-content-between align-items-start">
                                <span class="badge bg-info text-dark">{{ $plan->coverage_type }}</span>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="plans[]" value="{{ $plan->id }}" id="plan_{{ $plan->id }}">
                                    <label class="form-check-label small text-muted" for="plan_{{ $plan->id }}">Compare</label>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <h3 class="h5 card-title mb-1">{{ $plan->provider_name }}</h3>
                            <p class="lead mb-3">{{ $plan->plan_name }}</p>

                            <div class="mb-3">
                                <span class="display-6 fw-bold">${{ number_format($plan->monthly_premium, 0) }}</span>
                                <span class="text-muted">/mo</span>
                            </div>

                            <ul class="list-unstyled mb-4 small">
                                <li class="mb-2 d-flex justify-content-between">
                                    <span>Deductible:</span>
                                    <span class="fw-semibold">${{ number_format($plan->deductible, 0) }}</span>
                                </li>
                                <li class="mb-2 d-flex justify-content-between">
                                    <span>Out-of-Pocket Max:</span>
                                    <span class="fw-semibold">${{ number_format($plan->out_of_pocket_max, 0) }}</span>
                                </li>
                                <li class="mb-2 d-flex justify-content-between">
                                    <span>Rating:</span>
                                    <span class="text-warning">
                                        @for($i = 0; $i < floor($plan->rating); $i++) <i class="fas fa-star"></i> @endfor
                                        @if($plan->rating - floor($plan->rating) >= 0.5) <i class="fas fa-star-half-alt"></i> @endif
                                        <span class="text-dark ms-1">({{ $plan->rating }})</span>
                                    </span>
                                </li>
                            </ul>

                            @if($plan->features)
                                <div class="mb-3">
                                    @foreach(array_slice($plan->features, 0, 3) as $feature)
                                        <span class="badge bg-light text-dark border me-1 mb-1">{{ $feature }}</span>
                                    @endforeach
                                </div>
                            @endif
                        </div>
                        <div class="card-footer bg-white border-top-0 pb-4">
                            <div class="d-grid">
                                <button type="button" class="btn btn-outline-primary">View Details</button>
                            </div>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="alert alert-info">No insurance plans found at the moment.</div>
                </div>
            @endforelse
        </div>

        @if($plans->isNotEmpty())
            <div class="fixed-bottom bg-white border-top py-3 shadow-lg" style="z-index: 1030;">
                <div class="container d-flex justify-content-between align-items-center">
                    <span class="fw-semibold">Select up to 3 plans to compare</span>
                    <button type="submit" class="btn btn-primary px-4">Compare Selected</button>
                </div>
            </div>
            <!-- Spacer for fixed bottom bar -->
            <div style="height: 80px;"></div>
        @endif
    </form>
</div>
@endsection
