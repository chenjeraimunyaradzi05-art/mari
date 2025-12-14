@extends('frontend.layouts.master')

@section('title', 'Post Opportunity')

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/public-sector.css') }}">
@endpush

@section('contents')
<div class="civic-shell">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="d-flex align-items-center mb-4">
                    <a href="{{ route('public-sector.agency.dashboard') }}" class="text-decoration-none me-3"><i class="fas fa-arrow-left"></i> Back</a>
                    <h1 class="h3 mb-0">Post New Opportunity</h1>
                </div>

                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <form action="{{ route('public-sector.agency.opportunities.store') }}" method="POST">
                            @csrf

                            <div class="mb-3">
                                <label for="title" class="form-label">Opportunity Title</label>
                                <input type="text" class="form-control" id="title" name="title" required placeholder="e.g. Senior Policy Advisor">
                            </div>

                            <div class="mb-3">
                                <label for="summary" class="form-label">Summary</label>
                                <textarea class="form-control" id="summary" name="summary" rows="2" required placeholder="Brief overview for listing cards..."></textarea>
                                <div class="form-text">Keep it punchy. This appears in search results.</div>
                            </div>

                            <div class="mb-3">
                                <label for="description" class="form-label">Full Description</label>
                                <textarea class="form-control" id="description" name="description" rows="6" required placeholder="Detailed role description, responsibilities, and requirements..."></textarea>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="location" class="form-label">Location</label>
                                    <input type="text" class="form-control" id="location" name="location" required placeholder="e.g. Canberra, ACT">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="work_arrangement" class="form-label">Work Arrangement</label>
                                    <select class="form-select" id="work_arrangement" name="work_arrangement" required>
                                        <option value="hybrid">Hybrid</option>
                                        <option value="remote">Remote</option>
                                        <option value="onsite">On-site</option>
                                    </select>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="role_level" class="form-label">Role Level</label>
                                    <input type="text" class="form-control" id="role_level" name="role_level" required placeholder="e.g. Executive Level 1">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="closes_at" class="form-label">Closing Date</label>
                                    <input type="date" class="form-control" id="closes_at" name="closes_at">
                                </div>
                            </div>

                            <div class="mb-4">
                                <label for="tags" class="form-label">Tags (comma separated)</label>
                                <input type="text" class="form-control" id="tags" name="tags" placeholder="policy, digital, leadership">
                            </div>

                            <div class="d-flex justify-content-end gap-2">
                                <a href="{{ route('public-sector.agency.dashboard') }}" class="btn btn-outline-secondary">Cancel</a>
                                <button type="submit" class="btn btn-primary">Post Opportunity</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
