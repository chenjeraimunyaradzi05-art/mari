@extends('frontend.layouts.master')

@section('title', __('New Expense Analysis'))

@section('contents')
<div class="bg-gray-50 min-h-screen py-8">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white shadow sm:rounded-lg">
            <div class="px-4 py-5 sm:p-6">
                <h3 class="text-lg leading-6 font-medium text-gray-900">New Expense Analysis</h3>
                <div class="mt-2 max-w-xl text-sm text-gray-500">
                    <p>Enter your current monthly costs for key categories. We'll analyze them against our partner network to find you savings.</p>
                </div>

                <form action="{{ route('money.concierge.store') }}" method="POST" class="mt-5 space-y-6">
                    @csrf
                    <input type="hidden" name="currency" value="AUD">

                    <div class="space-y-4">
                        @foreach(['Mortgage/Rent', 'Electricity', 'Internet', 'Mobile Phone', 'Car Insurance', 'Health Insurance'] as $index => $category)
                            <div class="border-b border-gray-200 pb-4">
                                <h4 class="text-sm font-medium text-gray-900 mb-2">{{ $category }}</h4>
                                <input type="hidden" name="categories[{{ $index }}][category]" value="{{ $category }}">

                                <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                    <div class="sm:col-span-3">
                                        <label for="provider_{{ $index }}" class="block text-sm font-medium text-gray-700">Current Provider</label>
                                        <div class="mt-1">
                                            <input type="text" name="categories[{{ $index }}][current_provider]" id="provider_{{ $index }}" class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md">
                                        </div>
                                    </div>

                                    <div class="sm:col-span-3">
                                        <label for="cost_{{ $index }}" class="block text-sm font-medium text-gray-700">Monthly Cost ($)</label>
                                        <div class="mt-1">
                                            <input type="number" step="0.01" name="categories[{{ $index }}][current_monthly_cost]" id="cost_{{ $index }}" class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="0.00">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>

                    <div class="pt-5">
                        <div class="flex justify-end">
                            <a href="{{ route('money.concierge.index') }}" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancel</a>
                            <button type="submit" class="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Analyze Expenses</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection
