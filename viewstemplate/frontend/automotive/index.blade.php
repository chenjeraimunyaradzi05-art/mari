@extends('frontend.layouts.master')

@section('title', __('Automotive Marketplace'))

@section('contents')
<div class="bg-gray-50 min-h-screen py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-900">Find Your Drive</h1>
            <a href="{{ route('automotive.guide') }}" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                AI Car Guide
            </a>
        </div>

        <!-- Filters -->
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <form action="{{ route('automotive.index') }}" method="GET" class="flex gap-4">
                <select name="make" class="form-select rounded-md border-gray-300">
                    <option value="">All Makes</option>
                    @foreach($makes as $make)
                        <option value="{{ $make }}" {{ request('make') == $make ? 'selected' : '' }}>{{ $make }}</option>
                    @endforeach
                </select>
                <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Filter</button>
            </form>
        </div>

        <!-- Listings Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            @foreach($listings as $listing)
                <a href="{{ route('automotive.show', $listing) }}" class="group block bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
                    <div class="aspect-w-16 aspect-h-9 bg-gray-200">
                        @if($listing->images && count($listing->images) > 0)
                            <img src="{{ $listing->images[0] }}" alt="{{ $listing->title }}" class="object-cover w-full h-48">
                        @else
                            <div class="flex items-center justify-center h-48 text-gray-400">No Image</div>
                        @endif
                    </div>
                    <div class="p-4">
                        <h3 class="text-lg font-medium text-gray-900 group-hover:text-indigo-600">{{ $listing->title }}</h3>
                        <p class="text-sm text-gray-500">{{ $listing->odometer_km }} km • {{ $listing->transmission }}</p>
                        <div class="mt-2 flex justify-between items-center">
                            <span class="text-xl font-bold text-gray-900">{{ $listing->formatted_price }}</span>
                            <span class="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1">{{ $listing->dealer->name }}</span>
                        </div>
                    </div>
                </a>
            @endforeach
        </div>

        <div class="mt-6">
            {{ $listings->links() }}
        </div>
    </div>
</div>
@endsection
