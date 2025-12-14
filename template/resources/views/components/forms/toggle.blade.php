@props([
    'name',
    'label' => null,
    'checked' => false,
    'description' => null,
])

@php
    $fieldId = $attributes->get('id', $name.'-toggle');
    $isChecked = old($name, $checked) ? true : false;
@endphp

<label for="{{ $fieldId }}" class="flex items-center justify-between gap-4 cursor-pointer">
    <div>
        @if($label)
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $label }}</p>
        @endif
        @if($description)
            <p class="text-xs text-gray-500">{{ $description }}</p>
        @endif
    </div>
    <div class="relative inline-flex items-center">
        <input type="hidden" name="{{ $name }}" value="0">
        <input
            id="{{ $fieldId }}"
            type="checkbox"
            name="{{ $name }}"
            value="1"
            class="sr-only peer"
            @checked($isChecked)
        >
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-400 rounded-full peer dark:bg-gray-700 peer-checked:bg-teal-500 transition"></div>
        <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
    </div>
</label>
