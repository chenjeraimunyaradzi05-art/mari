@props([
    'value' => 0,
    'label' => null,
])

@php
    $percentage = max(0, min(100, (int) $value));
@endphp

<div class="space-y-2">
    <div class="flex items-center justify-between text-sm">
        @if($label)
            <p class="font-medium text-gray-900 dark:text-gray-100">{{ $label }}</p>
        @endif
        <p class="text-gray-500">{{ $percentage }}%</p>
    </div>
    <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full bg-teal-500" style="width: {{ $percentage }}%"></div>
    </div>
</div>
