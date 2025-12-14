@extends('layouts.app')

@section('title', 'Mortgage & Affordability Tools')

@section('content')
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-500 to-sky-500 px-8 py-6 text-white">
            <h1 class="text-3xl font-bold">Mortgage Planner</h1>
            <p class="text-sm text-white/80">Deposit, repayments, and grant offsets calculated in seconds.</p>
        </div>
        <div class="p-8 space-y-6">
            <form id="mortgageCalcForm" action="{{ route('housing.mortgage-calc') }}" method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                @csrf
                <x-forms.currency name="property_price" label="Property Price" :value="old('property_price', $inputs['property_price'])" required />
                <x-forms.currency name="deposit_amount" label="Deposit" :value="old('deposit_amount', $inputs['deposit_amount'])" />
                <x-forms.select name="interest_rate" label="Interest Rate" :options="$rates" :selected="old('interest_rate', $inputs['interest_rate'])" />
                <x-forms.select name="loan_term" label="Loan Term (years)" :options="$terms" :selected="old('loan_term', $inputs['loan_term'])" />
                <x-forms.select name="repayment_frequency" label="Repayment Frequency" :options="$frequencies" :selected="$inputs['repayment_frequency']" />
                <x-forms.select name="state" label="State / Territory" :options="$states" :selected="$inputs['state']" />
            </form>
            <div class="flex justify-end">
                <button form="mortgageCalcForm" type="submit" class="inline-flex items-center px-5 py-3 bg-indigo-600 text-white rounded-md font-semibold">Calculate</button>
            </div>

            @if(! empty($results))
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Estimated Repayment</p>
                    <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ money_format($results['repayment']) }}/{{ $results['frequency_label'] }}</p>
                    <p class="text-sm text-gray-500">Loan amount {{ money_format($results['loan_amount']) }}</p>
                </div>
                <div class="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p class="text-xs uppercase tracking-wide text-gray-500">Deposit Progress</p>
                    <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ $results['deposit_percent'] }}%</p>
                    <p class="text-sm text-gray-500">Need {{ money_format($results['deposit_gap']) }} more for 20% deposit</p>
                </div>
            </div>

            <section class="p-5 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Eligible Housing Grants</h2>
                <div class="flex flex-wrap gap-2">
                    @forelse($results['eligible_grants'] as $grant)
                        <a href="{{ route('grants.show', ['grant' => $grant['slug']]) }}" class="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">{{ $grant['name'] }}</a>
                    @empty
                        <p class="text-sm text-gray-500">No grants detected. Update state or grant profile.</p>
                    @endforelse
                </div>
            </section>
            @endif
        </div>
    </div>
</div>
@endsection
