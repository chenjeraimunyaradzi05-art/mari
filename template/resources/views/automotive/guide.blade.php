@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-2">AI Car Guide</h1>
    <p class="text-gray-600 mb-8">Tell us about your needs, and our AI will find the perfect car for you.</p>

    <form action="{{ route('automotive.guide') }}" method="POST" class="space-y-6 bg-white p-6 rounded shadow">
        @csrf

        <div>
            <label class="block font-medium mb-1">What is your budget?</label>
            <input type="number" name="budget" class="w-full border-gray-300 rounded" placeholder="e.g. 30000">
        </div>

        <div>
            <label class="block font-medium mb-1">Primary Usage</label>
            <select name="usage" class="w-full border-gray-300 rounded">
                <option value="commute">Daily Commute</option>
                <option value="family">Family Hauler</option>
                <option value="adventure">Adventure / Off-road</option>
                <option value="city">City Driving</option>
            </select>
        </div>

        <div class="flex items-center space-x-2">
            <input type="checkbox" name="has_kids" value="1" id="has_kids" class="rounded border-gray-300">
            <label for="has_kids" class="font-medium">I have children (Prioritize safety & space)</label>
        </div>

        <div>
            <label class="block font-medium mb-1">Average Daily Distance (km)</label>
            <input type="number" name="average_distance_km" class="w-full border-gray-300 rounded" placeholder="e.g. 40">
        </div>

        <div>
            <label class="block font-medium mb-1">Preferred Powertrain</label>
            <select name="preferred_powertrain" class="w-full border-gray-300 rounded">
                <option value="any">No Preference (AI Decide)</option>
                <option value="Electric">Electric (EV)</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Gas">Gas / Petrol</option>
            </select>
        </div>

        <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded font-bold hover:bg-purple-700">Find My Car</button>
    </form>
</div>
@endsection
