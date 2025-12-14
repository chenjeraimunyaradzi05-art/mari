@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Your AI Recommendations</h1>

    <!-- Advice Section -->
    <div class="bg-purple-50 border-l-4 border-purple-600 p-6 mb-8 rounded-r">
        <h2 class="text-xl font-bold text-purple-900 mb-2">AI Analysis</h2>
        <p class="text-purple-800">{{ $recommendations['advice'] }}</p>

        @if(!empty($recommendations['rebate_info']))
            <div class="mt-4 pt-4 border-t border-purple-200">
                <h3 class="font-semibold text-purple-900">Financial Incentives</h3>
                <ul class="list-disc list-inside text-purple-800">
                    @foreach($recommendations['rebate_info'] as $info)
                        <li>{{ $info }}</li>
                    @endforeach
                </ul>
            </div>
        @endif
    </div>

    <!-- Powertrain Analysis -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        @foreach($recommendations['powertrain_analysis'] as $type => $analysis)
        <div class="bg-white p-4 rounded shadow border-t-4 {{ $analysis['suitability'] === 'High' ? 'border-green-500' : 'border-gray-300' }}">
            <h3 class="font-bold text-lg capitalize mb-2">{{ $type }}</h3>
            <div class="text-sm mb-2">
                <span class="font-semibold">Suitability:</span>
                <span class="{{ $analysis['suitability'] === 'High' ? 'text-green-600 font-bold' : 'text-gray-600' }}">{{ $analysis['suitability'] }}</span>
            </div>
            <div class="mb-2">
                <span class="font-semibold text-green-700">Pros:</span>
                <ul class="list-disc list-inside text-xs text-gray-600">
                    @foreach($analysis['pros'] as $pro) <li>{{ $pro }}</li> @endforeach
                </ul>
            </div>
            <div>
                <span class="font-semibold text-red-700">Cons:</span>
                <ul class="list-disc list-inside text-xs text-gray-600">
                    @foreach($analysis['cons'] as $con) <li>{{ $con }}</li> @endforeach
                </ul>
            </div>
        </div>
        @endforeach
    </div>

    <!-- Top Pick -->
    @if($recommendations['top_pick'])
    <div class="mb-12">
        <h2 class="text-2xl font-bold mb-4">Top Recommendation</h2>
        <div class="bg-white rounded shadow-lg overflow-hidden flex flex-col md:flex-row">
            <img src="{{ $recommendations['top_pick']->images[0] ?? '/placeholder.jpg' }}" class="w-full md:w-1/2 object-cover h-64 md:h-auto">
            <div class="p-6 flex-1">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-2xl font-bold">{{ $recommendations['top_pick']->title }}</h3>
                        <p class="text-gray-600">{{ $recommendations['top_pick']->make }} {{ $recommendations['top_pick']->model }}</p>
                    </div>
                    <span class="text-2xl font-bold text-blue-600">{{ $recommendations['top_pick']->formatted_price }}</span>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 p-3 rounded">
                        <span class="block text-xs text-gray-500">Powertrain</span>
                        <span class="font-semibold">{{ $recommendations['top_pick']->powertrain_type }}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <span class="block text-xs text-gray-500">Safety</span>
                        <span class="font-semibold">5 Star (Est.)</span>
                    </div>
                </div>

                <div class="mt-6">
                    <a href="{{ route('automotive.show', $recommendations['top_pick']) }}" class="inline-block bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700">View Details</a>
                </div>
            </div>
        </div>
    </div>
    @endif

    <!-- Alternatives -->
    @if(count($recommendations['alternatives']) > 0)
    <div>
        <h2 class="text-2xl font-bold mb-4">Alternatives</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @foreach($recommendations['alternatives'] as $listing)
            <div class="bg-white rounded shadow overflow-hidden">
                <img src="{{ $listing->images[0] ?? '/placeholder.jpg' }}" class="w-full h-40 object-cover">
                <div class="p-4">
                    <h3 class="font-bold">{{ $listing->title }}</h3>
                    <p class="text-blue-600 font-semibold">{{ $listing->formatted_price }}</p>
                    <a href="{{ route('automotive.show', $listing) }}" class="block mt-2 text-sm text-blue-600 hover:underline">View</a>
                </div>
            </div>
            @endforeach
        </div>
    </div>
    @endif
</div>
@endsection
