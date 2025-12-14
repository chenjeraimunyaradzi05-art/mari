@extends('layouts.app')

@section('title', 'Budget & Cashflow')

@section('content')
<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <p class="text-sm uppercase tracking-wide text-emerald-600 font-semibold">Financial Wellbeing</p>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Personal & Sole Trader Budget</h1>
            <p class="text-gray-600 dark:text-gray-400">Track income, expenses, savings goals, and cash runway in one view.</p>
        </div>
        <div class="flex flex-wrap gap-3">
            <a href="{{ route('financial.budgets.create') }}" class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md font-semibold">Create Budget</a>
            <button class="inline-flex items-center px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md font-semibold text-gray-700 dark:text-gray-200">Import CSV</button>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <x-metrics.card label="Total Income" :value="money_format($summary['income'])" />
        <x-metrics.card label="Total Expenses" :value="money_format($summary['expenses'])" />
        <x-metrics.card label="Net Position" :value="money_format($summary['net'])" :trend="$summary['net_trend']" />
        <x-metrics.card label="Savings Progress" :value="$summary['savings_percent'].'%'" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
            <header class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">Budget Breakdown</h2>
                    <p class="text-sm text-gray-500">Forecast vs actuals by category</p>
                </div>
                <x-badge color="emerald">{{ strtoupper($budget['type']) }}</x-badge>
            </header>
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
                @foreach($budget['categories'] as $category)
                    <div class="p-6 flex items-center justify-between">
                        <div>
                            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $category['name'] }}</p>
                            <p class="text-xs text-gray-500">{{ ucfirst($category['frequency']) }}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-500">Planned</p>
                            <p class="text-sm font-semibold">{{ money_format($category['planned_amount']) }}</p>
                            <p class="text-xs text-gray-500 mt-1">Actual</p>
                            <p class="text-sm font-semibold {{ $category['variance'] < 0 ? 'text-red-600' : 'text-emerald-600' }}">
                                {{ money_format($category['actual_amount']) }}
                            </p>
                        </div>
                    </div>
                @endforeach
            </div>
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Cashflow Timeline</h2>
            <canvas id="cashflowChart" class="h-64"></canvas>
            <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>Projected runway: <span class="font-semibold text-gray-900 dark:text-white">{{ $summary['runway_weeks'] }} weeks</span></p>
                <p>Break-even point: {{ $summary['break_even_date']->format('M d') }}</p>
            </div>
        </section>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
        <header class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">Recent Transactions</h2>
                <p class="text-sm text-gray-500">Synced from bank feeds or manual uploads.</p>
            </div>
            <div class="flex gap-2">
                <button class="text-sm text-gray-600 dark:text-gray-300">Export CSV</button>
                <button class="text-sm text-emerald-600">Add Transaction</button>
            </div>
        </header>
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                        <x-table.th label="Date" />
                        <x-table.th label="Description" />
                        <x-table.th label="Category" />
                        <x-table.th label="Amount" align="right" />
                        <x-table.th label="Type" />
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    @foreach($transactions as $txn)
                        <tr>
                            <x-table.td>{{ $txn['transaction_date']->format('M d, Y') }}</x-table.td>
                            <x-table.td>
                                <p class="font-semibold text-gray-900 dark:text-white">{{ $txn['description'] }}</p>
                                <p class="text-xs text-gray-500">{{ $txn['reference'] }}</p>
                            </x-table.td>
                            <x-table.td>{{ $txn['category']['name'] }}</x-table.td>
                            <x-table.td align="right" class="font-semibold {{ $txn['amount'] < 0 ? 'text-red-600' : 'text-emerald-600' }}">
                                {{ money_format($txn['amount']) }}
                            </x-table.td>
                            <x-table.td>{{ ucfirst($txn['category']['type']) }}</x-table.td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
</div>

@push('scripts')
<script>
const cashflowCtx = document.getElementById('cashflowChart');
if (cashflowCtx && window.Chart) {
    new Chart(cashflowCtx, {
        type: 'bar',
        data: {
            labels: @json($cashflow['labels']),
            datasets: [
                { label: 'Income', data: @json($cashflow['income']), backgroundColor: '#10b981' },
                { label: 'Expenses', data: @json($cashflow['expenses']), backgroundColor: '#f87171' }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}
</script>
@endpush
@endsection
