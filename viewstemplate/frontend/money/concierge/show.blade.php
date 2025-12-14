@extends('frontend.layouts.master')

@section('title', __('Analysis Results'))

@section('contents')
<div class="bg-gray-50 min-h-screen py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Summary Card -->
        <div class="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div class="px-4 py-5 sm:px-6 bg-indigo-600">
                <h3 class="text-lg leading-6 font-medium text-white">Analysis Results</h3>
                <p class="mt-1 max-w-2xl text-sm text-indigo-100">Bundle #{{ $offer->bundle_code }}</p>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
                <dl class="sm:divide-y sm:divide-gray-200">
                    <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt class="text-sm font-medium text-gray-500">Total Monthly Savings</dt>
                        <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold text-green-600 text-lg">
                            ${{ number_format($offer->projected_savings_monthly, 2) }}
                        </dd>
                    </div>
                    <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt class="text-sm font-medium text-gray-500">Annual Impact</dt>
                        <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold text-green-600 text-lg">
                            ${{ number_format($offer->projected_savings_annual, 2) }}
                        </dd>
                    </div>
                    <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt class="text-sm font-medium text-gray-500">Confidence Score</dt>
                        <dd class="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                            {{ $offer->confidence * 100 }}%
                        </dd>
                    </div>
                </dl>
            </div>
        </div>

        <!-- Line Items -->
        <div class="bg-white shadow overflow-hidden sm:rounded-lg">
            <div class="px-4 py-5 sm:px-6">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Detailed Breakdown</h3>
            </div>
            <div class="border-t border-gray-200">
                <ul class="divide-y divide-gray-200">
                    @foreach($offer->lineItems as $item)
                        <li class="px-4 py-4 sm:px-6">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <h4 class="text-lg font-bold text-gray-900">{{ $item->category }}</h4>
                                    <div class="mt-2 flex text-sm text-gray-500">
                                        <span class="mr-4">Current: <strong>${{ number_format($item->current_monthly_cost, 2) }}</strong> ({{ $item->current_provider ?? 'Unknown' }})</span>
                                        <span>Suggested: <strong>${{ number_format($item->suggested_monthly_cost, 2) }}</strong> ({{ $item->suggested_provider }})</span>
                                    </div>
                                </div>
                                <div class="ml-4 flex-shrink-0">
                                    @if($item->projected_savings_monthly > 0)
                                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                            Save ${{ number_format($item->projected_savings_monthly, 2) }}/mo
                                        </span>
                                    @else
                                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                            Best Price
                                        </span>
                                    @endif
                                </div>
                            </div>
                            @if($item->projected_savings_monthly > 0)
                                <div class="mt-4 bg-gray-50 p-3 rounded-md">
                                    <p class="text-sm text-gray-700">{{ $item->negotiation_script ?? 'Switch to ' . $item->suggested_provider . ' to unlock these savings.' }}</p>
                                </div>
                            @endif
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>

        <div class="mt-8 flex justify-end">
            <a href="{{ route('money.concierge.index') }}" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Back to Dashboard</a>
        </div>
    </div>
</div>
@endsection
