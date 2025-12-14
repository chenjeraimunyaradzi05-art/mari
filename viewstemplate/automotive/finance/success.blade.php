@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8 max-w-2xl text-center">
    <div class="bg-green-100 text-green-800 p-8 rounded-lg shadow">
        <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        <h1 class="text-3xl font-bold mb-2">Application Received!</h1>
        <p class="text-xl mb-6">Reference: #{{ $application->id }}</p>

        <p class="mb-4">We have sent your details to our finance partners. You should receive a response within 24 hours.</p>

        <div class="bg-white p-4 rounded text-left mx-auto max-w-md">
            <h3 class="font-bold mb-2">Next Steps:</h3>
            <ul class="list-disc list-inside text-gray-700">
                <li>Check your email for confirmation.</li>
                <li>Prepare your proof of income (payslips).</li>
                <li>A broker may call you to verify details.</li>
            </ul>
        </div>

        <a href="{{ route('automotive.index') }}" class="inline-block mt-8 bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700">Back to Marketplace</a>
    </div>
</div>
@endsection
