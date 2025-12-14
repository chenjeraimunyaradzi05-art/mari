<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-bx92sMkBx9+1FMvx6bMpiKFFitvolSF/GpNZgbf+168Q5e0siJmq9hw3rroWAtxEvsC0BpvyOuk+qS0b+Y1Kug==" crossorigin="anonymous" referrerpolicy="no-referrer" />

        <!-- Feminine Theme -->
        <link rel="stylesheet" href="{{ asset('frontend/assets/css/theme-feminine.css') }}">
        <link rel="stylesheet" href="{{ asset('frontend/assets/css/feminine-frontend-overrides.css') }}">

        @stack('styles')

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="font-sans text-gray-900 antialiased">
        <div class="min-h-screen flex flex-col bg-gray-50">
            @include('layouts.navigation')

            <main class="flex-1">
                <div class="flex flex-col sm:justify-center items-center py-10 sm:py-16">
                    <div>
                        <a href="/" aria-label="{{ config('app.name', 'Laravel') }} home">
                            <x-application-logo class="w-20 h-20 fill-current text-gray-500" />
                        </a>
                    </div>

                    <div class="w-full sm:max-w-md mt-6 px-6 py-6 bg-white shadow-lg overflow-hidden sm:rounded-2xl">
                        {{ $slot }}
                    </div>
                </div>
            </main>

            @include('frontend.layouts.footer')
        </div>

        @stack('scripts')
    </body>
</html>
