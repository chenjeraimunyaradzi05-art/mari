@extends('frontend.layouts.master')

@section('title', __('Impact Index'))

@section('contents')
    <div class="bg-gray-50 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h2 class="text-base font-semibold text-indigo-600 tracking-wide uppercase">Transparency</h2>
                <p class="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                    Athena Impact Index
                </p>
                <p class="max-w-xl mt-5 mx-auto text-xl text-gray-500">
                    Real-time metrics on how we are empowering women, securing jobs, and building financial resilience.
                </p>
            </div>

            <div class="mt-16">
                <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    @foreach ($metrics as $metric)
                        <div class="pt-6">
                            <div class="flow-root bg-white rounded-lg px-6 pb-8">
                                <div class="-mt-6">
                                    <div>
                                        <span class="inline-flex items-center justify-center p-3 bg-indigo-500 rounded-md shadow-lg">
                                            <!-- Heroicon name: outline/chart-bar -->
                                            <svg class="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </span>
                                    </div>
                                    <h3 class="mt-8 text-lg font-medium text-gray-900 tracking-tight">{{ $metric->label }}</h3>
                                    <p class="mt-5 text-base text-gray-500">
                                        {{ $metric->description }}
                                    </p>
                                    <div class="mt-4 flex items-baseline text-3xl font-extrabold text-indigo-600">
                                        {{ number_format($metric->value) }} {{ $metric->unit }}
                                        @if($metric->change)
                                            <span class="ml-2 text-sm font-medium {{ $metric->change > 0 ? 'text-green-600' : 'text-red-600' }}">
                                                {{ $metric->change > 0 ? '+' : '' }}{{ $metric->change }}%
                                            </span>
                                        @endif
                                    </div>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>

            <div class="mt-12 text-center">
                <p class="text-sm text-gray-500">
                    Last updated: {{ $lastUpdated->format('F j, Y g:i A') }}
                </p>
                <div class="mt-6">
                    <a href="#" class="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        Download Full Report (PDF)
                    </a>
                </div>
            </div>
        </div>
    </div>
@endsection
