@extends('frontend.layouts.master')

@section('title', 'Compare Plans')

@section('contents')
<div class="container py-5">
    <div class="mb-4">
        <a href="{{ route('health-fitness.insurance.index') }}" class="text-decoration-none"><i class="fas fa-arrow-left me-2"></i> Back to Plans</a>
        <h1 class="h2 mt-2">Plan Comparison</h1>
    </div>

    @if($plans->isEmpty())
        <div class="alert alert-warning">
            No plans selected for comparison. <a href="{{ route('health-fitness.insurance.index') }}">Go back and select plans.</a>
        </div>
    @else
        <div class="table-responsive">
            <table class="table table-bordered text-center align-middle">
                <thead class="table-light">
                    <tr>
                        <th scope="col" class="text-start" style="width: 20%;">Feature</th>
                        @foreach($plans as $plan)
                            <th scope="col" style="width: {{ 80 / $plans->count() }}%;">
                                <div class="py-2">
                                    <h5 class="mb-1">{{ $plan->provider_name }}</h5>
                                    <div class="small text-muted">{{ $plan->plan_name }}</div>
                                </div>
                            </th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th scope="row" class="text-start">Monthly Premium</th>
                        @foreach($plans as $plan)
                            <td class="fw-bold text-primary fs-5">${{ number_format($plan->monthly_premium, 0) }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Deductible</th>
                        @foreach($plans as $plan)
                            <td>${{ number_format($plan->deductible, 0) }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Out-of-Pocket Max</th>
                        @foreach($plans as $plan)
                            <td>${{ number_format($plan->out_of_pocket_max, 0) }}</td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Coverage Type</th>
                        @foreach($plans as $plan)
                            <td><span class="badge bg-secondary">{{ $plan->coverage_type }}</span></td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Rating</th>
                        @foreach($plans as $plan)
                            <td>
                                <span class="text-warning">
                                    {{ $plan->rating }} <i class="fas fa-star"></i>
                                </span>
                            </td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Key Features</th>
                        @foreach($plans as $plan)
                            <td class="text-start">
                                <ul class="list-unstyled mb-0 small">
                                    @foreach($plan->features ?? [] as $feature)
                                        <li class="mb-1"><i class="fas fa-check text-success me-2"></i> {{ $feature }}</li>
                                    @endforeach
                                </ul>
                            </td>
                        @endforeach
                    </tr>
                    <tr>
                        <th scope="row" class="text-start">Action</th>
                        @foreach($plans as $plan)
                            <td>
                                <button class="btn btn-primary btn-sm w-100">Select Plan</button>
                            </td>
                        @endforeach
                    </tr>
                </tbody>
            </table>
        </div>
    @endif
</div>
@endsection
