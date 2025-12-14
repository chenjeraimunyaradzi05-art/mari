@extends('frontend.layouts.master')

@section('title', 'Health & Fitness')

@section('contents')
<div class="container py-5">
    <div class="row mb-5">
        <div class="col-lg-8 mx-auto text-center">
            <h1 class="display-4 fw-bold mb-3">Health & Fitness</h1>
            <p class="lead text-muted">Empowering your wellness journey with curated resources, fitness tracking, and health coverage options.</p>
        </div>
    </div>

    <div class="row g-4">
        <!-- Fitness Section -->
        <div class="col-md-6">
            <div class="card h-100 shadow-sm border-0">
                <div class="card-body p-5 text-center">
                    <div class="mb-4 text-primary">
                        <i class="fas fa-running fa-4x"></i>
                    </div>
                    <h2 class="h3 mb-3">Fitness Hub</h2>
                    <p class="text-muted mb-4">Access workout plans, track your progress, and join community challenges.</p>
                    <a href="#" class="btn btn-outline-primary">Explore Fitness</a>
                </div>
            </div>
        </div>

        <!-- Health Insurance Section -->
        <div class="col-md-6">
            <div class="card h-100 shadow-sm border-0">
                <div class="card-body p-5 text-center">
                    <div class="mb-4 text-success">
                        <i class="fas fa-heartbeat fa-4x"></i>
                    </div>
                    <h2 class="h3 mb-3">Health Insurance</h2>
                    <p class="text-muted mb-4">Compare plans, find the best coverage for you and your family, and save money.</p>
                    <a href="{{ route('health-fitness.insurance.index') }}" class="btn btn-success">Compare Plans</a>
                </div>
            </div>
        </div>
    </div>

    <div class="row mt-5">
        <div class="col-12">
            <div class="card bg-light border-0 p-4">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h3 class="h4">Wellness Resources</h3>
                        <p class="mb-0">Check out our latest articles on nutrition, mental health, and preventive care.</p>
                    </div>
                    <div class="col-md-4 text-md-end mt-3 mt-md-0">
                        <a href="{{ route('wellness.hub') }}" class="btn btn-primary">Visit Wellness Hub</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
