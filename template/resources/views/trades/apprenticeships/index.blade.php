@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Apprenticeship Programs</h1>
        <!-- Filter/Search could go here -->
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @forelse($programs as $program)
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <div class="p-6">
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">{{ $program->title }}</h2>
                    <p class="text-sm text-gray-600 mb-4">{{ $program->provider_name }}</p>
                    <p class="text-gray-700 mb-4 line-clamp-3">{{ $program->description }}</p>

                    <div class="flex items-center justify-between mt-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {{ $program->duration_months }} Months
                        </span>
                        <a href="{{ route('trades.apprenticeships.show', $program) }}" class="text-indigo-600 hover:text-indigo-900 font-medium">
                            View Details &rarr;
                        </a>
                    </div>
                </div>
            </div>
        @empty
            <div class="col-span-full text-center py-12">
                <p class="text-gray-500 text-lg">No apprenticeship programs found.</p>
            </div>
        @endforelse
    </div>

    <div class="mt-6">
        {{ $programs->links() }}
    </div>
</div>
@endsection
