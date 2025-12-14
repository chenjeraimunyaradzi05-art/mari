@extends('frontend.layouts.master')
@section('contents')
<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">Company Analytics Dashboard</h2>
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card shadow-sm" style="border-radius: 15px;">
                    <div class="card-body">
                        <h5 style="color:#8B5CF6;">Profile Views</h5>
                        <p class="display-6" style="color:#E91E8C; font-weight:bold;">{{ $profileViews }}</p>
                        <small class="text-muted">Total views this month</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm" style="border-radius: 15px;">
                    <div class="card-body">
                        <h5 style="color:#8B5CF6;">Jobs Posted</h5>
                        <p class="display-6" style="color:#E91E8C; font-weight:bold;">{{ $jobsPosted }}</p>
                        <small class="text-muted">Jobs posted this month</small>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card shadow-sm" style="border-radius: 15px;">
                    <div class="card-body">
                        <h5 style="color:#8B5CF6;">Applications Received</h5>
                        <p class="display-6" style="color:#E91E8C; font-weight:bold;">{{ $applicationsReceived }}</p>
                        <small class="text-muted">Applications received this month</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card shadow-sm" style="border-radius: 15px;">
                    <div class="card-body">
                        <h5 style="color:#8B5CF6;">Group Engagement</h5>
                        <p class="display-6" style="color:#E91E8C; font-weight:bold;">{{ $groupEngagement }}</p>
                        <small class="text-muted">Posts & comments in company groups</small>
                    </div>
                </div>
            </div>
        </div>
        <!-- AI Insights -->
        <div class="card shadow-sm mb-4" style="border-radius: 15px;">
            <div class="card-body">
                <h4 class="mb-3" style="color: #E91E8C;">AI-Powered Insights</h4>
                <ul class="list-unstyled">
                    <li><b>Job Posting Optimization:</b> {{ $aiInsights['job_posting_optimization'] ?? 'N/A' }}</li>
                    <li><b>Talent Recommendations:</b> {{ $aiInsights['talent_recommendations'] ?? 'N/A' }}</li>
                    <li><b>Application Quality:</b> {{ $aiInsights['application_quality'] ?? 'N/A' }}</li>
                    <li><b>Engagement Tips:</b> {{ $aiInsights['engagement_tips'] ?? 'N/A' }}</li>
                </ul>
            </div>
        </div>
    </div>
</section>
@endsection
