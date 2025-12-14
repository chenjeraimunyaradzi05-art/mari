@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Applied Jobs</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="index.html">Home</a></li>
                            <li>Applied Jobs</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">
                @include('frontend.candidate-dashboard.sidebar')
                <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                    <div class="mb-3">
                        <h4>Applied Jobs ({{ count($appliedJobs) }})</h4>

                    </div>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Salary</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th style="width: 15%">Action</th>
                            </tr>
                        </thead>
                        <tbody class="experience-tbody">
                            @forelse ($appliedJobs as $appliedJob)
                                @php
                                    $job = $appliedJob->job;
                                    $company = $job?->company;
                                @endphp
                                <tr>
                                    <td>
                                        <div class="d-flex ">
                                            @if ($company?->logo)
                                                <img style="width: 50px; height: 50px; object-fit:cover;"
                                                    src="{{ asset($company->logo) }}" alt="{{ $company->name ?? 'Company logo' }}">
                                            @else
                                                <div class="d-flex align-items-center justify-content-center bg-light rounded"
                                                    style="width: 50px; height: 50px;">
                                                    <span class="text-muted">—</span>
                                                </div>
                                            @endif
                                            <div style="padding-left: 15px">
                                                <h6>{{ $company->name ?? 'Company unavailable' }}</h6>
                                                <b>{{ $company?->companyCountry?->name ?? '—' }}</b>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        @if ($job)
                                            @if ($job->salary_mode === 'range')
                                                {{ $job->min_salary }} - {{ $job->max_salary }}
                                                {{ config('settings.site_default_currency') }}
                                            @else
                                                {{ $job->custom_salary ?? '—' }}
                                            @endif
                                        @else
                                            <span class="text-muted">—</span>
                                        @endif
                                    </td>
                                    <td>{{ formatDate($appliedJob->created_at) }}</td>
                                    <td>
                                        @if ($job?->deadline && $job->deadline < date('Y-m-d'))
                                            <span class="badge bg-danger">Expired</span>
                                        @elseif($job)
                                            <span class="badge bg-success">Active</span>
                                        @else
                                            <span class="badge bg-secondary">Removed</span>
                                        @endif
                                    </td>
                                    <td>
                                        @if ($job?->deadline && $job->deadline < date('Y-m-d'))
                                            <a href="javascript:;"
                                                class="btn-sm btn btn-secondary" ><i class="fas fa-eye"
                                                    aria-hidden="true"></i></a>
                                        @elseif($job?->slug)
                                            <a href="{{ route('jobs.show', $job->slug) }}"
                                                class="btn-sm btn btn-primary" ><i class="fas fa-eye"
                                                    aria-hidden="true"></i></a>
                                        @else
                                            <span class="text-muted">—</span>
                                        @endif
                                    </td>

                                </tr>
                            @empty
                            <tr>
                                <td colspan="5" class="text-center">No data found!</td>
                            </tr>
                            @endforelse


                        </tbody>
                    </table>

                </div>
            </div>
        </div>
    </section>
@endsection
