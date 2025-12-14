@extends('frontend.layouts.master')

@section('title', 'Register Agency')

@section('contents')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="text-center mb-5">
                <h1 class="mb-3">Register Your Agency</h1>
                <p class="lead text-muted">Join the Athena Public Sector network to connect with top talent and showcase your initiatives.</p>
            </div>

            <div class="card shadow-sm">
                <div class="card-body p-5">
                    <form action="{{ route('public-sector.agency.store') }}" method="POST">
                        @csrf

                        <div class="mb-4">
                            <label for="name" class="form-label">Agency Name</label>
                            <input type="text" class="form-control @error('name') is-invalid @enderror" id="name" name="name" value="{{ old('name') }}" required>
                            @error('name')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="mb-4">
                            <label for="category" class="form-label">Agency Type</label>
                            <select class="form-select @error('category') is-invalid @enderror" id="category" name="category" required>
                                <option value="">Select Type...</option>
                                <option value="federal" {{ old('category') == 'federal' ? 'selected' : '' }}>Federal Government</option>
                                <option value="state" {{ old('category') == 'state' ? 'selected' : '' }}>State Government</option>
                                <option value="local" {{ old('category') == 'local' ? 'selected' : '' }}>Local Council / Municipality</option>
                                <option value="other" {{ old('category') == 'other' ? 'selected' : '' }}>Other Public Sector Entity</option>
                            </select>
                            @error('category')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="mb-4">
                            <label for="hq_city" class="form-label">Headquarters City</label>
                            <input type="text" class="form-control @error('hq_city') is-invalid @enderror" id="hq_city" name="hq_city" value="{{ old('hq_city') }}">
                            @error('hq_city')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="mb-4">
                            <label for="contact_email" class="form-label">Contact Email</label>
                            <input type="email" class="form-control @error('contact_email') is-invalid @enderror" id="contact_email" name="contact_email" value="{{ old('contact_email') }}">
                            @error('contact_email')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="mb-4">
                            <label for="summary" class="form-label">Brief Summary</label>
                            <textarea class="form-control @error('summary') is-invalid @enderror" id="summary" name="summary" rows="3">{{ old('summary') }}</textarea>
                            <div class="form-text">A short description of your agency's mission.</div>
                            @error('summary')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary btn-lg">Create Agency Profile</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
