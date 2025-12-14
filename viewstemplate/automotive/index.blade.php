@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Automotive Marketplace</h1>

    <!-- Filters -->
    <div class="bg-white p-4 rounded shadow mb-8">
        <form action="{{ route('automotive.index') }}" method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select name="make" class="form-select rounded">
                <option value="">All Makes</option>
                <!-- Populate dynamically -->
            </select>
            <select name="type" class="form-select rounded">
                <option value="">All Types</option>
                <option value="SUV">SUV</option>
                <option value="Sedan">Sedan</option>
                <option value="Electric">Electric</option>
            </select>
            <label class="flex items-center space-x-2">
                <input type="checkbox" name="certified_pre_owned" value="1" {{ request('certified_pre_owned') ? 'checked' : '' }}>
                <span>Certified Pre-Owned</span>
            </label>
            <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Filter</button>
        </form>
    </div>

    <!-- Listings -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @foreach($listings as $listing)
        <div class="bg-white rounded shadow overflow-hidden">
            <img src="{{ $listing->images[0] ?? '/placeholder.jpg' }}" alt="{{ $listing->title }}" class="w-full h-48 object-cover">
            <div class="p-4">
                <h3 class="text-xl font-semibold">{{ $listing->title }}</h3>
                <p class="text-gray-600">{{ $listing->formatted_price }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                    @if($listing->is_certified_pre_owned)
                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Certified</span>
                    @endif
                    @if($listing->dealer->offers_warranty)
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Warranty</span>
                    @endif
                </div>
                <a href="{{ route('automotive.show', $listing) }}" class="block mt-4 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded">View Details</a>
            </div>
        </div>
        @endforeach
    </div>

    <div class="mt-8">
        {{ $listings->links() }}
    </div>
</div>
@endsection
