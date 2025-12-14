@extends('layouts.app')

@section('title', 'Debt Consolidation Coach')

@section('content')
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="bg-gradient-to-r from-rose-500 to-amber-500 px-8 py-6 text-white">
            <h1 class="text-3xl font-bold">Debt Consolidation Planner</h1>
            <p class="text-sm text-white/80">Compare repayment scenarios, interest savings, and payoff timelines.</p>
        </div>

        <div class="p-8 space-y-6">
            <form action="{{ route('financial.debt.calculate') }}" method="POST" class="space-y-4">
                @csrf
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Current Debts</h2>
                        <button type="button" x-data="{}" x-on:click="$dispatch('add-debt-row')" class="text-sm text-rose-600">+ Add Debt</button>
                    </div>
                    <div id="debtList" class="space-y-4">
                        @foreach(old('debts', $debts) as $index => $debt)
                            <x-finance.debt-row :index="$index" :debt="$debt" />
                        @endforeach
                    </div>
                </div>
                <div class="flex justify-end">
                    <button type="submit" class="inline-flex items-center px-5 py-3 bg-rose-600 text-white rounded-md font-semibold">Calculate Scenarios</button>
                </div>
            </form>

            @if(! empty($scenarios))
            <div class="space-y-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Comparison</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    @foreach($scenarios as $scenario)
                        <div class="p-5 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p class="text-xs uppercase tracking-wide text-gray-500">Rate {{ $scenario['rate'] }}%</p>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ money_format($scenario['monthly_payment']) }}/mo</p>
                            <p class="text-sm text-gray-500">Term {{ $scenario['term_months'] }} months</p>
                            <div class="mt-4 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                <p>Total paid: {{ money_format($scenario['total_paid']) }}</p>
                                <p>Total interest: {{ money_format($scenario['total_interest']) }}</p>
                                <p>Savings vs current: <span class="font-semibold {{ $scenario['savings_vs_current'] >= 0 ? 'text-emerald-600' : 'text-red-600' }}">{{ money_format($scenario['savings_vs_current']) }}</span></p>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
            @endif
        </div>
    </div>
</div>
@endsection
