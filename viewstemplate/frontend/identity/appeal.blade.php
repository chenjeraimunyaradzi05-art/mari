@extends('layouts.app')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card shadow-sm">
                <div class="card-header bg-danger text-white">
                    <h4 class="mb-0">Account Under Review</h4>
                </div>
                <div class="card-body">
                    <p class="lead">
                        Your account has been flagged for review due to our identity verification policies.
                    </p>
                    <p>
                        We are committed to maintaining a safe, women-first environment. If you believe this flag was applied in error, please submit an appeal below explaining your situation.
                    </p>

                    <hr>

                    <form action="{{ route('identity.appeal.store') }}" method="POST">
                        @csrf

                        <div class="mb-3">
                            <label for="appeal_text" class="form-label">Appeal Explanation</label>
                            <textarea name="appeal_text" id="appeal_text" rows="6" class="form-control @error('appeal_text') is-invalid @enderror" placeholder="Please explain why you believe your account should be reinstated..."></textarea>
                            @error('appeal_text')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="d-grid gap-2">
                            <button type="submit" class="btn btn-primary">Submit Appeal</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
