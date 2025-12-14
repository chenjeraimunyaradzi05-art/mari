@props([
    'name',
    'label' => null,
    'options' => [],
    'selected' => null,
    'placeholder' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-field');
    $selectedValue = old($name, $selected);
    $resolved = collect($options)->map(function ($option, $key) {
        if (is_array($option)) {
            return [
                'value' => $option['value'] ?? (is_string($key) ? $key : $option['label'] ?? $key),
                'label' => $option['label'] ?? $option['value'] ?? $key,
            ];
        }

        return [
            'value' => is_string($key) ? $key : $option,
            'label' => $option,
        ];
    });
@endphp

<div class="space-y-2">
    @if($label)
        <label for="{{ $fieldId }}" class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $label }}</label>
    @endif

    <select
        id="{{ $fieldId }}"
        name="{{ $name }}"
        {{ $attributes->merge(['class' => 'block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 focus:border-teal-500 focus:ring-teal-500 text-sm']) }}
    >
        @if($placeholder)
            <option value="">{{ $placeholder }}</option>
        @endif
        @foreach($resolved as $option)
            <option value="{{ $option['value'] }}" @selected((string)$selectedValue === (string)$option['value'])>
                {{ $option['label'] }}
            </option>
        @endforeach
    </select>

    @error($name)
        <p class="text-xs text-rose-600">{{ $message }}</p>
    @enderror
</div>
