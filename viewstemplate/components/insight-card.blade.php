@props([
    'title',
    'value',
    'tone' => 'default',
])

@php
    $tones = [
        'default' => 'border-gray-200 dark:border-gray-700',
        'success' => 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40',
        'warning' => 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40',
        'danger' => 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40',
        'info' => 'border-sky-200 bg-sky-50/60 dark:border-sky-900/40',
    ];
    $toneKey = is_string($tone) ? $tone : 'default';
    $classes = $tones[$toneKey] ?? $tones['default'];
@endphp

<div {{ $attributes->merge(['class' => 'rounded-lg border p-4 '.$classes]) }}>
    <p class="text-xs uppercase tracking-wide text-gray-500">{{ $title }}</p>
    <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ $value }}</p>
    @if(trim($slot) !== '')
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ $slot }}</div>
    @endif
</div>
