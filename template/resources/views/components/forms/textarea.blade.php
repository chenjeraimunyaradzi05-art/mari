@props([
    'name',
    'label' => null,
    'rows' => 3,
    'placeholder' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-field');
    $value = old($name, $slot->isNotEmpty() ? trim($slot) : null);
@endphp

<div class="space-y-2">
    @if($label)
        <label for="{{ $fieldId }}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $label }}</label>
    @endif

    <textarea
        id="{{ $fieldId }}"
        name="{{ $name }}"
        rows="{{ $rows }}"
        {{ $attributes->merge(['class' => 'block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 focus:border-teal-500 focus:ring-teal-500 text-sm']) }}
        @if($placeholder) placeholder="{{ $placeholder }}" @endif
    >{{ $value }}</textarea>

    @error($name)
        <p class="text-xs text-rose-600">{{ $message }}</p>
    @enderror
</div>
