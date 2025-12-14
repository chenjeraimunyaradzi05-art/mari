@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-2">Get an Insurance Quote</h1>
    <p class="text-gray-600 mb-6">For: {{ $listing->title }}</p>

    <form action="{{ route('automotive.insurance.store', $listing) }}" method="POST" class="space-y-6 bg-white p-6 rounded shadow">
        @csrf

        <div>
            <label class="block font-medium mb-1">Driver Age Range</label>
            <select name="driver_age_range" class="w-full border-gray-300 rounded">
                <option value="under_25">Under 25</option>
                <option value="25_30">25 - 30</option>
                <option value="31_40">31 - 40</option>
                <option value="41_50">41 - 50</option>
                <option value="50_plus">50+</option>
            </select>
        </div>

        <div>
            <label class="block font-medium mb-1">Parking Location</label>
            <select name="parking_location" class="w-full border-gray-300 rounded">
                <option value="garage">Locked Garage</option>
                <option value="driveway">Driveway</option>
                <option value="street">Street</option>
            </select>
        </div>

        <div>
            <label class="block font-medium mb-1">Usage Type</label>
            <select name="usage_type" class="w-full border-gray-300 rounded">
                <option value="private">Private Use</option>
                <option value="business">Business Use</option>
                <option value="rideshare">Rideshare</option>
            </select>
        </div>

        <div>
            <label class="block font-medium mb-1">Estimated Annual KM</label>
            <select name="estimated_annual_km" class="w-full border-gray-300 rounded">
                <option value="5000">Up to 5,000 km</option>
                <option value="10000">Up to 10,000 km</option>
                <option value="15000">Up to 15,000 km</option>
                <option value="20000">Up to 20,000 km</option>
                <option value="25000">25,000 km +</option>
            </select>
        </div>

        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700">Get Quotes</button>
    </form>
</div>
@endsection
