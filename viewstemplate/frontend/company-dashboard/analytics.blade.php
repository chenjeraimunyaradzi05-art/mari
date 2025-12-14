@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="analytics-dashboard">
    <h2 class="font-bold text-2xl mb-4">Advanced Analytics Dashboard</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="card p-4 bg-white rounded shadow">
            <h3 class="font-semibold text-lg mb-2">Profile Views</h3>
            <div id="profileViewsChart"></div>
        </div>
        <div class="card p-4 bg-white rounded shadow">
            <h3 class="font-semibold text-lg mb-2">Engagement</h3>
            <div id="engagementChart"></div>
        </div>
        <div class="card p-4 bg-white rounded shadow">
            <h3 class="font-semibold text-lg mb-2">Job Application Stats</h3>
            <div id="jobStatsChart"></div>
        </div>
        <div class="card p-4 bg-white rounded shadow">
            <h3 class="font-semibold text-lg mb-2">AI Insights & Networking Suggestions</h3>
            <ul>
                @foreach($aiAnalytics as $insight)
                    <li class="mb-2">
                        <span class="font-semibold text-brand-1">&#x1F4A1;</span> {{ $insight }}
                    </li>
                @endforeach
            </ul>
        </div>
    </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
    // Example chart rendering logic
    const profileViewsData = @json($profileViews);
    const engagementData = @json($engagement);
    const jobStatsData = @json($jobStats);
    // ... Chart.js rendering code here ...
</script>
@endsection
