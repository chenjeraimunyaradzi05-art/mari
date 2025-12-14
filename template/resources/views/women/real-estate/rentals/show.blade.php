@extends('women.real-estate.layouts.console')

@section('console-content')
    <div class="space-y-6">
        <a href="{{ route('women.real-estate.rentals.index') }}" class="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Rentals
        </a>

        <div class="rounded-lg border border-gray-200 bg-white p-8">
            <div class="text-center py-12">
                <h1 class="text-3xl font-bold text-gray-900">Rental Property Details</h1>
                <p class="mt-2 text-gray-600">Property details are loading...</p>
                <div class="mt-6 inline-block">
                    <div class="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
                </div>
            </div>
        </div>
    </div>
@endsection
