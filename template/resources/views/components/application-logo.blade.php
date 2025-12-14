@props([
    'src' => asset('default-uploads/logo.png'),
    'alt' => 'Athena logo',
])

<img src="{{ $src }}" alt="{{ $alt }}" {{ $attributes->merge(['class' => 'h-24 w-auto']) }}>
