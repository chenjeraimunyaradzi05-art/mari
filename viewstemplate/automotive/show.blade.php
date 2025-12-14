@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Images -->
        <div>
            <img src="{{ $listing->images[0] ?? '/placeholder.jpg' }}" alt="{{ $listing->title }}" class="w-full rounded shadow-lg">
            <div class="grid grid-cols-4 gap-2 mt-4">
                @foreach(array_slice($listing->images ?? [], 1) as $image)
                    <img src="{{ $image }}" class="w-full h-24 object-cover rounded cursor-pointer">
                @endforeach
            </div>
        </div>

        <!-- Details -->
        <div>
            <h1 class="text-3xl font-bold">{{ $listing->title }}</h1>
            <p class="text-2xl text-blue-600 font-bold mt-2">{{ $listing->formatted_price }}</p>

            <div class="mt-6 space-y-4">
                <div class="bg-gray-50 p-4 rounded">
                    <h3 class="font-semibold mb-2">Vehicle Details</h3>
                    <ul class="grid grid-cols-2 gap-2 text-sm">
                        <li><span class="text-gray-600">Make:</span> {{ $listing->make }}</li>
                        <li><span class="text-gray-600">Model:</span> {{ $listing->model }}</li>
                        <li><span class="text-gray-600">Year:</span> {{ $listing->year }}</li>
                        <li><span class="text-gray-600">Odometer:</span> {{ number_format($listing->odometer_km) }} km</li>
                        <li><span class="text-gray-600">Powertrain:</span> {{ $listing->powertrain_type }}</li>
                        <li><span class="text-gray-600">Transmission:</span> {{ $listing->transmission }}</li>
                    </ul>
                </div>

                @if($listing->is_certified_pre_owned)
                <div class="bg-green-50 border border-green-200 p-4 rounded">
                    <h3 class="font-semibold text-green-800 flex items-center">
                        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                        Certified Pre-Owned
                    </h3>
                    <p class="text-sm text-green-700 mt-1">Inspected and approved by {{ $listing->dealer->name }}. Includes extended warranty.</p>
                </div>
                @endif

                @if($listing->rebate_eligible)
                <div class="bg-blue-50 border border-blue-200 p-4 rounded">
                    <h3 class="font-semibold text-blue-800">Eligible for Rebate</h3>
                    <p class="text-sm text-blue-700 mt-1">Potential savings of ${{ number_format($listing->rebate_amount, 2) }}.</p>
                </div>
                @endif

                <!-- Dealer Info -->
                <div class="border-t pt-4">
                    <h3 class="font-semibold">Sold by {{ $listing->dealer->name }}</h3>
                    @if($listing->dealer->is_dealer_approved)
                        <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Dealer Approved</span>
                    @endif
                    <p class="text-sm text-gray-600 mt-1">{{ $listing->dealer->address }}</p>
                </div>

                <!-- Actions -->
                <div class="flex space-x-4 mt-6">
                    <button class="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700 font-semibold">Contact Dealer</button>
                    <button class="flex-1 bg-green-600 text-white py-3 rounded hover:bg-green-700 font-semibold">Apply for Finance</button>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
