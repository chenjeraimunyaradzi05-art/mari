@props([
    'name',
    'label' => null,
    'value' => null,
    'currency' => 'AUD',
    'placeholder' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-currency');
    $inputValue = old($name, $value);
    $symbol = match (strtoupper($currency)) {
        'AUD' => 'A$',
        'USD' => '$',
        'EUR' => '€',
        'GBP' => '£',
        default => strtoupper($currency),
    };
@endphp

<div class="space-y-2">
    @if($label)
        <label for="{{ $fieldId }}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $label }}</label>
    @endif

    <div class="relative flex items-center">
        <span class="absolute left-3 text-sm text-gray-500">{{ $symbol }}</span>
        <input
            id="{{ $fieldId }}"
            name="{{ $name }}"
            type="number"
            step="0.01"
            value="{{ $inputValue }}"
            {{ $attributes->merge(['class' => 'block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 focus:border-teal-500 focus:ring-teal-500 text-sm pl-8']) }}
            @if($placeholder) placeholder="{{ $placeholder }}" @endif
        />
    </div>

    @error($name)
        <p class="text-xs text-rose-600">{{ $message }}</p>
    @enderror
</div>
