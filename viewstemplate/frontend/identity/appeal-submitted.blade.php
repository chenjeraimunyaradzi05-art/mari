@extends('layouts.app')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card shadow-sm">
                <div class="card-header bg-success text-white">
                    <h4 class="mb-0">Appeal Submitted</h4>
                </div>
                <div class="card-body text-center">
                    <div class="mb-4">
                        <i class="fas fa-check-circle fa-4x text-success"></i>
                    </div>
                    <h3>Thank you for your submission</h3>
                    <p class="lead">
                        We have received your appeal and our team will review it shortly.
                    </p>
                    <p class="text-muted">
                        Submitted on: {{ $flag->appealed_at->format('F j, Y, g:i a') }}
                    </p>
                    <hr>
                    <p>
                        You will be notified via email once a decision has been made.
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
