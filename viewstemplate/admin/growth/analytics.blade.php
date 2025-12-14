@extends('admin.layouts.master')

@section('content')
<div class="section-body">
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h4>Growth Analytics</h4>
                </div>
                <div class="card-body">

                    <!-- Referral Stats -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card card-statistic-1">
                                <div class="card-icon bg-primary">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="card-wrap">
                                    <div class="card-header">
                                        <h4>Total Invites</h4>
                                    </div>
                                    <div class="card-body">
                                        {{ $referralStats['total_invites'] }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card card-statistic-1">
                                <div class="card-icon bg-success">
                                    <i class="fas fa-check"></i>
                                </div>
                                <div class="card-wrap">
                                    <div class="card-header">
                                        <h4>Accepted</h4>
                                    </div>
                                    <div class="card-body">
                                        {{ $referralStats['accepted_invites'] }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card card-statistic-1">
                                <div class="card-icon bg-warning">
                                    <i class="fas fa-gift"></i>
                                </div>
                                <div class="card-wrap">
                                    <div class="card-header">
                                        <h4>Rewarded</h4>
                                    </div>
                                    <div class="card-body">
                                        {{ $referralStats['rewarded_invites'] }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card card-statistic-1">
                                <div class="card-icon bg-info">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="card-wrap">
                                    <div class="card-header">
                                        <h4>Pending</h4>
                                    </div>
                                    <div class="card-body">
                                        {{ $referralStats['pending_invites'] }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Attribution Stats -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h4>Top Traffic Sources</h4>
                                </div>
                                <div class="card-body">
                                    <table class="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>Source</th>
                                                <th>Visits</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach($attributionStats as $stat)
                                            <tr>
                                                <td>{{ $stat->utm_source ?: 'Direct / None' }}</td>
                                                <td>{{ $stat->total }}</td>
                                            </tr>
                                            @endforeach
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h4>Top Converting Sources</h4>
                                </div>
                                <div class="card-body">
                                    <table class="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>Source</th>
                                                <th>Conversions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach($conversionsBySource as $stat)
                                            <tr>
                                                <td>{{ $stat->utm_source ?: 'Direct / None' }}</td>
                                                <td>{{ $stat->total }}</td>
                                            </tr>
                                            @endforeach
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Experiments -->
                    <div class="row mt-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h4>Active Experiments</h4>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-striped">
                                            <thead>
                                                <tr>
                                                    <th>Experiment</th>
                                                    <th>Status</th>
                                                    <th>Participants</th>
                                                    <th>Conversions</th>
                                                    <th>Started At</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                @foreach($experiments as $experiment)
                                                <tr>
                                                    <td>
                                                        <strong>{{ $experiment->name }}</strong>
                                                        <p class="text-muted mb-0">{{ $experiment->description }}</p>
                                                    </td>
                                                    <td>
                                                        <span class="badge badge-{{ $experiment->status === 'active' ? 'success' : 'secondary' }}">
                                                            {{ ucfirst($experiment->status) }}
                                                        </span>
                                                    </td>
                                                    <td>{{ $experiment->assignments_count }}</td>
                                                    <td>{{ $experiment->conversions_count }}</td>
                                                    <td>{{ $experiment->started_at->format('Y-m-d') }}</td>
                                                </tr>
                                                @endforeach
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</div>
@endsection
