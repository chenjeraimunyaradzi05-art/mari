@props([
    'title' => null,
    'subtitle' => null,
    'actions' => null,
    'iconName' => null,
    'iconBackground' => 'bg-slate-100 text-slate-600',
    'iconSize' => 'h-10 w-10',
    'padding' => 'p-5',
    'tone' => 'default',
])

@php
    $toneClasses = [
        'default' => 'border-slate-200 bg-white shadow-sm',
        'muted' => 'border-slate-100 bg-slate-50',
        'surface' => 'border-transparent bg-white shadow-lg shadow-slate-100/60',
        'brand' => 'border-sky-100 bg-sky-50',
    ];

    $baseClasses = 'rounded-2xl';
    $paddingClasses = trim($padding) ?: 'p-5';
    $toneKey = is_string($tone) ? $tone : 'default';
    $containerClasses = $baseClasses . ' ' . ($toneClasses[$toneKey] ?? $toneClasses['default']) . ' ' . $paddingClasses;
    $hasHeader = $title || $actions || $subtitle || isset($icon) || $iconName;
    $hasIcon = isset($icon) || $iconName;
@endphp

<div {{ $attributes->merge(['class' => $containerClasses]) }}>
    @if($hasHeader)
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3">
                @if($hasIcon)
                    <div class="flex items-center justify-center rounded-2xl {{ $iconBackground }} {{ $iconSize }}">
                        @if($iconName)
                            <i class="{{ $iconName }} text-lg"></i>
                        @elseif(isset($icon))
                            {{ $icon }}
                        @endif
                    </div>
                @endif
                @if($title || $subtitle)
                    <div>
                        @if($title)
                            <h3 class="text-base font-semibold text-slate-800">{{ $title }}</h3>
                        @endif
                        @if($subtitle)
                            <p class="text-sm text-slate-500">{{ $subtitle }}</p>
                        @endif
                    </div>
                @endif
            </div>
            @isset($actions)
                <div class="text-sm text-slate-500">
                    {{ $actions }}
                </div>
            @endisset
        </div>
    @endif

    {{ $slot }}
</div>
