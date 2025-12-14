@props([
    'align' => 'left',
])

@php
    $alignment = 'text-left';
    if ($align === 'center') {
        $alignment = 'text-center';
    } elseif ($align === 'right') {
        $alignment = 'text-right';
    }
@endphp

<td {{ $attributes->merge(['class' => 'px-4 py-3 text-sm text-gray-700 dark:text-gray-200 '.$alignment]) }}>
    {{ $slot }}
</td>
