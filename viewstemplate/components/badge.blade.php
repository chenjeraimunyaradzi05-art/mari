@props([
    'color' => null,
    'primary' => false,
    'warning' => false,
    'success' => false,
    'danger' => false,
    'size' => 'md',
    'iconName' => null,
    'iconPosition' => 'left',
    'iconClass' => 'text-current opacity-80',
    'pill' => true,
])

@php
    $variant = $color ?? 'neutral';

    if ($primary) {
        $variant = 'primary';
    } elseif ($warning) {
        $variant = 'warning';
    } elseif ($success) {
        $variant = 'success';
    } elseif ($danger) {
        $variant = 'danger';
    }

    $variants = [
        'primary' => 'border-sky-200 bg-sky-100 text-sky-800',
        'warning' => 'border-amber-200 bg-amber-100 text-amber-800',
        'success' => 'border-emerald-200 bg-emerald-100 text-emerald-800',
        'danger' => 'border-rose-200 bg-rose-100 text-rose-800',
        'neutral' => 'border-slate-200 bg-slate-100 text-slate-700',
    ];

    $sizes = [
        'sm' => 'px-2.5 py-0.5 text-[11px]',
        'md' => 'px-3 py-1 text-xs',
        'lg' => 'px-3.5 py-1.5 text-sm',
    ];

    $classes = $variants[$variant] ?? $variants['neutral'];
    $sizeKey = is_string($size) ? $size : 'md';
    $sizeClasses = $sizes[$sizeKey] ?? $sizes['md'];
    $shapeClasses = $pill ? 'rounded-full' : 'rounded-md';
    $hasIconSlot = isset($icon);
    $hasIcon = $iconName || $hasIconSlot;
    $iconSpacingLeft = $hasIcon && $iconPosition === 'left' ? 'mr-1.5' : '';
    $iconSpacingRight = $hasIcon && $iconPosition === 'right' ? 'ml-1.5' : '';
@endphp

<span {{ $attributes->merge(['class' => 'inline-flex items-center font-medium border ' . $classes . ' ' . $sizeClasses . ' ' . $shapeClasses]) }}>
    @if($hasIcon && $iconPosition === 'left')
        <span class="flex items-center {{ $iconSpacingLeft }}">
            @if($iconName)
                <i class="{{ $iconName }} {{ $iconClass }}"></i>
            @elseif($hasIconSlot)
                {{ $icon }}
            @endif
        </span>
    @endif

    <span>{{ $slot }}</span>

    @if($hasIcon && $iconPosition === 'right')
        <span class="flex items-center {{ $iconSpacingRight }}">
            @if($iconName)
                <i class="{{ $iconName }} {{ $iconClass }}"></i>
            @elseif($hasIconSlot)
                {{ $icon }}
            @endif
        </span>
    @endif
</span>
