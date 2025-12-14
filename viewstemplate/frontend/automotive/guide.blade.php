@extends('frontend.layouts.master')

@section('title', __('AI Car Guide'))

@section('contents')
<div class="bg-gray-50 min-h-screen py-12">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
            <h1 class="text-3xl font-extrabold text-gray-900 sm:text-4xl">AI Car Guide</h1>
            <p class="mt-4 text-lg text-gray-500">Tell us what you need, and we'll find the perfect match.</p>
        </div>

        @if(!$recommendations)
            <div class="bg-white shadow sm:rounded-lg overflow-hidden">
                <div class="px-4 py-5 sm:p-6">
                    <form action="{{ route('automotive.guide') }}" method="POST" class="space-y-6">
                        @csrf
                        <div>
                            <label for="budget" class="block text-sm font-medium text-gray-700">Budget ($)</label>
                            <input type="number" name="budget" id="budget" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="20000">
                        </div>

                        <div>
                            <label for="usage" class="block text-sm font-medium text-gray-700">Primary Usage</label>
                            <select name="usage" id="usage" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="commute">Daily Commute</option>
                                <option value="family">Family Hauler</option>
                                <option value="adventure">Adventure & Outdoors</option>
                            </select>
                        </div>

                        <div>
                            <label for="passengers" class="block text-sm font-medium text-gray-700">Passengers</label>
                            <input type="number" name="passengers" id="passengers" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" value="1">
                        </div>

                        <div>
                            <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                Find My Car
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        @else
            <div class="space-y-8">
                <div class="bg-indigo-50 border-l-4 border-indigo-400 p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <!-- Heroicon name: solid/information-circle -->
                            <svg class="h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-indigo-700">
                                {{ $recommendations['advice'] }}
                            </p>
                        </div>
                    </div>
                </div>

                @if($recommendations['top_pick'])
                    <div class="bg-white shadow sm:rounded-lg overflow-hidden border-2 border-indigo-500 relative">
                        <div class="absolute top-0 right-0 bg-indigo-500 text-white px-3 py-1 text-sm font-bold rounded-bl-lg">Top Pick</div>
                        <div class="px-4 py-5 sm:p-6">
                            <h3 class="text-2xl font-bold text-gray-900">{{ $recommendations['top_pick']->title }}</h3>
                            <p class="text-lg text-gray-500">{{ $recommendations['top_pick']->formatted_price }}</p>
                            <div class="mt-4">
                                <a href="{{ route('automotive.show', $recommendations['top_pick']) }}" class="text-indigo-600 hover:text-indigo-900 font-medium">View Details &rarr;</a>
                            </div>
                        </div>
                    </div>
                @endif

                @if(count($recommendations['alternatives']) > 0)
                    <div>
                        <h3 class="text-lg font-medium text-gray-900 mb-4">Alternatives</h3>
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            @foreach($recommendations['alternatives'] as $alt)
                                <div class="bg-white shadow rounded-lg p-4">
                                    <h4 class="font-bold text-gray-900">{{ $alt->title }}</h4>
                                    <p class="text-gray-500">{{ $alt->formatted_price }}</p>
                                    <a href="{{ route('automotive.show', $alt) }}" class="text-sm text-indigo-600 hover:text-indigo-900 mt-2 block">View</a>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif

                <div class="text-center">
                    <a href="{{ route('automotive.guide') }}" class="text-indigo-600 hover:text-indigo-900">Start Over</a>
                </div>
            </div>
        @endif
    </div>
</div>
@endsection
