@props([
    'label' => null,
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

<th {{ $attributes->merge(['scope' => 'col', 'class' => 'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider '.$alignment]) }}>
    {{ $label ?? $slot }}
</th>
