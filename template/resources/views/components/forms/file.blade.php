@props([
    'name',
    'label' => null,
    'multiple' => false,
    'accept' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-file');
@endphp

<div class="space-y-2">
    @if($label)
        <label for="{{ $fieldId }}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $label }}</label>
    @endif

    <input
        id="{{ $fieldId }}"
        name="{{ $name }}{{ $multiple ? '[]' : '' }}"
        type="file"
        {{ $multiple ? 'multiple' : '' }}
        @if($accept) accept="{{ $accept }}" @endif
        {{ $attributes->merge(['class' => 'block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100']) }}
    />

    @error($name)
        <p class="text-xs text-rose-600">{{ $message }}</p>
    @enderror
</div>
