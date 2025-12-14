@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>{{ $filterTitle }}</h1>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item active"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
                <div class="breadcrumb-item">Members</div>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div class="row mb-4">
            <div class="col-lg-3 col-md-6">
                <div class="card card-statistic-1">
                    <div class="card-icon" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%);">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="card-wrap">
                        <div class="card-header">
                            <h4>Total Members</h4>
                        </div>
                        <div class="card-body">
                            {{ $stats['total'] }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6">
                <div class="card card-statistic-1">
                    <div class="card-icon bg-success">
                        <i class="fas fa-video"></i>
                    </div>
                    <div class="card-wrap">
                        <div class="card-header">
                            <h4>With Videos</h4>
                        </div>
                        <div class="card-body">
                            {{ $stats['with_videos'] }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6">
                <div class="card card-statistic-1">
                    <div class="card-icon bg-info">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="card-wrap">
                        <div class="card-header">
                            <h4>Complete Profiles</h4>
                        </div>
                        <div class="card-body">
                            {{ $stats['complete_profiles'] }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6">
                <div class="card card-statistic-1">
                    <div class="card-icon bg-warning">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="card-wrap">
                        <div class="card-header">
                            <h4>Avg Profile Score</h4>
                        </div>
                        <div class="card-body">
                            {{ $stats['avg_score'] }}%
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filters & Search -->
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>Member List</h4>
                        <div class="card-header-form">
                            <form action="{{ route('admin.candidates.index') }}" method="GET">
                                <div class="input-group">
                                    <input type="text" class="form-control" placeholder="Search by name, email, phone"
                                           name="search" value="{{ request('search') }}">
                                    <div class="input-group-btn">
                                        <button type="submit" class="btn btn-primary" style="height: 40px;">
                                            <i class="fas fa-search"></i>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                        <tr>
                                        <th>Member</th>
                                        <th>Contact</th>
                                        <th>Location</th>
                                        <th>Profile Score</th>
                                        <th>Videos</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($candidates as $candidate)
                                        <tr>
                                            <td>
                                                <div class="d-flex align-items-center">
                                                    <div class="mr-2">
                                                        @if($candidate->image)
                                                            <img src="{{ asset($candidate->image) }}"
                                                                 alt="{{ $candidate->full_name }}"
                                                                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;">
                                                        @else
                                                            <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                                                                {{ substr($candidate->full_name ?? 'U', 0, 1) }}
                                                            </div>
                                                        @endif
                                                    </div>
                                                    <div>
                                                        <strong>{{ $candidate->full_name ?? 'N/A' }}</strong>
                                                        <br>
                                                        <small class="text-muted">
                                                            {{ $candidate->title ?? $candidate->profession?->name ?? 'No title' }}
                                                        </small>
                                                        @if($candidate->pronoun)
                                                            <br>
                                                            <small class="badge badge-light">
                                                                {{ $candidate->pronoun->display_name }}
                                                            </small>
                                                        @endif
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div>
                                                    <i class="fas fa-envelope text-muted mr-1"></i>
                                                    <small>{{ $candidate->user?->email ?? $candidate->email ?? 'N/A' }}</small>
                                                </div>
                                                @if($candidate->mobile)
                                                    <div>
                                                        <i class="fas fa-mobile-alt text-muted mr-1"></i>
                                                        <small>{{ $candidate->mobile }}</small>
                                                    </div>
                                                @endif
                                            </td>
                                            <td>
                                                <small>
                                                    @if($candidate->city)
                                                        {{ $candidate->city->name }},
                                                    @endif
                                                    @if($candidate->state)
                                                        {{ $candidate->state->name }}
                                                    @endif
                                                    @if($candidate->country)
                                                        <br>{{ $candidate->country->name }}
                                                    @endif
                                                </small>
                                            </td>
                                            <td>
                                                @php
                                                    $score = $candidate->getComprehensiveProfileScore();
                                                    $color = $score >= 80 ? 'success' : ($score >= 60 ? 'warning' : 'danger');
                                                @endphp
                                                <div class="progress" style="height: 20px;">
                                                    <div class="progress-bar bg-{{ $color }}"
                                                         role="progressbar"
                                                         style="width: {{ $score }}%"
                                                         aria-valuenow="{{ $score }}"
                                                         aria-valuemin="0"
                                                         aria-valuemax="100">
                                                        {{ round($score) }}%
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                @if($candidate->profile_video_url)
                                                    <span class="badge badge-success" title="Professional Video">
                                                        <i class="fas fa-video"></i> Pro
                                                    </span>
                                                @endif
                                                @if($candidate->personality_video_url)
                                                    <span class="badge badge-info" title="Personality Video">
                                                        <i class="fas fa-smile"></i> Per
                                                    </span>
                                                @endif
                                                @if(!$candidate->profile_video_url && !$candidate->personality_video_url)
                                                    <span class="badge badge-light">No videos</span>
                                                @endif
                                            </td>
                                            <td>
                                                @if($candidate->profile_complete)
                                                    <span class="badge badge-success">Complete</span>
                                                @else
                                                    <span class="badge badge-warning">Incomplete</span>
                                                @endif
                                                <br>
                                                @if($candidate->visibility)
                                                    <span class="badge badge-primary mt-1">Visible</span>
                                                @else
                                                    <span class="badge badge-secondary mt-1">Hidden</span>
                                                @endif
                                            </td>
                                            <td>
                                                <a href="{{ route('admin.candidates.show', $candidate->id) }}"
                                                   class="btn btn-sm btn-primary" title="View Details">
                                                    <i class="fas fa-eye"></i>
                                                </a>
                                                <button type="button"
                                                        class="btn btn-sm btn-{{ $candidate->visibility ? 'secondary' : 'success' }} toggle-visibility"
                                                        data-id="{{ $candidate->id }}"
                                                        title="{{ $candidate->visibility ? 'Hide' : 'Show' }} Profile">
                                                    <i class="fas fa-{{ $candidate->visibility ? 'eye-slash' : 'eye' }}"></i>
                                                </button>
                                                <button type="button"
                                                    class="btn btn-sm btn-danger delete-candidate"
                                                    data-id="{{ $candidate->id }}"
                                                    title="Delete Member">
                                                    <i class="fas fa-trash-alt"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="7" class="text-center py-4">
                                                <i class="fas fa-users fa-3x text-muted mb-3"></i>
                                                <p class="text-muted">No members found</p>
                                            </td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card-footer text-right">
                        <nav class="d-inline-block">
                            @if ($candidates->hasPages())
                                {{ $candidates->withQueryString()->links() }}
                            @endif
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection

@push('scripts')
    <script>
        $(document).ready(function() {
            // Toggle visibility
            $('.toggle-visibility').on('click', function() {
                let id = $(this).data('id');
                let button = $(this);

                $.ajax({
                    method: 'POST',
                    url: `/admin/candidates/${id}/toggle-visibility`,
                    data: {_token: "{{ csrf_token() }}"},
                    success: function(response) {
                        if(response.success) {
                            window.location.reload();
                        }
                    },
                    error: function(xhr) {
                        alert('Error toggling visibility');
                    }
                });
            });

            // Delete candidate
            $('.delete-candidate').on('click', function() {
                let id = $(this).data('id');

                Swal.fire({
                    title: 'Are you sure?',
                    text: "This will permanently delete the candidate and their user account!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Yes, delete it!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        $.ajax({
                            method: 'DELETE',
                            url: `/admin/candidates/${id}`,
                            data: {_token: "{{ csrf_token() }}"},
                            success: function(response) {
                                window.location.reload();
                            },
                            error: function(xhr) {
                                alert('Error deleting candidate');
                            }
                        });
                    }
                });
            });
        });
    </script>
@endpush
