@extends('frontend.layouts.master')

@section('title', 'Create Program - Agency Dashboard')

@section('contents')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Create New Program</h1>
                <a href="{{ route('public-sector.agency.dashboard') }}" class="btn btn-outline-secondary">Back to Dashboard</a>
            </div>

            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <form action="{{ route('public-sector.agency.programs.store') }}" method="POST">
                        @csrf

                        <div class="mb-3">
                            <label for="title" class="form-label">Program Title</label>
                            <input type="text" class="form-control @error('title') is-invalid @enderror" id="title" name="title" value="{{ old('title') }}" required>
                            @error('title')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="program_type" class="form-label">Program Type</label>
                                <select class="form-select @error('program_type') is-invalid @enderror" id="program_type" name="program_type" required>
                                    <option value="">Select Type...</option>
                                    <option value="accelerator" {{ old('program_type') == 'accelerator' ? 'selected' : '' }}>Accelerator</option>
                                    <option value="incubator" {{ old('program_type') == 'incubator' ? 'selected' : '' }}>Incubator</option>
                                    <option value="grant" {{ old('program_type') == 'grant' ? 'selected' : '' }}>Grant Program</option>
                                    <option value="fellowship" {{ old('program_type') == 'fellowship' ? 'selected' : '' }}>Fellowship</option>
                                    <option value="training" {{ old('program_type') == 'training' ? 'selected' : '' }}>Training / Workshop</option>
                                </select>
                                @error('program_type')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label for="delivery_mode" class="form-label">Delivery Mode</label>
                                <select class="form-select @error('delivery_mode') is-invalid @enderror" id="delivery_mode" name="delivery_mode" required>
                                    <option value="">Select Mode...</option>
                                    <option value="online" {{ old('delivery_mode') == 'online' ? 'selected' : '' }}>Online</option>
                                    <option value="hybrid" {{ old('delivery_mode') == 'hybrid' ? 'selected' : '' }}>Hybrid</option>
                                    <option value="onsite" {{ old('delivery_mode') == 'onsite' ? 'selected' : '' }}>Onsite</option>
                                </select>
                                @error('delivery_mode')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="summary" class="form-label">Summary</label>
                            <textarea class="form-control @error('summary') is-invalid @enderror" id="summary" name="summary" rows="3" required>{{ old('summary') }}</textarea>
                            <div class="form-text">A brief overview of the program.</div>
                            @error('summary')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="mb-3">
                            <label for="eligibility" class="form-label">Eligibility Criteria</label>
                            <textarea class="form-control @error('eligibility') is-invalid @enderror" id="eligibility" name="eligibility" rows="3">{{ old('eligibility') }}</textarea>
                            @error('eligibility')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="next_intake_date" class="form-label">Next Intake Date</label>
                                <input type="date" class="form-control @error('next_intake_date') is-invalid @enderror" id="next_intake_date" name="next_intake_date" value="{{ old('next_intake_date') }}">
                                @error('next_intake_date')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                            <div class="col-md-6">
                                <label for="application_url" class="form-label">Application URL</label>
                                <input type="url" class="form-control @error('application_url') is-invalid @enderror" id="application_url" name="application_url" value="{{ old('application_url') }}" placeholder="https://...">
                                @error('application_url')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>

                        <div class="mb-4">
                            <label for="tags" class="form-label">Tags (comma separated)</label>
                            <input type="text" class="form-control @error('tags') is-invalid @enderror" id="tags" name="tags" value="{{ old('tags') }}" placeholder="innovation, funding, mentorship">
                            @error('tags')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary">Create Program</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
