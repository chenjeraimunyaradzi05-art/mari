@props([
    'index',
    'debt' => [],
])

@php
    $row = array_merge([
        'name' => '',
        'balance' => '',
        'rate' => '',
        'min_payment' => '',
    ], (array) $debt);
@endphp

<div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
    <x-forms.input
        :name="'debts['.$index.'][name]'"
        label="Lender / Account"
        :value="$row['name']"
        placeholder="e.g. NAB Business Loan"
    />
    <x-forms.currency
        :name="'debts['.$index.'][balance]'"
        label="Balance"
        :value="$row['balance']"
    />
    <x-forms.input
        :name="'debts['.$index.'][rate]'"
        label="Rate %"
        type="number"
        step="0.01"
        :value="$row['rate']"
    />
    <x-forms.currency
        :name="'debts['.$index.'][min_payment]'"
        label="Min Payment"
        :value="$row['min_payment']"
    />
</div>
