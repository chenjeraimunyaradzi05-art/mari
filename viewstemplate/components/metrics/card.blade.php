@props([
    'label',
    'value',
    'trend' => null,
])

@php
    $trendValue = is_numeric($trend) ? number_format($trend, 1).'%' : $trend;
    $trendPositive = is_numeric($trend)
        ? $trend >= 0
        : \Illuminate\Support\Str::startsWith((string) $trend, ['+', '↑']);
@endphp

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-2">
    <p class="text-xs uppercase tracking-wide text-gray-500">{{ $label }}</p>
    <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ $value }}</p>
    @if($trend)
        <p class="text-xs {{ $trendPositive ? 'text-emerald-600' : 'text-rose-500' }}">{{ $trendValue }}</p>
    @endif
    @if(trim($slot) !== '')
        <div class="text-sm text-gray-500">
            {{ $slot }}
        </div>
    @endif
</div>
