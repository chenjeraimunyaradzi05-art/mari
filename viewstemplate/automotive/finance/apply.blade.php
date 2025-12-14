@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-2">Apply for Finance</h1>
    <p class="text-gray-600 mb-6">For: {{ $listing->title }} (${{ number_format($listing->price_cents / 100) }})</p>

    <form action="{{ route('automotive.finance.store', $listing) }}" method="POST" class="space-y-6 bg-white p-6 rounded shadow">
        @csrf

        <div>
            <label class="block font-medium mb-1">Loan Amount ($)</label>
            <input type="number" name="loan_amount" value="{{ $listing->price_cents / 100 }}" class="w-full border-gray-300 rounded">
        </div>

        <div>
            <label class="block font-medium mb-1">Loan Term (Months)</label>
            <select name="term_months" class="w-full border-gray-300 rounded">
                <option value="36">36 Months (3 Years)</option>
                <option value="48">48 Months (4 Years)</option>
                <option value="60" selected>60 Months (5 Years)</option>
                <option value="84">84 Months (7 Years)</option>
            </select>
        </div>

        <div>
            <label class="block font-medium mb-1">Annual Income ($)</label>
            <input type="number" name="annual_income" class="w-full border-gray-300 rounded" placeholder="e.g. 85000">
        </div>

        <div>
            <label class="block font-medium mb-1">Employment Status</label>
            <select name="employment_status" class="w-full border-gray-300 rounded">
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="casual">Casual</option>
                <option value="self_employed">Self Employed</option>
            </select>
        </div>

        <button type="submit" class="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700">Submit Application</button>
    </form>
</div>
@endsection
