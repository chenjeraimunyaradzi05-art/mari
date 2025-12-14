@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Trades Dashboard</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Active Apprenticeships -->
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Active Apprenticeships</h2>
            @if($activeApprenticeships->count() > 0)
                <ul class="divide-y divide-gray-200">
                    @foreach($activeApprenticeships as $program)
                        <li class="py-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-lg font-medium text-gray-900">{{ $program->title }}</h3>
                                    <p class="text-sm text-gray-500">{{ $program->provider_name }}</p>
                                </div>
                                <a href="{{ route('trades.apprenticeships.show', $program) }}" class="text-indigo-600 hover:text-indigo-900">View</a>
                            </div>
                        </li>
                    @endforeach
                </ul>
            @else
                <p class="text-gray-500">No active apprenticeships found.</p>
            @endif
            <div class="mt-4">
                <a href="{{ route('trades.apprenticeships.index') }}" class="text-indigo-600 hover:text-indigo-900 font-medium">Browse all programs &rarr;</a>
            </div>
        </div>

        <!-- Recommended Jobs -->
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Recommended Jobs</h2>
            @if($recommendedJobs->count() > 0)
                <ul class="divide-y divide-gray-200">
                    @foreach($recommendedJobs as $job)
                        <li class="py-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-lg font-medium text-gray-900">{{ $job->title }}</h3>
                                    <p class="text-sm text-gray-500">{{ $job->company_name }}</p>
                                </div>
                                <a href="{{ route('jobs.show', $job) }}" class="text-indigo-600 hover:text-indigo-900">View</a>
                            </div>
                        </li>
                    @endforeach
                </ul>
            @else
                <p class="text-gray-500">No recommended jobs found.</p>
            @endif
        </div>
    </div>

    <!-- Quick Actions -->
    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-blue-50 p-6 rounded-lg">
            <h3 class="font-semibold text-blue-900">Find a Mentor</h3>
            <p class="text-sm text-blue-700 mt-2">Connect with experienced tradeswomen.</p>
            <button class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Search Mentors</button>
        </div>
        <div class="bg-green-50 p-6 rounded-lg">
            <h3 class="font-semibold text-green-900">Upskill</h3>
            <p class="text-sm text-green-700 mt-2">Find courses and certifications.</p>
            <button class="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Browse Courses</button>
        </div>
        <div class="bg-purple-50 p-6 rounded-lg">
            <h3 class="font-semibold text-purple-900">Tools & Gear</h3>
            <p class="text-sm text-purple-700 mt-2">Access discounts on trade equipment.</p>
            <button class="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">View Offers</button>
        </div>
    </div>
</div>
@endsection
