@php
	$appName = config('app.name', 'Athena');
	$pageHeading = trim($__env->yieldContent('title')) ?: 'Empowering Women Across Every Dimension of Life';
    $useFloatingHeader = true;
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ $appName }} · {{ $pageHeading }}</title>

    <link rel="icon" type="image/svg+xml" href="{{ asset('default-uploads/favicon.svg') }}" />
    <link rel="alternate icon" type="image/png" href="{{ asset('default-uploads/logo.png') }}" />

    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap" rel="stylesheet" />

    {{-- Essential Inner Page Styles (Bootstrap etc) --}}
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/all.min.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/plugins/animate.min.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/plugins/magnific-popup.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/plugins/perfect-scrollbar.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/plugins/select2.min.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/plugins/swiper-bundle.min.css') }}">
    <link rel="stylesheet" href="{{ asset('frontend/assets/css/style.min.css') }}">

    {{-- Homepage Design System --}}
    <link rel="stylesheet" href="{{ asset('css/style.css') }}" />

    @stack('styles')
    <x-blade-bundle name="core" />

    <script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>
    <script defer src="https://unpkg.com/smoothscroll-polyfill@0.4.4/dist/smoothscroll.min.js"></script>
    <script defer src="{{ asset('js/script.js') }}"></script>
</head>
<body class="">
    @include('frontend.layouts.header')

    <main>
        @if (session('success'))
            <div class="container mt-3">
                <div class="alert alert-success">
                    {{ session('success') }}
                </div>
            </div>
        @endif
        @if (session('error'))
            <div class="container mt-3">
                <div class="alert alert-danger">
                    {{ session('error') }}
                </div>
            </div>
        @endif

        @yield('content')
        @yield('contents')
    </main>

    @include('frontend.layouts.footer')

    {{-- Inner Page Scripts --}}
    <script src="{{ asset('frontend/assets/js/vendor/jquery-3.6.0.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/vendor/bootstrap.bundle.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/waypoints.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/counterup.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/wow.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/isotope.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/magnific-popup.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/select2.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/perfect-scrollbar.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/swiper-bundle.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/plugins/scrollup.min.js') }}"></script>
    <script src="{{ asset('frontend/assets/js/main.min.js') }}"></script>

    @include('frontend.layouts.scripts')
    @stack('scripts')
</body>
</html>
