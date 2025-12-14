@extends('admin.layouts.master')

@section('contents')
<section class="section">
    <div class="section-header">
        <h1>Admin Dashboard</h1>
        <div class="section-header-breadcrumb">
            <div class="breadcrumb-item active"><a href="#">Dashboard</a></div>
            <div class="breadcrumb-item">Overview</div>
        </div>
    </div>

    @if (canAccess(['dashboard analytics']))
    <div class="row">
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-primary">
                    <i class="fas fa-dollar-sign"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Total Earnings</h4>
                    </div>
                    <div class="card-body">
                        {{ config('settings.site_currency_icon') }} {{ $totalEarnings }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-danger">
                    <i class="fas fa-users"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Total Members</h4>
                    </div>
                    <div class="card-body">
                        {{ $totalCandidates }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-warning">
                    <i class="fas fa-building"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Total Companies</h4>
                    </div>
                    <div class="card-body">
                        {{ $totalCompanies }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-success">
                    <i class="fas fa-briefcase"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Total Jobs</h4>
                    </div>
                    <div class="card-body">
                        {{ $totalJobs }}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-info">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Active Jobs</h4>
                    </div>
                    <div class="card-body">
                        {{ $activeJobs }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-secondary">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Expired Jobs</h4>
                    </div>
                    <div class="card-body">
                        {{ $expiredJobs }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-warning">
                    <i class="fas fa-hourglass-half"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Pending Jobs</h4>
                    </div>
                    <div class="card-body">
                        {{ $pendingJobs }}
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-sm-6 col-12">
            <div class="card card-statistic-1">
                <div class="card-icon bg-danger">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="card-wrap">
                    <div class="card-header">
                        <h4>Avg Identity Resolution</h4>
                    </div>
                    <div class="card-body">
                        {{ $avgResolutionTime }} hrs
                    </div>
                </div>
            </div>
        </div>
    </div>
    @endif

    @if (canAccess(['dashboard pending posts']))
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h4>Pending Jobs Approval</h4>
                    <div class="card-header-action">
                        <a href="{{ route('admin.jobs.index') }}" class="btn btn-primary">View All</a>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                            <thead>
                                <tr>
                                    <th>Job Details</th>
                                    <th>Category & Role</th>
                                    <th>Salary</th>
                                    <th>Deadline</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($jobs as $job)
                                <tr>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            @if($job->company->logo)
                                                <img class="mr-3 rounded" width="40" src="{{ asset($job->company->logo) }}" alt="logo">
                                            @else
                                                <div class="mr-3 rounded bg-light d-flex align-items-center justify-content-center text-secondary border" style="width: 40px; height: 40px;">
                                                    <i class="fas fa-building"></i>
                                                </div>
                                            @endif
                                            <div>
                                                <div class="font-weight-600">{{ $job->title }}</div>
                                                <div class="small text-muted">{{ $job->company->name }} • {{ $job->jobType->name }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="font-weight-600">{{ $job->category?->name }}</div>
                                        <div class="small text-muted">{{ $job->jobRole->name }}</div>
                                    </td>
                                    <td>
                                        @if ($job->salary_mode === 'range')
                                            {{ $job->min_salary }} - {{ $job->max_salary }} {{ config('settings.site_default_currency') }}
                                            <div class="small text-muted">{{ $job->salaryType->name }}</div>
                                        @else
                                            {{ $job->custom_salary }}
                                            <div class="small text-muted">{{ $job->salaryType->name }}</div>
                                        @endif
                                    </td>
                                    <td>{{ formatDate($job->deadline) }}</td>
                                    <td>
                                        <div class="badge badge-warning">Pending</div>
                                    </td>
                                    <td>
                                        <div class="d-flex align-items-center">
                                            <a href="{{ route('admin.jobs.edit', $job->id) }}" class="btn btn-primary btn-sm mr-2" data-toggle="tooltip" title="Edit"><i class="fas fa-edit"></i></a>
                                            <a href="{{ route('admin.jobs.destroy', $job->id) }}" class="btn btn-danger btn-sm delete-item" data-toggle="tooltip" title="Delete"><i class="fas fa-trash-alt"></i></a>
                                        </div>
                                    </td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="6" class="text-center">No pending jobs found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer text-right">
                    @if ($jobs->hasPages())
                        {{ $jobs->withQueryString()->links() }}
                    @endif
                </div>
            </div>
        </div>
    </div>
    @endif
</section>
@endsection

@push('scripts')
<script>
    $(document).ready(function() {
        // Any specific dashboard scripts
    });
</script>
@endpush
