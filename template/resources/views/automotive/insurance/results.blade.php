@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Your Insurance Quotes</h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @foreach($quote->quotes_received as $result)
        <div class="bg-white rounded shadow-lg overflow-hidden border-t-4 border-blue-600">
            <div class="p-6">
                <h3 class="text-xl font-bold mb-2">{{ $result['provider'] }}</h3>
                <div class="text-3xl font-bold text-blue-600 mb-1">${{ number_format($result['premium_monthly'], 2) }}<span class="text-sm text-gray-500 font-normal">/mo</span></div>
                <p class="text-sm text-gray-500 mb-4">or ${{ number_format($result['premium_annual'], 2) }} /yr</p>

                <div class="border-t pt-4 mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-gray-600">Excess:</span>
                        <span class="font-semibold">${{ $result['excess'] }}</span>
                    </div>
                    @if(!empty($result['features']))
                    <ul class="text-sm text-gray-600 list-disc list-inside">
                        @foreach($result['features'] as $feature)
                            <li>{{ $feature }}</li>
                        @endforeach
                    </ul>
                    @endif
                </div>

                <button class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold">Select Quote</button>
            </div>
        </div>
        @endforeach
    </div>
</div>
@endsection
