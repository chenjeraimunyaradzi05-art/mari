@props([
    'name',
    'label' => null,
    'type' => 'text',
    'value' => null,
    'placeholder' => null,
    'help' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-field');
    $inputValue = old($name, $value);
@endphp

<div class="space-y-2">
    @if($label)
        <label for="{{ $fieldId }}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $label }}</label>
    @endif

    <input
        id="{{ $fieldId }}"
        name="{{ $name }}"
        type="{{ $type }}"
        value="{{ $type === 'password' ? '' : $inputValue }}"
        {{ $attributes->merge(['class' => 'block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 focus:border-teal-500 focus:ring-teal-500 text-sm']) }}
        @if($placeholder) placeholder="{{ $placeholder }}" @endif
    />

    @if($help)
        <p class="text-xs text-gray-500">{{ $help }}</p>
    @endif

    @error($name)
        <p class="text-xs text-rose-600">{{ $message }}</p>
    @enderror
</div>
