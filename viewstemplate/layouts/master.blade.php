<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
        name="description"
        content="@yield('meta_description', 'Athena unites jobs, money, housing, business and wellbeing into one respectful, AI-guided platform for women and non-binary people.')"
    />
    <meta name="ads-beacon-endpoint" content="{{ route('api.v1.ads.beacon') }}" />

    <title>
        @hasSection('title')
            @yield('title') — {{ config('app.name', 'Athena') }}
        @else
            {{ config('app.name', 'Athena') }} — Empowering Women
        @endif
    </title>

    <link rel="icon" type="image/svg+xml" href="{{ asset('default-uploads/favicon.svg') }}" />
    <link rel="alternate icon" type="image/png" href="{{ asset('default-uploads/logo.png') }}" />
    <link rel="apple-touch-icon" href="{{ asset('default-uploads/logo.svg') }}" />

    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
        href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap"
        rel="stylesheet"
    />

    <link rel="stylesheet" href="{{ asset('css/style.css') }}" />

    @stack('styles')
    <x-blade-bundle name="core" />

    <script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>
    <script defer src="https://unpkg.com/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js"></script>
    <script defer src="{{ asset('js/script.js') }}"></script>
</head>
@php
    $navigationHubs = config('athena.home_sections', []);
    $isHome = request()->routeIs('home');
    $isAthenaSocial = request()->routeIs('athena.social');
    $ctaTarget = $isAthenaSocial ? '#cta' : route('athena.social') . '#cta';
    $useFloatingHeader = !$isHome;
@endphp
<body class="{{ $useFloatingHeader ? 'floating-header-shell' : '' }}">
    @include('frontend.layouts.header')

    <main>
        @yield('content')
    </main>

    <footer class="footer">
        <div class="footer__inner">
            <div class="footer__brand">
                <a href="{{ route('home') }}" class="logo-link footer-logo-link" aria-label="Athena home">
                    <img class="logo" src="{{ asset('default-uploads/logo.svg') }}" alt="Athena logo" />
                </a>
                <p class="footer-text">
                    &copy; <span class="year">{{ date('Y') }}</span> {{ config('app.name', 'Athena') }}. Crafted with care by
                    <strong>Munyaradzi Chenjerai</strong>.
                </p>
                <ul class="footer-meta">
                    <li>Respectful AI copilots</li>
                    <li>Community verified partners</li>
                </ul>
            </div>

            <nav class="footer__nav" aria-label="Footer navigation">
                <p class="footer-nav__title">Explore Athena</p>
                <ul class="footer-links">
                    <li><a href="{{ $isHome ? '#how' : route('home') . '#how' }}">How it works</a></li>
                    <li><a href="{{ $isHome ? '#features' : route('home') . '#features' }}">Modules</a></li>
                    <li><a href="{{ $isHome ? '#impact' : route('home') . '#impact' }}">Impact</a></li>
                    <li><a href="{{ $isHome ? '#pricing' : route('home') . '#pricing' }}">Pricing</a></li>
                    <li><a href="{{ route('athena.social') }}">Athena social + AI</a></li>
                    <li><a href="{{ $ctaTarget }}">Get started</a></li>
                </ul>
                <a class="footer-cta" href="{{ $ctaTarget }}">
                    Join Athena
                    <span aria-hidden="true">→</span>
                </a>
            </nav>
        </div>
    </footer>

    {{-- Floating header script removed --}}

    @stack('scripts')
</body>
</html>
